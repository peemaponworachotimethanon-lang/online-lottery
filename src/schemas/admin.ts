import { z } from 'zod';
import { MATCH_STRATEGIES, ROLES } from '@/types/domain';

export const lotteryFormSchema = z.object({
  name: z.string().min(2, 'กรุณากรอกชื่อ').max(80),
  nameTh: z.string().min(2, 'กรุณากรอกชื่อภาษาไทย').max(80),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง'),
  country: z.string().min(2).max(60),
  countryCode: z.string().length(2, 'ใช้รหัสประเทศ 2 ตัวอักษร').toUpperCase(),
  timezone: z.string().min(3).max(60),
  description: z.string().max(400),
  status: z.enum(['active', 'inactive']),
  betTypeCodes: z.array(z.string()).min(1, 'เลือกอย่างน้อย 1 ประเภทการแทง'),
});
export type LotteryFormInput = z.infer<typeof lotteryFormSchema>;

export const roundFormSchema = z
  .object({
    lotteryId: z.string().min(1, 'กรุณาเลือกหวย'),
    roundCode: z.string().min(3, 'กรุณากรอกรหัสงวด').max(40),
    openAt: z.string().min(1, 'กรุณาระบุเวลาเปิด'),
    closeAt: z.string().min(1, 'กรุณาระบุเวลาปิด'),
    resultAt: z.string().min(1, 'กรุณาระบุเวลาออกผล'),
    status: z.enum(['scheduled', 'open', 'closed', 'resulted', 'settled', 'cancelled']),
  })
  .refine((data) => new Date(data.openAt) < new Date(data.closeAt), {
    path: ['closeAt'],
    message: 'เวลาปิดต้องหลังเวลาเปิด',
  })
  .refine((data) => new Date(data.closeAt) <= new Date(data.resultAt), {
    path: ['resultAt'],
    message: 'เวลาออกผลต้องไม่ก่อนเวลาปิด',
  });
export type RoundFormInput = z.infer<typeof roundFormSchema>;

export const betTypeFormSchema = z
  .object({
    name: z.string().min(2).max(60),
    nameTh: z.string().min(1).max(60),
    code: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/, 'ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง'),
    digitLength: z.number().int().min(1).max(3),
    matchStrategy: z.enum(MATCH_STRATEGIES),
    minBetBaht: z.number().int().min(1).max(100_000),
    maxBetBaht: z.number().int().min(1).max(1_000_000),
    maxPerNumberBaht: z.number().int().min(1).max(10_000_000),
    isActive: z.boolean(),
    description: z.string().max(200),
  })
  .refine((data) => data.minBetBaht <= data.maxBetBaht, {
    path: ['maxBetBaht'],
    message: 'ขั้นสูงต้องไม่น้อยกว่าขั้นต่ำ',
  });
export type BetTypeFormInput = z.infer<typeof betTypeFormSchema>;

export const payoutRateFormSchema = z.object({
  betTypeCode: z.string().min(1, 'กรุณาเลือกประเภทการแทง'),
  lotteryId: z.string().nullable(),
  /** Payout multiple as entered, e.g. 850 or 92.5. */
  rateX: z.number({ invalid_type_error: 'กรุณากรอกอัตราจ่าย' }).min(0.1).max(10_000),
  isActive: z.boolean(),
});
export type PayoutRateFormInput = z.infer<typeof payoutRateFormSchema>;

export const resultFormSchema = z.object({
  roundId: z.string().min(1, 'กรุณาเลือกงวด'),
  top3: z.string().regex(/^\d{3}$/, 'เลข 3 ตัวบนต้องเป็นตัวเลข 3 หลัก'),
  bottom2: z.string().regex(/^\d{2}$/, 'เลข 2 ตัวล่างต้องเป็นตัวเลข 2 หลัก'),
});
export type ResultFormInput = z.infer<typeof resultFormSchema>;

export const walletAdjustmentSchema = z.object({
  userId: z.string().min(1),
  /** Signed baht amount: positive credits, negative debits. */
  amountBaht: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' })
    .int('จำนวนเงินต้องเป็นจำนวนเต็มบาท')
    .refine((value) => value !== 0, 'จำนวนเงินต้องไม่เป็นศูนย์')
    .refine((value) => Math.abs(value) <= 1_000_000, 'เกินวงเงินปรับปรุงสูงสุด'),
  reason: z.string().min(5, 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร').max(200),
  idempotencyKey: z.string().min(8).max(64),
});
export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;

export const userStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['active', 'suspended', 'pending', 'closed']),
  reason: z.string().max(200),
});
export type UserStatusInput = z.infer<typeof userStatusSchema>;

export const userRolesSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1, 'ต้องมีอย่างน้อย 1 บทบาท'),
});
export type UserRolesInput = z.infer<typeof userRolesSchema>;

export const reviewSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(200),
  idempotencyKey: z.string().min(8).max(64),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const broadcastNotificationSchema = z.object({
  type: z.enum(['system', 'promotion']),
  title: z.string().min(3, 'กรุณากรอกหัวข้อ').max(80),
  body: z.string().min(3, 'กรุณากรอกเนื้อหา').max(400),
});
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
