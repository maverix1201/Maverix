import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const path = req.nextUrl.pathname;
    const isAuthPage = path.startsWith('/verify') || path.startsWith('/login');

    // Allow unauthenticated access to root (landing page) and login page
    if (path === '/' || path === '/login') {
      return null;
    }

    if (isAuthPage) {
      if (isAuth) {
        const role = (token as any)?.role;
        
        // Redirect authenticated users away from login/verify pages to their dashboard
        if (role === 'admin') {
          return NextResponse.redirect(new URL('/admin', req.url));
        } else if (role === 'hr') {
          return NextResponse.redirect(new URL('/hr', req.url));
        } else if (role === 'employee') {
          return NextResponse.redirect(new URL('/employee', req.url));
        }
      }
      return null;
    }

    if (!isAuth) {
      // Redirect unauthenticated users trying to access protected routes to landing page
      return NextResponse.redirect(new URL('/', req.url));
    }

    const role = (token as any)?.role;
    const approved = (token as any)?.approved;

    // Allow access to waiting page for unapproved employees only
    if (path === '/employee/waiting' && role === 'employee') {
      // If employee is approved (true or undefined/null treated as true), redirect them to dashboard
      if (approved !== false) {
        return NextResponse.redirect(new URL('/employee', req.url));
      }
      return null;
    }

    // Redirect unapproved employees trying to access employee dashboard
    // Only redirect if approved is explicitly false
    if (path.startsWith('/employee') && role === 'employee' && approved === false && path !== '/employee/waiting') {
      return NextResponse.redirect(new URL('/employee/waiting', req.url));
    }

    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL(`/${role}`, req.url));
    }

    if (path.startsWith('/hr') && role !== 'hr' && role !== 'admin') {
      return NextResponse.redirect(new URL(`/${role}`, req.url));
    }

    if (path.startsWith('/employee') && role !== 'employee' && role !== 'hr' && role !== 'admin') {
      return NextResponse.redirect(new URL(`/${role}`, req.url));
    }
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/hr/:path*', '/employee/:path*', '/verify', '/login', '/'],
};

