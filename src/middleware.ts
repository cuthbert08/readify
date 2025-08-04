
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const protectedRoutes = ['/read', '/admin'];
const publicRoutes = ['/'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await getSession();

  const isProtectedRoute = protectedRoutes.some((p) => path.startsWith(p));
  const isPublicRoute = publicRoutes.includes(path);

  // If the user is trying to access a protected route without a session,
  // redirect them to the login page.
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // If the user is logged in and tries to access a public-only route (like the login page),
  // redirect them to their appropriate dashboard.
  if (isPublicRoute && session?.userId) {
    const url = session.isAdmin ? '/admin' : '/read';
    return NextResponse.redirect(new URL(url, req.nextUrl));
  }
  
  // If the user is a regular user and tries to access an admin route, redirect them.
  if (path.startsWith('/admin') && session?.userId && !session.isAdmin) {
      return NextResponse.redirect(new URL('/read', req.nextUrl));
  }


  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|scripts/.*).*)'],
};
