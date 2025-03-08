'use client';

import { cn } from '@/lib/utils';
import { BookOpenText, Home, Search, SquarePen, Settings } from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import Layout from './Layout';

export type Preferences = {
  isLibraryEnabled: boolean;
  isDiscoverEnabled: boolean;
  isCopilotEnabled: boolean;
};

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col items-center gap-y-3 w-full">{children}</div>
  );
};

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      setLoading(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/config/preferences`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = await res.json();

      setPreferences(data);
      setLoading(false);
    };

    fetchPreferences();
  }, []);

  const navLinks = [
    {
      icon: Home,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: 'Home',
      show: true,
    },
    {
      icon: Search,
      href: '/discover',
      active: segments.includes('discover'),
      label: 'Discover',
      show: preferences?.isDiscoverEnabled,
    },
    {
      icon: BookOpenText,
      href: '/library',
      active: segments.includes('library'),
      label: 'Library',
      show: preferences?.isLibraryEnabled,
    },
  ];

  return loading ? (
    <div className="flex flex-row items-center justify-center h-full">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  ) : (
    <div>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-20 lg:flex-col">
        <div className="flex grow flex-col items-center justify-between gap-y-5 overflow-y-auto bg-light-secondary dark:bg-dark-secondary px-2 py-8">
          <a href="/">
            <SquarePen className="cursor-pointer" />
          </a>
          <VerticalIconContainer>
            {navLinks.map(
              (link, i) =>
                link.show === true && (
                  <Link
                    key={i}
                    href={link.href}
                    className={cn(
                      'relative flex flex-row items-center justify-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 duration-150 transition w-full py-2 rounded-lg',
                      link.active
                        ? 'text-black dark:text-white'
                        : 'text-black/70 dark:text-white/70',
                    )}
                  >
                    <link.icon />
                    {link.active && (
                      <div className="absolute right-0 -mr-2 h-full w-1 rounded-l-lg bg-black dark:bg-white" />
                    )}
                  </Link>
                ),
            )}
          </VerticalIconContainer>

          <Link href="/settings">
            <Settings className="cursor-pointer" />
          </Link>
        </div>
      </div>

      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-6 bg-light-primary dark:bg-dark-primary px-4 py-4 shadow-sm lg:hidden">
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center w-full',
              link.active
                ? 'text-black dark:text-white'
                : 'text-black dark:text-white/70',
            )}
          >
            {link.active && (
              <div className="absolute top-0 -mt-4 h-1 w-full rounded-b-lg bg-black dark:bg-white" />
            )}
            <link.icon />
            <p className="text-xs">{link.label}</p>
          </Link>
        ))}
      </div>

      <Layout>{children}</Layout>
    </div>
  );
};

export default Sidebar;
