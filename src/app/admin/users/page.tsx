import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/stat-card';
import { UserStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { formatDateTime } from '@/lib/datetime';
import { ROLE_LABELS } from '@/lib/permissions';
import { readEnum, readPage, readPageSize, readParam, type RawSearchParams } from '@/lib/search-params';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';
import { ROLES } from '@/types/domain';

const STATUSES = ['active', 'suspended', 'pending', 'closed'] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission('user.view');
  const params = await searchParams;

  const search = readParam(params, 'q');
  const status = readEnum(params, 'status', STATUSES);
  const role = readEnum(params, 'role', ROLES);

  const users = await getServices().query.findUsers({
    search,
    status,
    role,
    page: readPage(params),
    pageSize: readPageSize(params),
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="จัดการผู้ใช้งาน"
        description={`ทั้งหมด ${users.total.toLocaleString('th-TH')} บัญชี`}
      />

      <AdminFilterBar
        searchValue={search}
        searchPlaceholder="ค้นหาจากชื่อผู้ใช้ อีเมล เบอร์โทร หรือ ID"
        selects={[
          {
            key: 'status',
            label: 'สถานะ',
            value: status === 'all' ? '' : status,
            options: STATUSES.map((value) => ({
              value,
              label:
                value === 'active'
                  ? 'ใช้งานปกติ'
                  : value === 'suspended'
                    ? 'ถูกระงับ'
                    : value === 'pending'
                      ? 'รอยืนยัน'
                      : 'ปิดบัญชี',
            })),
          },
          {
            key: 'role',
            label: 'บทบาท',
            value: role === 'all' ? '' : role,
            options: ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
          },
        ]}
      />

      {users.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            title="ไม่พบผู้ใช้ตามเงื่อนไข"
            description="ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา แล้วลองอีกครั้ง"
          />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>ผู้ใช้</TH>
                  <TH>ติดต่อ</TH>
                  <TH align="right">กระเป๋าเงิน</TH>
                  <TH>บทบาท</TH>
                  <TH>สถานะ</TH>
                  <TH align="right">สมัครเมื่อ</TH>
                  <TH align="right">เข้าล่าสุด</TH>
                  <TH align="right"></TH>
                </TR>
              </THead>
              <TBody>
                {users.items.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <span className="block text-sm font-medium">{user.username}</span>
                      <span className="tabular block text-xs text-muted-foreground">{user.id}</span>
                    </TD>
                    <TD>
                      <span className="block max-w-52 truncate text-sm">{user.email}</span>
                      <span className="tabular block text-xs text-muted-foreground">{user.phone}</span>
                    </TD>
                    <TD align="right">
                      <Money value={user.balance} className="block text-sm" />
                      {user.held > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          กัน <Money value={user.held} tone="muted" className="text-xs" />
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((userRole) => (
                          <Badge key={userRole} variant={userRole === 'user' ? 'neutral' : 'emerald'}>
                            {ROLE_LABELS[userRole]}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <UserStatusBadge status={user.status} />
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(user.createdAt)}
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                    </TD>
                    <TD align="right">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`ดูรายละเอียด ${user.username}`}>
                        <Link href={`/admin/users/${user.id}`}>
                          <ExternalLink />
                        </Link>
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="px-4">
            <Pagination
              page={users.page}
              pageCount={users.pageCount}
              pageSize={users.pageSize}
              total={users.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
