'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Loader from '@/components/ui/Loader';
import LoginPage from '@/components/auth/LoginPage';
import SetupWrapper from '@/components/Setup/SetupWrapper';
import Sidebar from '@/components/Sidebar';
import { ChatProvider } from '@/lib/hooks/useChat';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  const isAuthRoute = pathname?.startsWith('/login');
  const isSetupRoute = pathname?.startsWith('/setup');

  useEffect(() => {
    // Check if setup is complete
    fetch('/api/auth/setup-status')
      .then((r) => r.json())
      .then((d) => setSetupComplete(d.setupComplete))
      .catch(() => {
        // Fail closed - if we can't verify setup status, treat as incomplete
        console.error('Failed to fetch setup status');
        setSetupComplete(false);
      });
  }, []);

  if (loading || setupComplete === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  // If setup not complete → redirect to /setup for first-time setup
  // (must check before login redirect so first-time users see setup wizard)
  if (!setupComplete) {
    // Redirect to /setup if not already there
    if (!isSetupRoute) {
      window.location.href = '/setup';
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader />
        </div>
      );
    }
    return <SetupWrapper />;
  }

  // Not logged in → login page (unless already on login)
  if (!user && !isAuthRoute) {
    return <LoginPage />;
  }

  // Setup complete and logged in → show main app
  return (
    <ChatProvider>
      <Sidebar>{children}</Sidebar>
    </ChatProvider>
  );
}
