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

  // If trying to access an admin route
  if (isAdminRoute) {
    if (!session?.isAdmin) {
      // If not an admin, redirect to the main app page or login
      const redirectUrl = session?.userId ? '/read' : '/';
      return NextResponse.redirect(new URL(redirectUrl, req.nextUrl));
    }
    // If admin, allow access
    return NextResponse.next();
  }

  // If trying to access a protected route for regular users
  if (isProtectedRoute && !session?.userId) {
    // If not logged in, redirect to login
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // If a logged-in user tries to access a public-only page (like the login page)
  if (isPublicRoute && session?.userId) {
    // Redirect them to their appropriate dashboard
    const url = session.isAdmin ? '/admin' : '/read';
    return NextResponse.redirect(new URL(url, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
