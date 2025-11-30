'use client';

import { useState, Suspense, useEffect, useRef } from 'react';
import { signIn, useSession, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const redirectingRef = useRef(false);

  // Handle redirect after successful login
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !redirectingRef.current) {
      redirectingRef.current = true;
      const role = (session.user as any)?.role;
      const approved = (session.user as any)?.approved;

      if (!role) {
        window.location.href = '/';
        return;
      }

      // Redirect employees to waiting page only if explicitly not approved (false)
      if (role === 'employee' && approved === false) {
        window.location.href = '/employee/waiting';
        return;
      }

      const from = searchParams.get('from') || `/${role}`;
      window.location.href = from;
    }
  }, [session, status, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    redirectingRef.current = false;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // If signIn succeeded, manually refresh session and wait for it
      // This is more reliable in production than relying on automatic updates
      let sessionRetries = 8;
      let sessionData = null;

      while (sessionRetries > 0) {
        try {
          // Wait a bit for session to be established
          await new Promise(resolve => setTimeout(resolve, 400));
          
          // Update session to trigger refresh
          await update();
          
          // Try to get session
          sessionData = await getSession();
          
          if (sessionData?.user) {
            const role = (sessionData.user as any)?.role;
            const approved = (sessionData.user as any)?.approved;

            if (!role) {
              window.location.href = '/';
              return;
            }

            // Redirect employees to waiting page only if explicitly not approved (false)
            if (role === 'employee' && approved === false) {
              window.location.href = '/employee/waiting';
              return;
            }

            const from = searchParams.get('from') || `/${role}`;
            window.location.href = from;
            return;
          }
        } catch (sessionError) {
          console.error('Session fetch error:', sessionError);
        }
        
        sessionRetries--;
      }

      // If we still don't have a session after retries, use fallback redirect
      // This ensures the user isn't stuck on the login page
      const from = searchParams.get('from') || '/';
      window.location.href = from;
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-auth-pages flex items-center justify-center p-4 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/50 backdrop-blur-xl rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <p className="text-sm text-gray-600 font-secondary">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </motion.div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 text-gray-700 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition font-secondary"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-11 py-2.5 text-gray-700 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition font-secondary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed font-secondary"
          >
            {loading ? (
              'Signing in...'
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary-dark font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-auth-pages flex items-center justify-center p-4 relative">
        <div className="bg-white/50 backdrop-blur-xl rounded-lg shadow-xl p-6 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

