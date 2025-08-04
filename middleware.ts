import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const protectedRoutes = ['/read'];
const publicRoutes = ['/'];
const adminRoutes = ['/admin'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(p => path.startsWith(p));
  const isPublicRoute = publicRoutes.includes(path);
  const isAdminRoute = adminRoutes.some(p => path.startsWith(p));

  const session = await getSession();

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }
  
  if (isAdminRoute) {
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/', req.nextUrl));
    }
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL('/read', req.nextUrl));
    }
  }

  if (
    isPublicRoute &&
    session?.userId &&
    !req.nextUrl.pathname.startsWith('/read')
  ) {
    // If admin, go to admin page, otherwise go to read page
    const url = session.isAdmin ? '/admin' : '/read';
    return NextResponse.redirect(new URL(url, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
