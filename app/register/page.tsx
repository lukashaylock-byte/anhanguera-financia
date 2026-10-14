import RegisterForm from './register-form';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationToken?: string | string[] }>;
}) {
  const params = await searchParams;
  const invitationToken = typeof params.invitationToken === 'string' ? params.invitationToken : '';
  return <RegisterForm invitationToken={invitationToken} />;
}
