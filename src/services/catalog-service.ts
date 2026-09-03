import { notFound } from '@/lib/errors';
import { displayRoundStatus } from '@/lib/lottery-rules';
import { cacheKeys, cacheTtl, getCache } from '@/providers/cache';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { BetTypeDto, LotteryCardDto, LotteryDetailDto, ResultDto, RoundDto } from '@/types/dto';
import type { Lottery, LotteryResult, LotteryRound } from '@/types/domain';

/**
 * Read model for the public catalogue.
 *
 * Everything here is public, reconstructible data, so it is safe to cache. All
 * list building is batched: one pass for rounds, one for results — never a query
 * per lottery (the classic N+1 that kills a listing page).
 */
export class CatalogService {
  constructor(private readonly repos: RepositoryBundle) {}

  private toCard(lottery: Lottery, round: LotteryRound | undefined, nowMs: number): LotteryCardDto {
    return {
      id: lottery.id,
      slug: lottery.slug,
      name: lottery.name,
      nameTh: lottery.nameTh,
      country: lottery.country,
      countryCode: lottery.countryCode,
      status: round ? displayRoundStatus(round, nowMs) : 'closed',
      roundId: round?.id ?? null,
      roundCode: round?.roundCode ?? null,
      closeAt: round?.closeAt ?? null,
      resultAt: round?.resultAt ?? null,
      betTypeCount: lottery.betTypeCodes.length,
    };
  }

  async listCards(nowMs = Date.now()): Promise<LotteryCardDto[]> {
    const cache = getCache();
    const lotteries = await cache.remember(cacheKeys.lotteryList, cacheTtl.lotteryList, () =>
      this.repos.lotteries.list(),
    );

    // Batched: one lookup for every lottery's current round.
    const rounds = await this.repos.rounds.findCurrentForLotteries(
      lotteries.map((lottery) => lottery.id),
      nowMs,
    );

    return lotteries.map((lottery) => this.toCard(lottery, rounds.get(lottery.id), nowMs));
  }

  async listClosingSoon(limit = 4, nowMs = Date.now()): Promise<LotteryCardDto[]> {
    const cards = await this.listCards(nowMs);
    return cards
      .filter((card) => card.closeAt !== null)
      .sort((a, b) => (a.closeAt ?? '').localeCompare(b.closeAt ?? ''))
      .slice(0, limit);
  }

  async listOpen(limit = 6, nowMs = Date.now()): Promise<LotteryCardDto[]> {
    const cards = await this.listCards(nowMs);
    return cards.filter((card) => card.status === 'open' || card.status === 'closing-soon').slice(0, limit);
  }

  async getBetTypeDtos(lottery: Lottery, nowMs = Date.now()): Promise<BetTypeDto[]> {
    const betTypes = await this.repos.betTypes.findByCodes(lottery.betTypeCodes);
    const rates = await this.repos.payoutRates.resolveMany(
      betTypes.map((betType) => betType.code),
      lottery.id,
      new Date(nowMs).toISOString(),
    );

    return betTypes
      .filter((betType) => betType.isActive && rates.has(betType.code))
      .map((betType) => ({
        code: betType.code,
        name: betType.name,
        nameTh: betType.nameTh,
        digitLength: betType.digitLength,
        matchStrategy: betType.matchStrategy,
        minBet: betType.minBet,
        maxBet: betType.maxBet,
        maxPerNumber: betType.maxPerNumber,
        rateMilli: rates.get(betType.code)?.rateMilli ?? 0,
        description: betType.description,
      }));
  }

  async getDetailBySlug(slug: string, nowMs = Date.now()): Promise<LotteryDetailDto> {
    const lottery = await this.repos.lotteries.findBySlug(slug);
    if (!lottery) throw notFound('ไม่พบหวยที่ต้องการ');

    const [currentRound, betTypes, recentRounds] = await Promise.all([
      this.repos.rounds.findCurrentForLottery(lottery.id, nowMs),
      this.getBetTypeDtos(lottery, nowMs),
      this.repos.rounds.findRecentForLottery(lottery.id, 12),
    ]);

    const resultsByRound = await this.repos.results.findManyByRoundIds(
      recentRounds.map((round) => round.id),
    );

    const recentResults: ResultDto[] = recentRounds
      .map((round) => {
        const result = resultsByRound.get(round.id);
        if (!result) return null;
        return this.toResultDto(result, lottery, round);
      })
      .filter((value): value is ResultDto => value !== null)
      .slice(0, 8);

    const roundDto: RoundDto | null = currentRound
      ? {
          id: currentRound.id,
          roundCode: currentRound.roundCode,
          openAt: currentRound.openAt,
          closeAt: currentRound.closeAt,
          resultAt: currentRound.resultAt,
          status: displayRoundStatus(currentRound, nowMs),
        }
      : null;

    return {
      id: lottery.id,
      slug: lottery.slug,
      name: lottery.name,
      nameTh: lottery.nameTh,
      country: lottery.country,
      countryCode: lottery.countryCode,
      timezone: lottery.timezone,
      description: lottery.description,
      currentRound: roundDto,
      betTypes,
      recentResults,
    };
  }

  private toResultDto(result: LotteryResult, lottery: Lottery, round: LotteryRound): ResultDto {
    return {
      id: result.id,
      lotteryId: lottery.id,
      lotteryName: lottery.name,
      lotteryNameTh: lottery.nameTh,
      roundId: round.id,
      roundCode: round.roundCode,
      top3: result.top3,
      top2: result.top2,
      bottom2: result.bottom2,
      announcedAt: result.announcedAt,
    };
  }

  async latestResults(limit = 6, lotteryId?: string): Promise<ResultDto[]> {
    const results = await this.repos.results.findLatest(limit, lotteryId);
    return this.hydrateResults(results);
  }

  async findResults(filter: { lotteryId?: string; dateKey?: string; page?: number; pageSize?: number }) {
    const page = await this.repos.results.findMany(filter);
    return { ...page, items: await this.hydrateResults(page.items) };
  }

  /** Batched hydration — two lookups total regardless of how many results. */
  private async hydrateResults(results: readonly LotteryResult[]): Promise<ResultDto[]> {
    if (results.length === 0) return [];
    const lotteries = await this.repos.lotteries.list({ includeInactive: true });
    const lotteryById = new Map(lotteries.map((lottery) => [lottery.id, lottery]));

    const rounds = await Promise.all(results.map((result) => this.repos.rounds.findById(result.roundId)));
    const roundById = new Map(
      rounds.filter((round): round is LotteryRound => round !== null).map((round) => [round.id, round]),
    );

    return results
      .map((result) => {
        const lottery = lotteryById.get(result.lotteryId);
        const round = roundById.get(result.roundId);
        if (!lottery || !round) return null;
        return this.toResultDto(result, lottery, round);
      })
      .filter((value): value is ResultDto => value !== null);
  }
}
