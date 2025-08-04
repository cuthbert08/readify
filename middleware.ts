import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './lib/session';

const protectedRoutes = ['/read'];
const publicRoutes = ['/'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

  const session = await getSession();

  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  if (
    isPublicRoute &&
    session?.userId &&
    !req.nextUrl.pathname.startsWith('/read')
  ) {
    return NextResponse.redirect(new URL('/read', req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
