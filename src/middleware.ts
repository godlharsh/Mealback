import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public asset and API paths to ignore
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return response;
  }

  // Auth pages (login / signup)
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage && user) {
    // If user already logged in, route to appropriate dashboard based on user metadata or default
    const role = user.user_metadata?.role || 'student';
    if (role === 'mess') {
      return NextResponse.redirect(new URL('/mess', request.url));
    } else if (role === 'buyer') {
      return NextResponse.redirect(new URL('/buyer/tokens', request.url));
    } else {
      return NextResponse.redirect(new URL('/student', request.url));
    }
  }

  // Protected route checking
  const isStudentRoute = pathname.startsWith('/student');
  const isBuyerRoute = pathname.startsWith('/buyer');
  const isMessRoute = pathname.startsWith('/mess');

  if (isStudentRoute || isBuyerRoute || isMessRoute) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = user.user_metadata?.role;

    if (isMessRoute && role !== 'mess') {
      return NextResponse.redirect(new URL('/marketplace', request.url));
    }

    if (isStudentRoute && role !== 'student') {
      return NextResponse.redirect(new URL('/marketplace', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
