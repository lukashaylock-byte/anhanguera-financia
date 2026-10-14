import type { Metadata } from 'next';
import ResetPasswordForm from './reset-password-form';

export const metadata: Metadata = {
  title: 'Redefinir senha | Anhanguera Financia',
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return <ResetPasswordForm token={token} />;
}
