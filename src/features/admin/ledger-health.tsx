'use client';

import * as React from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { verifyLedgerAction } from '@/server/actions/admin-actions';

/**
 * Ledger integrity check.
 *
 * Asserts the core financial invariant — every wallet balance equals the sum of
 * its completed ledger rows — on demand. In production this is a scheduled
 * reconciliation job that alerts on drift; exposing it here makes the guarantee
 * visible during a demo instead of merely claimed.
 */
export function LedgerHealthCard() {
  const [state, setState] = React.useState<{
    consistent: boolean;
    balance: number;
    ledgerSum: number;
  } | null>(null);
  const [pending, setPending] = React.useState(false);

  const run = async () => {
    setPending(true);
    const result = await verifyLedgerAction();
    setPending(false);
    if (result.ok) setState(result.data);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>ตรวจสอบความถูกต้องของบัญชี</CardTitle>
          <CardDescription>
            ยอดเงินคงเหลือของทุกกระเป๋าต้องเท่ากับผลรวมรายการบัญชีที่สำเร็จเสมอ
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={pending} onClick={run}>
          <RefreshCw className={pending ? 'animate-spin' : undefined} />
          {pending ? 'กำลังตรวจสอบ…' : 'ตรวจสอบเดี๋ยวนี้'}
        </Button>
      </CardHeader>
      <CardContent>
        {state === null ? (
          <p className="text-sm text-muted-foreground">กดปุ่มเพื่อรันการตรวจสอบ</p>
        ) : state.consistent ? (
          <InlineAlert tone="success">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              ผ่าน — ยอดรวมกระเป๋า <Money value={state.balance} /> ตรงกับผลรวมรายการบัญชี
            </span>
          </InlineAlert>
        ) : (
          <InlineAlert tone="danger">
            <span className="flex items-center gap-2">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              ไม่ผ่าน — ยอดกระเป๋า <Money value={state.balance} /> ไม่ตรงกับผลรวมบัญชี{' '}
              <Money value={state.ledgerSum} />
            </span>
          </InlineAlert>
        )}
      </CardContent>
    </Card>
  );
}
