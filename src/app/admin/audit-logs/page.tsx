import { EmptyState } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { formatDateTime } from '@/lib/datetime';
import {
  readDateFrom,
  readDateTo,
  readPage,
  readPageSize,
  readParam,
  type RawSearchParams,
} from '@/lib/search-params';
import { requirePermission } from '@/server/context';
import { AUDIT_ACTIONS } from '@/services/audit-service';
import { getServices } from '@/services/container';

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission('audit.view');
  const params = await searchParams;

  const action = readParam(params, 'action');
  const search = readParam(params, 'q');
  const from = readDateFrom(params);
  const to = readDateTo(params);

  const logs = await getServices().repos.audit.findMany({
    ...(action ? { action } : {}),
    search,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page: readPage(params),
    pageSize: readPageSize(params),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="บันทึกการใช้งาน (Audit Log)"
        description="ทุกการกระทำที่กระทบเงินหรือสิทธิ์ จะถูกบันทึกพร้อมค่าก่อน–หลัง"
      />

      <AdminFilterBar
        searchValue={search}
        searchPlaceholder="ค้นหาจาก action, resource หรือ actor id"
        selects={[
          {
            key: 'action',
            label: 'ประเภทการกระทำ',
            value: action,
            options: Object.values(AUDIT_ACTIONS).map((value) => ({ value, label: value })),
          },
        ]}
        dateKeys={{
          from: 'from',
          to: 'to',
          fromValue: readParam(params, 'from'),
          toValue: readParam(params, 'to'),
        }}
      />

      {logs.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ไม่พบบันทึก" description="ลองปรับตัวกรองหรือช่วงวันที่" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>เวลา</TH>
                  <TH>ผู้กระทำ</TH>
                  <TH>การกระทำ</TH>
                  <TH>ทรัพยากร</TH>
                  <TH>ก่อน → หลัง</TH>
                  <TH align="right">IP</TH>
                </TR>
              </THead>
              <TBody>
                {logs.items.map((log) => (
                  <TR key={log.id}>
                    <TD className="tabular whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</TD>
                    <TD>
                      <span className="tabular block max-w-40 truncate text-xs">{log.actorId ?? 'system'}</span>
                      <Badge variant="neutral">{log.actorRole}</Badge>
                    </TD>
                    <TD className="tabular text-xs font-medium">{log.action}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {log.resource}
                      <span className="tabular block max-w-40 truncate">{log.resourceId ?? '—'}</span>
                    </TD>
                    <TD className="max-w-72">
                      <code className="line-clamp-2 block text-[11px] text-muted-foreground">
                        {JSON.stringify(log.before)} → {JSON.stringify(log.after)}
                      </code>
                    </TD>
                    <TD align="right" className="tabular text-xs text-muted-foreground">
                      {log.ip}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="px-4">
            <Pagination
              page={logs.page}
              pageCount={logs.pageCount}
              pageSize={logs.pageSize}
              total={logs.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
