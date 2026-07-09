import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function readAuthConfig() {
  const email = process.env.PERMIT_LOGIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('PERMIT_LOGIN_EMAIL must be configured.');
  }
  return {
    email,
    name: process.env.PERMIT_MANAGER_NAME || 'Receptionist',
    role: process.env.PERMIT_MANAGER_ROLE || 'Receptionist',
    dealershipName: process.env.NEXT_PUBLIC_DEALERSHIP_NAME || 'Caskinette Ford',
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('permit_session')?.value;
  const auth = readAuthConfig();

  if (session !== 'permit-receptionist') {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: 'permit-receptionist',
      email: auth.email,
      name: auth.name,
      role: auth.role,
      dealershipName: auth.dealershipName,
      organizationId: 'caskinette-ford',
    },
  });
}
