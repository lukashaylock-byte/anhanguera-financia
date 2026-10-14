import InvitationClient from './invitation-client';

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return <InvitationClient token={token} />;
}
