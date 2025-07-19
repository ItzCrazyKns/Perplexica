'use client';

import { useSelectedLayoutSegments } from 'next/navigation';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const isDashboard = segments.includes('dashboard');

  return (
    <main className="lg:pl-20 bg-light-primary dark:bg-dark-primary min-h-screen">
      <div className={isDashboard ? "mx-4" : "max-w-screen-lg lg:mx-auto mx-4"}>
        {children}
      </div>
    </main>
  );
};

export default Layout;
