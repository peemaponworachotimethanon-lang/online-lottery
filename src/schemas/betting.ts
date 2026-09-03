import { z } from 'zod';
import { SATANG_PER_BAHT } from '@/lib/money';

export const betItemInputSchema = z.object({
  betTypeCode: z.string().min(1, 'กรุณาเลือกประเภทการแทง'),
  number: z.string().regex(/^\d{1,3}$/, 'ตัวเลขไม่ถูกต้อง'),
  /** Stake in baht as entered by the user; converted to satang server-side. */
  stakeBaht: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' })
    .int('จำนวนเงินต้องเป็นจำนวนเต็มบาท')
    .min(1, 'ขั้นต่ำ 1 บาท')
    .max(1_000_000, 'จำนวนเงินสูงเกินไป'),
});
export type BetItemInput = z.infer<typeof betItemInputSchema>;

export const placeBetSchema = z.object({
  roundId: z.string().min(1),
  items: z
    .array(betItemInputSchema)
    .min(1, 'กรุณาเพิ่มรายการแทงอย่างน้อย 1 รายการ')
    .max(200, 'เพิ่มได้สูงสุด 200 รายการต่อครั้ง'),
  idempotencyKey: z.string().min(8).max(64),
});
export type PlaceBetInput = z.infer<typeof placeBetSchema>;

export const DEPOSIT_PRESETS_BAHT = [100, 300, 500, 1000, 3000, 5000] as const;

export const MIN_DEPOSIT_SATANG = 20 * SATANG_PER_BAHT;
export const MAX_DEPOSIT_SATANG = 200_000 * SATANG_PER_BAHT;
export const MIN_WITHDRAWAL_SATANG = 100 * SATANG_PER_BAHT;
export const MAX_WITHDRAWAL_SATANG = 200_000 * SATANG_PER_BAHT;

export const depositSchema = z.object({
  amountBaht: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' })
    .int('จำนวนเงินต้องเป็นจำนวนเต็มบาท')
    .min(MIN_DEPOSIT_SATANG / SATANG_PER_BAHT, `ฝากขั้นต่ำ ${MIN_DEPOSIT_SATANG / SATANG_PER_BAHT} บาท`)
    .max(MAX_DEPOSIT_SATANG / SATANG_PER_BAHT, 'เกินวงเงินฝากสูงสุดต่อรายการ'),
  method: z.enum(['qr', 'bank-transfer']),
  idempotencyKey: z.string().min(8).max(64),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawalSchema = z.object({
  amountBaht: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' })
    .int('จำนวนเงินต้องเป็นจำนวนเต็มบาท')
    .min(
      MIN_WITHDRAWAL_SATANG / SATANG_PER_BAHT,
      `ถอนขั้นต่ำ ${MIN_WITHDRAWAL_SATANG / SATANG_PER_BAHT} บาท`,
    )
    .max(MAX_WITHDRAWAL_SATANG / SATANG_PER_BAHT, 'เกินวงเงินถอนสูงสุดต่อรายการ'),
  bankName: z.string().min(2, 'กรุณาเลือกธนาคาร').max(60),
  bankAccountNumber: z.string().regex(/^[0-9-]{8,20}$/, 'รูปแบบเลขบัญชีไม่ถูกต้อง'),
  bankAccountName: z.string().min(2, 'กรุณากรอกชื่อบัญชี').max(80),
  idempotencyKey: z.string().min(8).max(64),
});
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
