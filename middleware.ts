import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth/signin', '/api/auth/login', '/api/auth/session', '/api/import'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthed = request.cookies.get('permit_session')?.value === 'permit-receptionist';

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = isAuthed ? '/dashboard' : '/auth/signin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!isPublic && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/auth/signin' && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
