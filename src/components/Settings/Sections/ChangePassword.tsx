'use client';

import { useState } from 'react';
import { toast } from 'sonner';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to change password');
        return;
      }

      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <div>
        <h3 className="text-sm font-medium text-black dark:text-white mb-1">
          Change Password
        </h3>
        <p className="text-xs text-black/50 dark:text-white/50">
          Update your account password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            minLength={1}
            className="w-full px-3 py-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 transition-colors"
            placeholder="Enter current password"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 transition-colors"
            placeholder="Enter new password"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#24A0ED]/50 transition-colors"
            placeholder="Confirm new password"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1e8fd1] active:scale-[0.98] transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;
