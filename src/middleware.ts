
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const protectedRoutes = ['/read'];
const publicRoutes = ['/'];
const adminRoutes = ['/admin'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await getSession();

  const isProtectedRoute = protectedRoutes.some((p) => path.startsWith(p));
  const isPublicRoute = publicRoutes.includes(path);
  const isAdminRoute = adminRoutes.some((p) => path.startsWith(p));
  
  // If the user is not logged in and is trying to access a protected page (admin or regular)
  if (!session?.userId && (isProtectedRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // If the user is logged in
  if (session?.userId) {
    // If they are on a public page (like the login page), redirect them to their dashboard
    if (isPublicRoute) {
        const url = session.isAdmin ? '/admin' : '/read';
        return NextResponse.redirect(new URL(url, req.nextUrl));
    }
    
    // If a regular user tries to access an admin route, redirect them to the user dashboard
    if (isAdminRoute && !session.isAdmin) {
        return NextResponse.redirect(new URL('/read', req.nextUrl));
    }
  }

  // Otherwise, allow the request to proceed
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|scripts/.*).*)'],
};
