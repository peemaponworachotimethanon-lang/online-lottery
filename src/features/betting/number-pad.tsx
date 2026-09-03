'use client';

import * as React from 'react';
import { Dices, Repeat2, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  permutationVariants,
  randomNumber,
  repeatedDigitNumbers,
  reverseNumber,
  doorNumbers,
} from '@/lib/lottery-rules';
import type { BetTypeDto } from '@/types/dto';

/**
 * Quick-pick helpers.
 *
 * These are the shortcuts Thai players expect (กลับเลข, เลขตอง, เลขเบิ้ล, รูดหน้า/หลัง).
 * Each returns a list of numbers that the caller adds to the slip in one action,
 * which is what keeps a 10-number set to a single tap instead of ten.
 */
export function QuickPickBar({
  betType,
  currentNumber,
  onPick,
  onPickMany,
}: {
  betType: BetTypeDto;
  currentNumber: string;
  onPick: (value: string) => void;
  onPickMany: (values: string[]) => void;
}) {
  const complete = currentNumber.length === betType.digitLength;

  const actions: Array<{ label: string; icon: React.ReactNode; disabled: boolean; run: () => void }> = [
    {
      label: 'สุ่มเลข',
      icon: <Dices />,
      disabled: false,
      run: () => onPick(randomNumber(betType.digitLength)),
    },
    {
      label: 'กลับเลข',
      icon: <Repeat2 />,
      disabled: !complete || betType.digitLength < 2,
      run: () => {
        const variants =
          betType.digitLength === 2 ? [reverseNumber(currentNumber)] : permutationVariants(currentNumber);
        if (variants.length > 0) onPickMany(variants);
      },
    },
    {
      label: betType.digitLength === 3 ? 'เลขตอง' : 'เลขเบิ้ล',
      icon: <Sparkles />,
      disabled: betType.digitLength < 2,
      run: () => onPickMany(repeatedDigitNumbers(betType.digitLength)),
    },
    {
      label: 'รูดหน้า',
      icon: <Layers />,
      disabled: betType.digitLength !== 2 || currentNumber.length === 0,
      run: () => onPickMany(doorNumbers(currentNumber.slice(0, 1), 2, 'front')),
    },
    {
      label: 'รูดหลัง',
      icon: <Layers className="rotate-180" />,
      disabled: betType.digitLength !== 2 || currentNumber.length === 0,
      run: () => onPickMany(doorNumbers(currentNumber.slice(0, 1), 2, 'back')),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions
        .filter((action) => !(betType.digitLength === 1 && action.label !== 'สุ่มเลข'))
        .map((action) => (
          <Button
            key={action.label}
            variant="secondary"
            size="sm"
            disabled={action.disabled}
            onClick={action.run}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
    </div>
  );
}

/**
 * On-screen keypad for touch devices.
 * The native numeric keyboard is still available via `inputMode="numeric"`; this
 * pad exists so the input field never has to lose focus on mobile.
 */
export function TouchKeypad({
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
  submitLabel = 'เพิ่มลงโพย',
  submitDisabled,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:hidden">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <Button key={digit} variant="secondary" className="h-11 text-base" onClick={() => onDigit(digit)}>
          {digit}
        </Button>
      ))}
      <Button variant="ghost" className="h-11 text-xs" onClick={onClear}>
        ล้าง
      </Button>
      <Button variant="secondary" className="h-11 text-base" onClick={() => onDigit('0')}>
        0
      </Button>
      <Button variant="ghost" className="h-11 text-xs" onClick={onBackspace}>
        ลบ
      </Button>
      <Button className="col-span-3 h-11" disabled={submitDisabled} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
