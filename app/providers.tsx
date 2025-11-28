'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/contexts/ToastContext';
import PagePreloader from '@/components/PagePreloader';
import PWARegistration from '@/components/PWARegistration';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <PagePreloader />
        <PWARegistration />
        <PWAInstallPrompt />
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}

