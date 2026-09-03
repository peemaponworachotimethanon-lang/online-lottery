import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { BetStatusBadge, TxTypeBadge, UserStatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { UserActions } from '@/features/admin/user-actions';
import { formatDateTime } from '@/lib/datetime';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission('user.view');
  const { id } = await params;
  const detail = await getServices().query.getUserDetail(id);
  if (!detail || !detail.profile) notFound();

  const { profile, wallet, bets, transactions, loginEvents, audit } = detail;
  const principal = { id: actor.id, roles: actor.roles };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/users">
          <ArrowLeft /> กลับไปรายชื่อผู้ใช้
        </Link>
      </Button>

      <PageHeader
        title={profile.username}
        description={`${profile.email} · ${profile.phone}`}
        actions={
          <UserActions
            userId={profile.id}
            username={profile.username}
            status={profile.status}
            balance={profile.balance}
            canEdit={can(principal, 'user.edit')}
            canAdjustWallet={can(principal, 'wallet.adjust')}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ยอดที่ใช้ได้" value={<Money value={profile.balance} />} tone="emerald" />
        <StatCard label="กันไว้" value={<Money value={profile.held} tone="muted" />} />
        <StatCard
          label="สถานะบัญชี"
          value={<UserStatusBadge status={profile.status} />}
          hint={`สมัคร ${formatDateTime(profile.createdAt)}`}
        />
        <StatCard
          label="บทบาท"
          value={
            <span className="flex flex-wrap gap-1">
              {profile.roles.map((role) => (
                <Badge key={role} variant="emerald">
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
            </span>
          }
          hint={wallet ? `wallet ${wallet.id}` : undefined}
        />
      </div>

      <Tabs defaultValue="bets">
        <TabsList>
          <TabsTrigger value="bets">บิลแทง</TabsTrigger>
          <TabsTrigger value="transactions">ธุรกรรม</TabsTrigger>
          <TabsTrigger value="logins">ประวัติเข้าสู่ระบบ</TabsTrigger>
          <TabsTrigger value="audit">บันทึกการใช้งาน</TabsTrigger>
        </TabsList>

        <TabsContent value="bets">
          <Card>
            <CardHeader>
              <CardTitle>บิลแทงล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {bets.length === 0 ? (
                <EmptyState title="ผู้ใช้รายนี้ยังไม่มีบิลแทง" />
              ) : (
                <TableWrap className="rounded-none border-0 border-t">
                  <Table>
                    <THead>
                      <TR>
                        <TH>อ้างอิง</TH>
                        <TH>หวย / งวด</TH>
                        <TH align="right">รายการ</TH>
                        <TH align="right">เดิมพัน</TH>
                        <TH align="right">รางวัล</TH>
                        <TH>สถานะ</TH>
                        <TH align="right">เวลา</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {bets.map((bet) => (
                        <TR key={bet.id}>
                          <TD className="tabular text-sm">{bet.reference}</TD>
                          <TD className="text-sm">
                            {bet.lotteryName}
                            <span className="block text-xs text-muted-foreground">{bet.roundCode}</span>
                          </TD>
                          <TD align="right" className="tabular text-sm">
                            {bet.itemCount}
                          </TD>
                          <TD align="right">
                            <Money value={bet.totalStake} className="text-sm" />
                          </TD>
                          <TD align="right">
                            {bet.totalPayout > 0 ? (
                              <Money value={bet.totalPayout} tone="prize" className="text-sm" />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TD>
                          <TD>
                            <BetStatusBadge status={bet.status} />
                          </TD>
                          <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(bet.createdAt)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>ธุรกรรมล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {transactions.length === 0 ? (
                <EmptyState title="ยังไม่มีธุรกรรม" />
              ) : (
                <TableWrap className="rounded-none border-0 border-t">
                  <Table>
                    <THead>
                      <TR>
                        <TH>ประเภท</TH>
                        <TH>รายละเอียด</TH>
                        <TH align="right">จำนวน</TH>
                        <TH align="right">ก่อน</TH>
                        <TH align="right">หลัง</TH>
                        <TH align="right">เวลา</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {transactions.map((tx) => (
                        <TR key={tx.id}>
                          <TD>
                            <TxTypeBadge type={tx.type} />
                          </TD>
                          <TD className="max-w-64">
                            <span className="line-clamp-1 text-sm">{tx.description}</span>
                          </TD>
                          <TD align="right">
                            <Money value={tx.amount} tone="auto" signed className="text-sm" />
                          </TD>
                          <TD align="right">
                            <Money value={tx.balanceBefore} tone="muted" className="text-sm" />
                          </TD>
                          <TD align="right">
                            <Money value={tx.balanceAfter} className="text-sm" />
                          </TD>
                          <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(tx.createdAt)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins">
          <Card>
            <CardHeader>
              <CardTitle>ประวัติการเข้าสู่ระบบ</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loginEvents.length === 0 ? (
                <EmptyState title="ยังไม่มีประวัติ" />
              ) : (
                <TableWrap className="rounded-none border-0 border-t">
                  <Table>
                    <THead>
                      <TR>
                        <TH>เวลา</TH>
                        <TH>IP</TH>
                        <TH>อุปกรณ์</TH>
                        <TH align="right">ผลลัพธ์</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {loginEvents.map((event) => (
                        <TR key={event.id}>
                          <TD className="tabular whitespace-nowrap text-sm">
                            {formatDateTime(event.createdAt)}
                          </TD>
                          <TD className="tabular text-sm">{event.ip}</TD>
                          <TD className="max-w-64">
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {event.userAgent}
                            </span>
                          </TD>
                          <TD align="right">
                            <Badge variant={event.success ? 'emerald' : 'danger'}>
                              {event.success ? 'สำเร็จ' : 'ล้มเหลว'}
                            </Badge>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>บันทึกการใช้งาน</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {audit.length === 0 ? (
                <EmptyState title="ยังไม่มีบันทึก" />
              ) : (
                <TableWrap className="rounded-none border-0 border-t">
                  <Table>
                    <THead>
                      <TR>
                        <TH>การกระทำ</TH>
                        <TH>ทรัพยากร</TH>
                        <TH>IP</TH>
                        <TH align="right">เวลา</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {audit.map((log) => (
                        <TR key={log.id}>
                          <TD className="tabular text-xs">{log.action}</TD>
                          <TD className="text-xs text-muted-foreground">
                            {log.resource}
                            {log.resourceId ? ` · ${log.resourceId}` : ''}
                          </TD>
                          <TD className="tabular text-xs">{log.ip}</TD>
                          <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
