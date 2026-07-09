import { NextResponse } from 'next/server';

function readAuthConfig() {
  const email = process.env.PERMIT_LOGIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PERMIT_LOGIN_PASSWORD;
  if (!email || !password) {
    throw new Error('PERMIT_LOGIN_EMAIL and PERMIT_LOGIN_PASSWORD must be configured.');
  }
  return {
    email,
    password,
    name: process.env.PERMIT_MANAGER_NAME || 'Receptionist',
    role: process.env.PERMIT_MANAGER_ROLE || 'Receptionist',
    dealershipName: process.env.NEXT_PUBLIC_DEALERSHIP_NAME || 'Caskinette Ford',
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const auth = readAuthConfig();

  if (email !== auth.email || password !== auth.password) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: 'permit-receptionist',
      email: auth.email,
      name: auth.name,
      role: auth.role,
      dealershipName: auth.dealershipName,
      organizationId: 'caskinette-ford',
    },
  });

  response.cookies.set('permit_session', 'permit-receptionist', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
