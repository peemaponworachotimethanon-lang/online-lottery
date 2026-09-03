import { EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { ResultConsole, type PendingRound } from '@/features/admin/result-console';
import { formatDateTime } from '@/lib/datetime';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminResultsPage() {
  await requirePermission('result.manage');
  const services = getServices();
  const nowMs = Date.now();

  // Rounds that have closed: candidates for entering a result and settling.
  const closed = await services.repos.rounds.findMany({ page: 1, pageSize: 60 });
  const lotteries = await services.repos.lotteries.list({ includeInactive: true });
  const lotteryById = new Map(lotteries.map((lottery) => [lottery.id, lottery]));

  const candidates = closed.items.filter(
    (round) => new Date(round.closeAt).getTime() <= nowMs && round.status !== 'cancelled',
  );

  const resultsByRound = await services.repos.results.findManyByRoundIds(
    candidates.map((round) => round.id),
  );

  const pendingRounds: PendingRound[] = await Promise.all(
    candidates
      .filter((round) => round.status !== 'settled' || !resultsByRound.has(round.id))
      .slice(0, 30)
      .map(async (round) => {
        const result = resultsByRound.get(round.id);
        return {
          id: round.id,
          roundCode: round.roundCode,
          lotteryName: lotteryById.get(round.lotteryId)?.nameTh ?? '—',
          closeAt: round.closeAt,
          resultAt: round.resultAt,
          hasResult: Boolean(result),
          isSettled: round.status === 'settled',
          top3: result?.top3 ?? null,
          bottom2: result?.bottom2 ?? null,
          betCount: await services.repos.bets.countForRound(round.id),
        };
      }),
  );

  const recentResults = await services.catalog.latestResults(20);

  return (
    <div className="space-y-5">
      <PageHeader
        title="ผลรางวัลและการเคลียร์"
        description="บันทึกผลรางวัล ตรวจสอบยอดจ่าย แล้วจึงเคลียร์รางวัลให้ผู้ชนะ"
      />

      <ResultConsole rounds={pendingRounds} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">ผลรางวัลที่ประกาศแล้ว</h2>
        {recentResults.length === 0 ? (
          <div className="surface-card">
            <EmptyState title="ยังไม่มีผลรางวัล" />
          </div>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>หวย</TH>
                  <TH>งวด</TH>
                  <TH align="center">3 ตัวบน</TH>
                  <TH align="center">2 ตัวบน</TH>
                  <TH align="center">2 ตัวล่าง</TH>
                  <TH align="right">ประกาศเมื่อ</TH>
                </TR>
              </THead>
              <TBody>
                {recentResults.map((result) => (
                  <TR key={result.id}>
                    <TD className="text-sm">{result.lotteryNameTh}</TD>
                    <TD className="tabular text-xs text-muted-foreground">{result.roundCode}</TD>
                    <TD align="center" className="tabular font-semibold tracking-widest text-accent">
                      {result.top3}
                    </TD>
                    <TD align="center" className="tabular tracking-widest">
                      {result.top2}
                    </TD>
                    <TD align="center" className="tabular tracking-widest">
                      {result.bottom2}
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(result.announcedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
