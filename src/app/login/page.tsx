'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/ui/Loader';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/');
      } else {
        setError(data.message || 'Login failed');
        setLoading(false);
      }
    } catch {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-primary dark:bg-dark-primary px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-normal font-['Instrument_Serif'] tracking-tight dark:text-white">
            <span className="text-[#24A0ED] italic font-['PP_Editorial']">Vane</span>
          </h1>
          <p className="text-black/60 dark:text-white/60 text-sm mt-2">
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 focus:border-[#24A0ED] transition-colors"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 focus:border-[#24A0ED] transition-colors"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-[0.98] transition-all duration-200 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader size="sm" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
