import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/features/auth/register-form';
import { getCurrentUser } from '@/server/context';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก',
  description: 'สร้างบัญชีทดลองใช้งานแพลตฟอร์มหวยออนไลน์',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return <RegisterForm />;
}
