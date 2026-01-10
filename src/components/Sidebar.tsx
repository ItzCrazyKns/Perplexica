'use client';

import { cn } from '@/lib/utils';
import {
  BookOpenText,
  Home,
  Search,
  SquarePen,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState, type ReactNode } from 'react';
import Layout from './Layout';
import ChatHistory from './ChatHistory';

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col items-center gap-y-3 w-full">{children}</div>
  );
};

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const navLinks = [
    {
      icon: Home,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: 'Home',
    },
    {
      icon: Search,
      href: '/discover',
      active: segments.includes('discover'),
      label: 'Discover',
    },
    {
      icon: BookOpenText,
      href: '/library',
      active: segments.includes('library'),
      label: 'Library',
    },
  ];

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  return (
    <div>
      <div
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 relative',
          isSidebarExpanded ? 'lg:w-72' : 'lg:w-20',
        )}
      >
        <div className="flex grow flex-col items-center justify-between gap-y-3 overflow-y-auto bg-light-secondary dark:bg-dark-secondary px-2 py-6">
          <div className="flex w-full items-center justify-center">
            <a
              href="/"
              className={cn(
                'flex items-center cursor-pointer hover:bg-black/15 dark:hover:bg-white/15 duration-150 transition rounded-lg p-2 relative group',
                isSidebarExpanded && 'justify-start px-3 w-full',
              )}
            >
              <SquarePen className="cursor-pointer" />
              {isSidebarExpanded && (
                <span className="ml-2 font-semibold">Perplexica</span>
              )}
              {!isSidebarExpanded && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  新建聊天
                </div>
              )}
            </a>
          </div>

          {isSidebarExpanded ? (
            <div className="w-full flex-grow overflow-hidden flex flex-col mt-5">
              <div className="flex flex-col space-y-0.5 w-full px-2 mb-2">
                {navLinks.map((link, i) => (
                  <Link
                    key={i}
                    href={link.href}
                    className={cn(
                      'flex flex-row items-center py-1.5 px-2.5 rounded-md transition-colors duration-200',
                      link.active
                        ? 'text-black dark:text-white bg-black/5 dark:bg-white/5'
                        : 'text-black/70 dark:text-white/70 hover:bg-black/15 dark:hover:bg-white/15',
                    )}
                  >
                    <link.icon size={16} />
                    <span className="ml-2.5 text-sm">{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="flex-grow overflow-y-auto mt-0.5 border-t border-black/10 dark:border-white/10 pt-2">
                <ChatHistory />
              </div>
            </div>
          ) : (
            <VerticalIconContainer>
              {navLinks.map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  className={cn(
                    'relative flex flex-row items-center justify-center cursor-pointer hover:bg-black/15 dark:hover:bg-white/15 duration-150 transition w-full py-3 rounded-lg group',
                    link.active
                      ? 'text-black dark:text-white'
                      : 'text-black/70 dark:text-white/70',
                  )}
                >
                  <link.icon />
                  {link.active && (
                    <div className="absolute right-0 -mr-2 h-full w-1 rounded-l-lg bg-black dark:bg-white" />
                  )}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    {link.label}
                  </div>
                </Link>
              ))}

              <button
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="relative flex flex-row items-center justify-center cursor-pointer hover:bg-black/15 dark:hover:bg-white/15 duration-150 transition w-full py-3 rounded-lg group text-black/70 dark:text-white/70"
              >
                <ChevronRight size={22} />
                <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  展开侧边栏
                </div>
              </button>
            </VerticalIconContainer>
          )}

          <div
            className={cn(
              'flex items-center w-full mt-auto pt-8 pb-2',
              isSidebarExpanded
                ? 'justify-start border-t border-black/10 dark:border-white/10 px-2 mt-6'
                : 'justify-center',
            )}
          >
            <Link
              href="/settings"
              className={cn(
                'flex items-center p-3 rounded-lg hover:bg-black/15 dark:hover:bg-white/15 transition-colors relative group',
                isSidebarExpanded
                  ? 'w-full justify-start gap-3'
                  : 'justify-center',
              )}
              title="Settings"
            >
              <Settings
                size={20}
                className="text-black/70 dark:text-white/70"
              />
              {isSidebarExpanded && (
                <span className="text-sm text-black/70 dark:text-white/70">
                  Settings
                </span>
              )}
              {!isSidebarExpanded && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  设置
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* Elegant circular collapse button at the edge */}
        {isSidebarExpanded && (
          <button
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="absolute -right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-dark-primary flex items-center justify-center shadow-lg border border-black/20 dark:border-white/20 z-50 transition-all duration-200 hover:shadow-xl hover:bg-sky-50 dark:hover:bg-sky-900/30"
            title="Collapse sidebar"
          >
            <ChevronLeft size={16} className="text-sky-500" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap">
              收起侧边栏
            </div>
          </button>
        )}
      </div>

      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-6 bg-light-primary dark:bg-dark-primary px-4 py-4 shadow-sm lg:hidden">
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center w-full group',
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
            <div className="absolute top-full mt-2 px-2 py-1 bg-black/80 dark:bg-white/90 text-white dark:text-black text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
              {link.label}
            </div>
          </Link>
        ))}
      </div>

      <div
        className={cn(
          'lg:pl-20 transition-all duration-300',
          isSidebarExpanded && 'lg:pl-72',
        )}
      >
        <Layout>{children}</Layout>
      </div>
    </div>
  );
};

export default Sidebar;
