import { z } from 'zod';

/**
 * Validation lives here once and is used by BOTH the client form (react-hook-form
 * + zodResolver) and the server action. There is deliberately no second copy of
 * these rules anywhere in the codebase.
 */

export const passwordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(72, 'รหัสผ่านยาวเกินไป')
  .regex(/[a-z]/, 'ต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว')
  .regex(/[A-Z]/, 'ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว')
  .regex(/[0-9]/, 'ต้องมีตัวเลขอย่างน้อย 1 ตัว');

export const usernameSchema = z
  .string()
  .min(4, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร')
  .max(24, 'ชื่อผู้ใช้ต้องไม่เกิน 24 ตัวอักษร')
  .regex(/^[a-zA-Z0-9_.]+$/, 'ใช้ได้เฉพาะ a-z, 0-9, จุด และขีดล่าง');

/** Thai mobile format: 0X-XXXX-XXXX, optionally with separators. */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^0[0-9]{8,9}$/, 'รูปแบบเบอร์โทรไม่ถูกต้อง (เช่น 0812345678)'));

export const emailSchema = z
  .string()
  .min(1, 'กรุณากรอกอีเมล')
  .email('รูปแบบอีเมลไม่ถูกต้อง')
  .transform((value) => value.trim().toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  remember: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'กรุณายอมรับเงื่อนไขการใช้งาน' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'รหัสผ่านไม่ตรงกัน',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'รหัสผ่านไม่ตรงกัน',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, 'กรุณากรอกชื่อที่แสดง').max(60),
  phone: phoneSchema,
  bankName: z.string().max(60),
  bankAccountName: z.string().max(80),
  bankAccountNumber: z
    .string()
    .max(20)
    .refine((value) => value === '' || /^[0-9-]{8,20}$/.test(value), 'รูปแบบเลขบัญชีไม่ถูกต้อง'),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateSettingsSchema = z.object({
  marketingOptIn: z.boolean(),
  twoFactorEnabled: z.boolean(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
