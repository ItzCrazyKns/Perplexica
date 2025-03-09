'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        router.push('/');
      } else {
        setError('密码错误');
      }
    } catch (err) {
      setError('验证失败，请重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-primary dark:bg-dark-primary">
      <div className="w-full max-w-md p-8 space-y-6 bg-light-secondary dark:bg-dark-secondary rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">请输入访问密码</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-md bg-light-primary dark:bg-dark-primary"
              placeholder="输入密码"
              required
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            className="w-full p-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            确认
          </button>
        </form>
      </div>
    </div>
  );
}