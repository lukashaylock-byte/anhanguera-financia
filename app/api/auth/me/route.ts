import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Erro ao consultar sessão:', error);
    return NextResponse.json({ error: 'Não foi possível validar sua sessão.' }, { status: 500 });
  }
}
