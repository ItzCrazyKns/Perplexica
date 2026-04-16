'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '@/components/ui/Loader';
import { useAuth } from '@/lib/hooks/useAuth';
import { X, UserPlus, RefreshCw, Pencil, Trash2 } from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export default function AdminUsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [resetPassword, setResetPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });

      if (res.ok) {
        toast.success('User created successfully');
        setShowCreateModal(false);
        setNewUsername('');
        setNewPassword('');
        setNewRole('user');
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to create user');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/users?id=${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editUsername, role: editRole }),
      });

      if (res.ok) {
        toast.success('User updated successfully');
        setShowEditModal(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to update user');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/users/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUserId, newPassword: resetPassword }),
      });

      if (res.ok) {
        toast.success('Password reset successfully');
        setShowResetModal(false);
        setResetUserId(null);
        setResetPassword('');
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to reset password');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' });

      if (res.ok) {
        toast.success('User deleted successfully');
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to delete user');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditRole(user.role);
    setShowEditModal(true);
  };

  const openResetModal = (userId: string) => {
    setResetUserId(userId);
    setResetPassword('');
    setShowResetModal(false);
    setTimeout(() => setShowResetModal(true), 50);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-black dark:text-white">
          Users ({users.length})
        </h2>
        <button
          onClick={() => {
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1e8fd1] transition-colors"
        >
          <UserPlus size={16} />
          Add User
        </button>
      </div>

      <div className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-light-200 dark:border-dark-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide">
                Username
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide">
                Role
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-200 dark:divide-dark-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-sm text-black dark:text-white">
                  {u.username}
                  {u.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-[#24A0ED]">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-2 rounded-lg hover:bg-light-primary dark:hover:bg-dark-primary transition-colors text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white"
                      title="Edit user"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => openResetModal(u.id)}
                      className="p-2 rounded-lg hover:bg-light-primary dark:hover:bg-dark-primary transition-colors text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white"
                      title="Reset password"
                    >
                      <RefreshCw size={16} />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-black/50 dark:text-white/50 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
            Create New User
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                minLength={2}
                className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 text-sm hover:bg-light-primary dark:hover:bg-dark-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1e8fd1] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <Modal onClose={() => setShowEditModal(false)}>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
            Edit User: {editingUser.username}
          </h3>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                Username
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
                minLength={2}
                className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
                disabled={editingUser.id === currentUser?.id}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {editingUser.id === currentUser?.id && (
                <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                  You cannot change your own role.
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-lg border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 text-sm hover:bg-light-primary dark:hover:bg-dark-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1e8fd1] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <Modal onClose={() => { setShowResetModal(false); setResetUserId(null); }}>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
            Reset Password
          </h3>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
                placeholder="Enter new password"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetUserId(null); }}
                className="px-4 py-2 rounded-lg border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 text-sm hover:bg-light-primary dark:hover:bg-dark-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1e8fd1] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
