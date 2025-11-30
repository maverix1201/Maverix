'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, Sparkles, LogOut } from 'lucide-react';
import Image from 'next/image';
import Logo from '@/components/Logo';
import LoadingDots from '@/components/LoadingDots';

export default function EmployeeWaitingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut({ callbackUrl: '/', redirect: true });
    } catch (error) {
      console.error('Logout error:', error);
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    // Check if employee is already approved (from session)
    // Only show waiting page if approved is explicitly false
    const approved = (session?.user as any)?.approved;
    if (approved === true) {
      router.push('/employee');
      return;
    }
    // For undefined/null, check the database to be sure
    if (approved !== false) {
      // Check immediately to see if they're actually approved
      fetch('/api/employees/check-approval')
        .then((res) => res.json())
        .then((data) => {
          if (data.approved) {
            router.push('/employee');
          }
        })
        .catch(() => {
          // If check fails, assume they need approval
        });
    }

    // Check approval status periodically for unapproved employees
    const checkApprovalStatus = async () => {
      try {
        setChecking(true);
        const res = await fetch('/api/employees/check-approval');
        const data = await res.json();

        if (res.ok && data.approved === true) {
          // Employee is approved, refresh session and redirect to dashboard
          // Trigger a session refresh by calling the session endpoint
          await fetch('/api/auth/session', { method: 'GET', cache: 'no-store' });
          // Small delay to allow session refresh
          setTimeout(() => {
            router.push('/employee');
            router.refresh();
          }, 300);
        }
      } catch (err) {
        console.error('Error checking approval status:', err);
      } finally {
        setChecking(false);
      }
    };

    // Check immediately
    checkApprovalStatus();

    // Check every 5 seconds
    const interval = setInterval(checkApprovalStatus, 5000);

    return () => clearInterval(interval);
  }, [status, router, mounted, session]);

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingDots size="lg" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400/20 rounded-full"
            style={{
              left: `${(i * 5) % 100}%`,
              top: `${(i * 7) % 100}%`,
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + i * 0.2,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative p-6 md:p-8 max-w-lg w-full "
      >

        {/* Logo at top */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <Logo size="md" />
        </motion.div>

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h1 className="text-2xl md:text-3xl font-primary font-bold text-gray-800 mb-2">
            Welcome, {session?.user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-sm text-gray-600 font-secondary mb-5">
            {session?.user?.email}
          </p>
        </motion.div>

        {/* Info Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50 rounded-lg p-3 text-center w-[300px] mx-auto"
        >
          <p className="text-xs text-gray-700 font-secondary flex items-center justify-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            You&apos;ll be redirected automatically once ready
          </p>
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <div className="relative">
            <Image
              src="/assets/waitingapproval.png"
              alt="Waiting for approval"
              width={300}
              height={300}
              className="object-contain"
              priority
              unoptimized
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </motion.div>
          </div>
        </motion.div>


        {/* Main Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-6"
        >
          <h2 className="text-xl md:text-2xl font-primary font-bold text-gray-800 mb-2">
            Your dashboard is being built
          </h2>
          <p className="text-sm text-gray-600 font-secondary">
            Please wait while we set up your personalized workspace
          </p>
        </motion.div>

        {/* Loading Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-3 mb-6"
        >
          <div className="flex items-center justify-center gap-2">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 bg-blue-500 rounded-full"
            />
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
              className="w-2 h-2 bg-purple-500 rounded-full"
            />
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
              className="w-2 h-2 bg-pink-500 rounded-full"
            />
          </div>
          {checking && (
            <p className="text-xs text-gray-500 font-secondary flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking approval status...
            </p>
          )}
        </motion.div>
        
      </motion.div>
      {/* Logout Button - Top Right */}
      <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-4 mx-auto"
        >
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 bg-white/80 hover:bg-white border border-gray-200 rounded-lg transition-colors font-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </motion.div>
    </div>
  );
}

