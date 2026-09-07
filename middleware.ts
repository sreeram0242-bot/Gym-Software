import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect Superadmin routes (except login)
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    const isSuperadmin = request.cookies.get('is_superadmin')?.value === 'true';
    if (!isSuperadmin) {
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
  }

  // Protect Dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const activeGymId = request.cookies.get('active_gym_id')?.value;
    const isSuperadmin = request.cookies.get('is_superadmin')?.value === 'true';
    
    if (!activeGymId && !isSuperadmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/superadmin/:path*', '/dashboard/:path*'],
};
