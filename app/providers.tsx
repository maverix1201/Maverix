'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/contexts/ToastContext';
import PagePreloader from '@/components/PagePreloader';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <PagePreloader />
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}

