import { NextResponse } from 'next/server';
import { hashInvitationToken, isCompanyRole } from '@/lib/auth';
import { readInvitationEmail } from '@/lib/personal-data.mjs';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
      return NextResponse.json({ error: 'Este convite é inválido ou expirou.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: {
        email: true,
        emailEncrypted: true,
        emailLookupHash: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        company: { select: { name: true } },
      },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || !isCompanyRole(invitation.role)) {
      return NextResponse.json({ error: 'Este convite é inválido ou expirou.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      invitation: {
        email: readInvitationEmail(invitation),
        role: invitation.role,
        companyName: invitation.company.name,
        expiresAt: invitation.expiresAt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao verificar convite:', error);
    return NextResponse.json({ error: 'Não foi possível verificar o convite.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
