import { NextResponse } from 'next/server';
import { hashInvitationToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    if (token.length < 32 || token.length > 128) return NextResponse.json({ error: 'O link do convite é inválido.' }, { status: 400 });
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: { email: true, role: true, expiresAt: true, acceptedAt: true, company: { select: { name: true } } },
    });
    if (!invitation || invitation.acceptedAt) return NextResponse.json({ error: 'Este convite não está mais disponível.' }, { status: 404 });
    if (invitation.expiresAt <= new Date()) return NextResponse.json({ error: 'Este convite expirou. Peça ao administrador para enviar outro.' }, { status: 410 });
    return NextResponse.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        companyName: invitation.company.name,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('Erro ao consultar convite:', error);
    return NextResponse.json({ error: 'Não foi possível validar o convite.' }, { status: 500 });
  }
}
