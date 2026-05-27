import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api/auth (authentication endpoint)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    '/((?!api/auth|_next|favicon.ico|robots.txt).*)',
  ],
};

export function middleware(request) {
  // Check if user is authenticated
  const authCookie = request.cookies.get('auth-token');
  const isAuthPage = request.nextUrl.pathname === '/login.html';
  
  // If accessing auth page, allow it
  if (isAuthPage) {
    return NextResponse.next();
  }
  
  // If no auth cookie and not on auth page, redirect to login
  if (!authCookie) {
    const loginUrl = new URL('/login.html', request.url);
    loginUrl.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify the auth token
  const expectedToken = process.env.AUTH_SECRET || 'default-secret-change-me';
  
  if (authCookie.value !== expectedToken) {
    const loginUrl = new URL('/login.html', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // User is authenticated, allow request
  return NextResponse.next();
}
