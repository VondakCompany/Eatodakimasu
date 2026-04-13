import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Grab the User-Agent header from the incoming request
  const userAgent = request.headers.get('user-agent') || '';
  
  // 2. Check if the User-Agent matches common mobile device signatures
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);

  // 3. If they are on mobile AND trying to access the admin portal...
  if (isMobile && request.nextUrl.pathname.startsWith('/admin')) {
    
    // Rewrite the URL under the hood to a path that definitely doesn't exist.
    // This forces Next.js to render your standard 404 page without changing 
    // the URL in the user's browser bar. 
    request.nextUrl.pathname = '/404-not-found-override';
    return NextResponse.rewrite(request.nextUrl);
  }

  // Otherwise, let the request proceed normally
  return NextResponse.next();
}

// 4. Tell Next.js to ONLY run this middleware on the admin routes to save performance
export const config = {
  matcher: ['/admin/:path*'],
};