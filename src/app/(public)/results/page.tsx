import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { ResultsFilter } from '@/features/lottery/results-filter';
import { getServices } from '@/services/container';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'ผลรางวัลย้อนหลัง',
  description: 'ตรวจผลรางวัลหวยทุกประเภทย้อนหลัง กรองตามหวยและวันที่ได้',
  openGraph: {
    title: 'ผลรางวัลย้อนหลัง',
    description: 'ตรวจผลรางวัลหวยทุกประเภทย้อนหลัง',
  },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function ResultsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const services = getServices();

  const lotteryId = readParam(params, 'lottery');
  const dateKey = readParam(params, 'date');
  const page = Number(readParam(params, 'page')) || 1;
  const pageSize = Number(readParam(params, 'pageSize')) || 20;

  const [lotteries, results] = await Promise.all([
    services.repos.lotteries.list({ includeInactive: true }),
    services.catalog.findResults({
      ...(lotteryId ? { lotteryId } : {}),
      ...(dateKey ? { dateKey } : {}),
      page,
      pageSize,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <PageHeader
        title="ผลรางวัลย้อนหลัง"
        description="กรองตามหวยและวันที่ เวลาที่แสดงเป็นเวลาไทย (Asia/Bangkok)"
      />

      <ResultsFilter
        lotteries={lotteries.map((lottery) => ({ id: lottery.id, name: lottery.nameTh }))}
        selectedLottery={lotteryId}
        selectedDate={dateKey}
      />

      {results.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            title="ไม่พบผลรางวัลตามเงื่อนไขที่เลือก"
            description="ลองเปลี่ยนหวยหรือวันที่ แล้วค้นหาอีกครั้ง"
          />
        </div>
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>หวย</TH>
                  <TH>งวด</TH>
                  <TH align="center">3 ตัวบน</TH>
                  <TH align="center">2 ตัวบน</TH>
                  <TH align="center">2 ตัวล่าง</TH>
                  <TH align="right">ประกาศผล</TH>
                </TR>
              </THead>
              <TBody>
                {results.items.map((result) => (
                  <TR key={result.id}>
                    <TD>
                      <span className="font-medium">{result.lotteryNameTh}</span>
                      <span className="block text-xs text-muted-foreground">{result.lotteryName}</span>
                    </TD>
                    <TD className="text-xs text-muted-foreground">{result.roundCode}</TD>
                    <TD align="center">
                      <span className="tabular rounded-md border border-accent/35 bg-accent-soft px-2 py-1 font-semibold tracking-widest text-accent-foreground">
                        {result.top3}
                      </span>
                    </TD>
                    <TD align="center" className="tabular font-medium tracking-widest">
                      {result.top2}
                    </TD>
                    <TD align="center" className="tabular font-medium tracking-widest">
                      {result.bottom2}
                    </TD>
                    <TD align="right" className="tabular text-xs text-muted-foreground">
                      {formatDateTime(result.announcedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <Pagination
            page={results.page}
            pageCount={results.pageCount}
            pageSize={results.pageSize}
            total={results.total}
          />
        </>
      )}
    </div>
  );
}
