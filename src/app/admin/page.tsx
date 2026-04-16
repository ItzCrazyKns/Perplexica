'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Loader from '@/components/ui/Loader';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      setAccessDenied(true);
    }
  }, [user]);

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-semibold text-black dark:text-white mb-2">
          Access Denied
        </h1>
        <p className="text-black/60 dark:text-white/60">
          You do not have permission to access this page.
        </p>
        <a
          href="/"
          className="mt-4 px-4 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1e8fd1] transition-colors"
        >
          Go Home
        </a>
      </div>
    );
  }

  if (!user) {
    // user is null means unauthenticated (not loading)
    // Redirect to home
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="max-w-screen-lg mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          Admin Panel
        </h1>
        <p className="text-black/60 dark:text-white/60 text-sm mt-1">
          Manage users and system settings
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-light-secondary dark:bg-dark-secondary p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-light-primary dark:bg-dark-primary text-black dark:text-white shadow-sm'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
          }`}
        >
          User Management
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-light-primary dark:bg-dark-primary text-black dark:text-white shadow-sm'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
          }`}
        >
          Settings
        </button>
      </div>

      {activeTab === 'users' && <AdminUsersTab />}
      {activeTab === 'settings' && <AdminSettingsTab />}
    </div>
  );
}
