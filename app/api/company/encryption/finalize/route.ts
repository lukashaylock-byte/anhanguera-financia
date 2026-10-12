import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { backfillPersonalData } from '@/lib/personal-data-backfill.mjs';

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    if (user.workspaceType !== 'EMPRESA') return NextResponse.json({ error: 'Esta operação está disponível apenas em espaços empresariais.' }, { status: 403 });
    if (user.role !== 'ADMINISTRADOR') return NextResponse.json({ error: 'Somente administradores podem finalizar a criptografia.' }, { status: 403 });

    const counts = await backfillPersonalData(prisma, { clearPlaintext: true });
    const [usersWithPlaintext, invitationsWithPlaintext, usersWithoutCipher, invitationsWithoutCipher] = await Promise.all([
      prisma.user.count({ where: { OR: [{ fullName: { not: null } }, { email: { not: null } }, { cpf: { not: null } }, { birthDate: { not: null } }] } }),
      prisma.invitation.count({ where: { email: { not: null } } }),
      prisma.user.count({ where: { OR: [{ fullNameEncrypted: null }, { emailEncrypted: null }, { emailLookupHash: null }, { cpfEncrypted: null }, { cpfLookupHash: null }, { birthDateEncrypted: null }] } }),
      prisma.invitation.count({ where: { OR: [{ emailEncrypted: null }, { emailLookupHash: null }] } }),
    ]);
    if (usersWithPlaintext || invitationsWithPlaintext || usersWithoutCipher || invitationsWithoutCipher) {
      console.error('Personal-data encryption finalization needs another pass:', {
        usersWithPlaintext, invitationsWithPlaintext, usersWithoutCipher, invitationsWithoutCipher,
      });
      return NextResponse.json({ error: 'A migração ainda está sendo concluída. Tente novamente em instantes.' }, { status: 409 });
    }

    return NextResponse.json({
      message: 'Dados pessoais criptografados e cópias em texto puro removidas.',
      encrypted: counts,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao finalizar a criptografia dos dados pessoais:', error);
    return NextResponse.json({ error: 'Não foi possível finalizar a criptografia. Os dados permanecem preservados; tente novamente.' }, { status: 500 });
  }
}
