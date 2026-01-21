'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/contexts/ToastContext';
import dynamic from 'next/dynamic';

// These are non-critical to initial route render; load them lazily.
const PagePreloader = dynamic(() => import('@/components/PagePreloader'), { ssr: false });
const PushNotificationManager = dynamic(() => import('@/components/PushNotificationManager'), { ssr: false });
const GlobalNotificationListener = dynamic(() => import('@/components/GlobalNotificationListener'), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <PushNotificationManager />
        <GlobalNotificationListener />
        <PagePreloader />
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}

