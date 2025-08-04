
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

  // Handle admin route access first and foremost
  if (isAdminRoute) {
    // If user is not an admin, redirect to login page
    if (!session?.isAdmin) {
      return NextResponse.redirect(new URL('/', req.nextUrl));
    }
    // If user is an admin, allow access
    return NextResponse.next();
  }

  // If a logged-in user (admin or not) tries to access a public-only page (like login)
  if (isPublicRoute && session?.userId) {
    // Redirect them to their appropriate dashboard
    const url = session.isAdmin ? '/admin' : '/read';
    return NextResponse.redirect(new URL(url, req.nextUrl));
  }
  
  // Handle protected routes for regular (non-admin) users
  if (isProtectedRoute && !session?.userId) {
    // If not logged in, redirect to login
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Allow all other requests to pass through
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|scripts/.*).*)'],
};
