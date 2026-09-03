import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { BetStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { formatRate } from '@/lib/money';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountBetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 20;

  const bets = await getServices().query.findBets({ userId: user.id, page, pageSize });

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติการแทง</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {bets.items.length === 0 ? (
          <EmptyState title="ยังไม่มีบิลแทง" description="บิลที่คุณส่งจะแสดงที่นี่" />
        ) : (
          <>
            <ul className="divide-y divide-border border-t border-border">
              {bets.items.map((bet) => (
                <li key={bet.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{bet.lotteryName}</p>
                      <p className="tabular text-xs text-muted-foreground">
                        {bet.reference} · งวด {bet.roundCode} · {formatDateTime(bet.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <BetStatusBadge status={bet.status} />
                      <div className="text-right">
                        <Money value={bet.totalStake} className="block text-sm font-semibold" />
                        {bet.totalPayout > 0 ? (
                          <Money value={bet.totalPayout} tone="prize" className="block text-xs" />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <TableWrap>
                    <Table>
                      <THead>
                        <TR>
                          <TH>เลข</TH>
                          <TH>ประเภท</TH>
                          <TH align="right">เดิมพัน</TH>
                          <TH align="right">อัตราจ่าย</TH>
                          <TH align="right">รางวัลที่เป็นไปได้</TH>
                          <TH align="right">ผล</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {bet.items.map((item) => (
                          <TR key={item.id}>
                            <TD className="tabular font-semibold tracking-widest">{item.number}</TD>
                            <TD className="text-sm">{item.betTypeName}</TD>
                            <TD align="right">
                              <Money value={item.stake} className="text-sm" />
                            </TD>
                            <TD align="right" className="tabular text-sm text-accent">
                              x{formatRate(item.rateMilli)}
                            </TD>
                            <TD align="right">
                              <Money value={item.potentialPayout} tone="muted" className="text-sm" />
                            </TD>
                            <TD align="right">
                              {item.payout > 0 ? (
                                <Money value={item.payout} tone="prize" className="text-sm" />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {item.status === 'confirmed' ? 'รอผล' : '—'}
                                </span>
                              )}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableWrap>
                </li>
              ))}
            </ul>
            <div className="px-5">
              <Pagination
                page={bets.page}
                pageCount={bets.pageCount}
                pageSize={bets.pageSize}
                total={bets.total}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
