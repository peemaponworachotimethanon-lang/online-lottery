'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlayCircle, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InlineAlert } from '@/components/ui/feedback';
import { Field, NumericInput } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/datetime';
import {
  createResultAction,
  previewSettlementAction,
  settleRoundAction,
} from '@/server/actions/admin-actions';

export interface PendingRound {
  id: string;
  roundCode: string;
  lotteryName: string;
  closeAt: string;
  resultAt: string;
  hasResult: boolean;
  isSettled: boolean;
  top3: string | null;
  bottom2: string | null;
  betCount: number;
}

/**
 * Result entry + settlement.
 *
 * The flow is deliberately two explicit steps with a preview in between:
 *   1. enter and confirm the result (creates an immutable result row),
 *   2. run settlement, which pays winners.
 * Settlement is idempotent server-side, so a second run reports "already settled"
 * instead of paying twice — but the UI still gates it behind a confirmation.
 */
export function ResultConsole({ rounds }: { rounds: PendingRound[] }) {
  const router = useRouter();
  const [roundId, setRoundId] = React.useState(rounds[0]?.id ?? '');
  const [top3, setTop3] = React.useState('');
  const [bottom2, setBottom2] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [confirmResult, setConfirmResult] = React.useState(false);
  const [confirmSettle, setConfirmSettle] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    evaluated: number;
    winners: number;
    payout: number;
  } | null>(null);

  const round = rounds.find((candidate) => candidate.id === roundId);

  React.useEffect(() => {
    setPreview(null);
    setTop3(round?.top3 ?? '');
    setBottom2(round?.bottom2 ?? '');
  }, [round]);

  const resultValid = /^\d{3}$/.test(top3) && /^\d{2}$/.test(bottom2);

  const saveResult = async () => {
    setPending(true);
    const result = await createResultAction({ roundId, top3, bottom2 });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('บันทึกผลรางวัลแล้ว — ขั้นถัดไปคือเคลียร์รางวัล');
    setConfirmResult(false);
    router.refresh();
  };

  const runPreview = async () => {
    setPending(true);
    const result = await previewSettlementAction(roundId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPreview(result.data);
  };

  const settle = async () => {
    setPending(true);
    const result = await settleRoundAction(roundId, 'inline');
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if ('alreadySettled' in result.data && result.data.alreadySettled) {
      toast.info('งวดนี้ถูกเคลียร์รางวัลไปแล้ว ระบบไม่จ่ายซ้ำ');
    } else if ('betsEvaluated' in result.data) {
      toast.success(
        `เคลียร์รางวัลสำเร็จ · ตรวจ ${result.data.betsEvaluated} บิล · ถูกรางวัล ${result.data.betsWon} บิล`,
      );
    }
    setConfirmSettle(false);
    setPreview(null);
    router.refresh();
  };

  if (rounds.length === 0) {
    return (
      <InlineAlert tone="info">ยังไม่มีงวดที่ปิดรับแล้วและรอบันทึกผล</InlineAlert>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>ขั้นที่ 1 — บันทึกผลรางวัล</CardTitle>
          <CardDescription>
            เลข 2 ตัวบนคำนวณจาก 2 หลักท้ายของเลข 3 ตัวบนโดยอัตโนมัติ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="เลือกงวด" htmlFor="result-round">
            <Select value={roundId} onValueChange={setRoundId}>
              <SelectTrigger id="result-round">
                <SelectValue placeholder="เลือกงวด" />
              </SelectTrigger>
              <SelectContent>
                {rounds.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.lotteryName} · {candidate.roundCode}
                    {candidate.hasResult ? ' (มีผลแล้ว)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {round ? (
            <dl className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] bg-surface-muted p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">ปิดรับ</dt>
                <dd className="tabular font-medium">{formatDateTime(round.closeAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">เวลาออกผล</dt>
                <dd className="tabular font-medium">{formatDateTime(round.resultAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">จำนวนบิลในงวด</dt>
                <dd className="tabular font-medium">{round.betCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">สถานะ</dt>
                <dd className="font-medium">
                  {round.isSettled ? 'เคลียร์รางวัลแล้ว' : round.hasResult ? 'มีผลแล้ว รอเคลียร์' : 'รอบันทึกผล'}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field label="3 ตัวบน" htmlFor="result-top3">
              <NumericInput
                id="result-top3"
                maxDigits={3}
                value={top3}
                disabled={round?.hasResult}
                placeholder="000"
                className="h-12 text-center text-xl tracking-[0.3em]"
                onChange={(event) => setTop3(event.target.value)}
              />
            </Field>
            <Field label="2 ตัวล่าง" htmlFor="result-bottom2">
              <NumericInput
                id="result-bottom2"
                maxDigits={2}
                value={bottom2}
                disabled={round?.hasResult}
                placeholder="00"
                className="h-12 text-center text-xl tracking-[0.3em]"
                onChange={(event) => setBottom2(event.target.value)}
              />
            </Field>
          </div>

          {top3.length === 3 ? (
            <p className="text-xs text-muted-foreground">
              2 ตัวบนที่จะบันทึก: <span className="tabular font-medium">{top3.slice(1)}</span>
            </p>
          ) : null}

          <Button
            block
            disabled={!resultValid || pending || round?.hasResult}
            onClick={() => setConfirmResult(true)}
          >
            <Save /> {round?.hasResult ? 'งวดนี้มีผลรางวัลแล้ว' : 'บันทึกผลรางวัล'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ขั้นที่ 2 — เคลียร์รางวัล</CardTitle>
          <CardDescription>
            ตรวจสอบยอดที่จะจ่ายก่อน แล้วจึงยืนยัน การเคลียร์ซ้ำจะไม่จ่ายเงินซ้ำ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!round?.hasResult ? (
            <InlineAlert tone="warning">ต้องบันทึกผลรางวัลก่อนจึงจะเคลียร์รางวัลได้</InlineAlert>
          ) : round.isSettled ? (
            <InlineAlert tone="success">งวดนี้เคลียร์รางวัลเรียบร้อยแล้ว</InlineAlert>
          ) : null}

          <Button
            variant="outline"
            block
            disabled={!round?.hasResult || pending}
            onClick={() => void runPreview()}
          >
            <Sparkles /> ดูตัวอย่างผลการเคลียร์ (ไม่จ่ายเงิน)
          </Button>

          {preview ? (
            <dl className="grid grid-cols-3 gap-2 rounded-[var(--radius-control)] border border-border p-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">บิลที่ตรวจ</dt>
                <dd className="tabular text-lg font-semibold">{preview.evaluated}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">ถูกรางวัล</dt>
                <dd className="tabular text-lg font-semibold text-primary">{preview.winners}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">ยอดจ่าย</dt>
                <dd className="text-lg">
                  <Money value={preview.payout} tone="prize" className="font-semibold" />
                </dd>
              </div>
            </dl>
          ) : null}

          <Button
            block
            variant="gold"
            disabled={!round?.hasResult || round?.isSettled || pending}
            onClick={() => setConfirmSettle(true)}
          >
            <PlayCircle /> เคลียร์รางวัลและจ่ายเงิน
          </Button>

          <p className="text-xs text-muted-foreground">
            ในระบบจริง งวดขนาดใหญ่จะถูกส่งเข้าคิวประมวลผลเบื้องหลังแทนการรันใน HTTP request
            เดียว โครงสร้างรองรับไว้แล้ว (JobQueue: settle-round)
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmResult}
        onOpenChange={setConfirmResult}
        pending={pending}
        title="ยืนยันการบันทึกผลรางวัล"
        confirmLabel="บันทึกผล"
        description={
          <span className="block space-y-1">
            <span className="block">
              งวด <strong>{round?.roundCode}</strong> — 3 ตัวบน{' '}
              <strong className="tabular">{top3}</strong> · 2 ตัวบน{' '}
              <strong className="tabular">{top3.slice(1)}</strong> · 2 ตัวล่าง{' '}
              <strong className="tabular">{bottom2}</strong>
            </span>
            <span className="block text-xs">
              ผลรางวัลที่บันทึกแล้วไม่สามารถแก้ไขได้ กรุณาตรวจสอบตัวเลขให้ถูกต้อง
            </span>
          </span>
        }
        onConfirm={saveResult}
      />

      <ConfirmDialog
        open={confirmSettle}
        onOpenChange={setConfirmSettle}
        pending={pending}
        title="ยืนยันการเคลียร์รางวัล"
        confirmLabel="เคลียร์และจ่ายเงิน"
        description={
          <span className="block space-y-1">
            <span className="block">
              ระบบจะตรวจทุกบิลของงวด <strong>{round?.roundCode}</strong> และโอนเงินรางวัลเข้ากระเป๋าผู้ชนะ
            </span>
            {preview ? (
              <span className="block text-xs">
                คาดว่าจะจ่ายประมาณ <Money value={preview.payout} tone="prize" /> ให้ {preview.winners} บิล
              </span>
            ) : null}
          </span>
        }
        onConfirm={settle}
      />
    </div>
  );
}
