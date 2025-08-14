
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const protectedRoutes = ['/read', '/profile'];
const publicRoutes = ['/', '/welcome'];
const adminRoutes = ['/admin']; // This now includes /admin and /admin/*

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await getSession();

  const isProtectedRoute = protectedRoutes.some((p) => path.startsWith(p));
  const isAdminRoute = adminRoutes.some((p) => path.startsWith(p));
  
  // If the user is not logged in and is trying to access any protected page
  if (!session?.userId && (isProtectedRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // If the user is logged in
  if (session?.userId) {
    // If they haven't set a username, force them to the welcome page
    // Allow access to /api for actions like setting the username
    if (!session.username && path !== '/welcome' && !path.startsWith('/api')) {
      return NextResponse.redirect(new URL('/welcome', req.nextUrl));
    }
    
    // If they have set a username but are trying to access the welcome page, redirect them
    if (session.username && path === '/welcome') {
      const url = session.isAdmin ? '/admin' : '/read';
      return NextResponse.redirect(new URL(url, req.nextUrl));
    }
    
    // If a logged-in user is on the login page, redirect them to their dashboard
    if (path === '/') {
      const url = session.isAdmin ? '/admin' : '/read';
      return NextResponse.redirect(new URL(url, req.nextUrl));
    }
    
    // If a regular user tries to access an admin route, redirect them
    if (isAdminRoute && !session.isAdmin) {
      return NextResponse.redirect(new URL('/read', req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|scripts/.*).*)'],
};
