import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { backfillPersonalData } from '@/lib/personal-data-backfill.mjs';
import { validatePersonalDataEncryptionKey } from '@/lib/personal-data-crypto.mjs';

async function getEncryptionProgress() {
  const [usersWithPlaintext, invitationsWithPlaintext, usersWithoutCipher, invitationsWithoutCipher] = await Promise.all([
    prisma.user.count({ where: { OR: [{ fullName: { not: null } }, { email: { not: null } }, { cpf: { not: null } }, { birthDate: { not: null } }] } }),
    prisma.invitation.count({ where: { email: { not: null } } }),
    prisma.user.count({ where: { OR: [{ fullNameEncrypted: null }, { emailEncrypted: null }, { emailLookupHash: null }, { cpfEncrypted: null }, { cpfLookupHash: null }, { birthDateEncrypted: null }] } }),
    prisma.invitation.count({ where: { OR: [{ emailEncrypted: null }, { emailLookupHash: null }] } }),
  ]);

  return {
    usersWithPlaintext,
    invitationsWithPlaintext,
    usersWithoutCipher,
    invitationsWithoutCipher,
    finalized: usersWithPlaintext === 0 && invitationsWithPlaintext === 0 && usersWithoutCipher === 0 && invitationsWithoutCipher === 0,
  };
}

async function getAuthorizedAdmin() {
  const user = await getAuthenticatedUser();
  if (!user) return { response: NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 }) };
  if (user.workspaceType !== 'EMPRESA' || user.role !== 'ADMINISTRADOR') {
    return { response: NextResponse.json({ error: 'Somente administradores de uma empresa podem consultar ou finalizar a criptografia.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const authorization = await getAuthorizedAdmin();
    if ('response' in authorization) return authorization.response;

    try {
      validatePersonalDataEncryptionKey();
    } catch {
      return NextResponse.json({
        error: 'A chave de criptografia está ausente ou inválida na configuração da implantação.',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    const progress = await getEncryptionProgress();
    return NextResponse.json({
      keyConfigured: true,
      migrationReady: true,
      ...progress,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao verificar a preparação da criptografia dos dados pessoais:', error);
    return NextResponse.json({
      error: 'Não foi possível confirmar a migração e o estado da criptografia. Nenhum dado foi alterado.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await getAuthorizedAdmin();
    if ('response' in authorization) return authorization.response;

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: 'Confirme o backup restaurável e a cópia segura da chave antes de continuar.' }, { status: 400 });
    }
    if (typeof input !== 'object' || input === null || !('backupConfirmed' in input) || input.backupConfirmed !== true) {
      return NextResponse.json({ error: 'Confirme o backup restaurável e a cópia segura da chave antes de continuar.' }, { status: 400 });
    }

    try {
      validatePersonalDataEncryptionKey();
    } catch {
      return NextResponse.json({ error: 'A chave de criptografia está ausente ou inválida. Nenhum dado foi alterado.' }, { status: 503 });
    }

    const counts = await backfillPersonalData(prisma, { clearPlaintext: true });
    const progress = await getEncryptionProgress();
    if (!progress.finalized) {
      console.error('Personal-data encryption finalization needs another pass:', {
        usersWithPlaintext: progress.usersWithPlaintext,
        invitationsWithPlaintext: progress.invitationsWithPlaintext,
        usersWithoutCipher: progress.usersWithoutCipher,
        invitationsWithoutCipher: progress.invitationsWithoutCipher,
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
