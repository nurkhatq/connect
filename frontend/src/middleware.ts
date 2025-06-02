import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  // Защищенные маршруты
  const protectedPaths = ['/dashboard', '/tests', '/profile', '/application', '/notifications'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (isProtectedPath) {
    // В middleware мы не можем проверить localStorage, поэтому просто пропускаем
    // Проверка авторизации будет на клиенте
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/tests/:path*', '/profile/:path*', '/application/:path*', '/notifications/:path*']
};
