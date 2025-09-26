'use client';

import React, { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import { cn } from '@/lib/utils';
import { Brain, Trash2, Shield, Clock, AlertCircle, BarChart3 } from 'lucide-react';

interface MemorySettings {
  id?: number;
  userId: string;
  memoryEnabled: boolean;
  retentionDays: number;
  maxMemories: number;
  autoCleanup: boolean;
  privacyLevel: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

interface MemoryStats {
  userId: string;
  totalMemories: number;
  userMemories: number;
  sessionMemories: number;
  chatMemories: number;
  lastCleanup?: string;
}

interface MemorySettingsProps {
  userId: string;
  onSettingsChange?: (settings: MemorySettings) => void;
}

const MemorySettings: React.FC<MemorySettingsProps> = ({ userId, onSettingsChange }) => {
  const [settings, setSettings] = useState<MemorySettings | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, [userId]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/memory/settings?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        onSettingsChange?.(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load memory settings');
      }
    } catch (error) {
      console.error('Failed to fetch memory settings:', error);
      setError('Failed to load memory settings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/memory/stats?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch memory stats:', error);
    }
  };

  const updateSetting = async (key: keyof MemorySettings, value: any) => {
    if (!settings) return;

    setSavingStates(prev => ({ ...prev, [key]: true }));

    try {
      const response = await fetch('/api/memory/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          [key]: value,
        }),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setSettings(updatedSettings);
        onSettingsChange?.(updatedSettings);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      setError('Failed to update setting');
    } finally {
      setSavingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const cleanupMemories = async () => {
    setSavingStates(prev => ({ ...prev, cleanup: true }));

    try {
      const response = await fetch('/api/memory/cleanup', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        fetchStats(); // Refresh stats after cleanup
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to cleanup memories');
      }
    } catch (error) {
      console.error('Failed to cleanup memories:', error);
      setError('Failed to cleanup memories');
    } finally {
      setSavingStates(prev => ({ ...prev, cleanup: false }));
    }
  };

  const deleteAllMemories = async () => {
    if (!confirm('Are you sure you want to delete all your memories? This action cannot be undone.')) {
      return;
    }

    setSavingStates(prev => ({ ...prev, deleteAll: true }));

    try {
      const response = await fetch(`/api/memory?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message);
        fetchStats(); // Refresh stats after deletion
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete memories');
      }
    } catch (error) {
      console.error('Failed to delete memories:', error);
      setError('Failed to delete memories');
    } finally {
      setSavingStates(prev => ({ ...prev, deleteAll: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#24A0ED]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center space-x-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">Memory service is not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Memory Status */}
      <div className="flex items-center justify-between p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-light-200 dark:bg-dark-200 rounded-lg">
            <Brain size={18} className="text-black/70 dark:text-white/70" />
          </div>
          <div>
            <p className="text-sm text-black/90 dark:text-white/90 font-medium">
              Memory System
            </p>
            <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
              Enable persistent memory across conversations
            </p>
          </div>
        </div>
        <Switch
          checked={settings.memoryEnabled}
          onChange={(checked) => updateSetting('memoryEnabled', checked)}
          className={cn(
            settings.memoryEnabled ? 'bg-[#24A0ED]' : 'bg-light-200 dark:bg-dark-200',
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none'
          )}
        >
          <span
            className={cn(
              settings.memoryEnabled ? 'translate-x-6' : 'translate-x-1',
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
            )}
          />
        </Switch>
      </div>

      {/* Memory Statistics */}
      {stats && (
        <div className="p-4 bg-light-secondary dark:bg-dark-secondary rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 size={18} className="text-black/70 dark:text-white/70" />
            <h3 className="text-sm font-medium text-black/90 dark:text-white/90">Memory Statistics</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-black/60 dark:text-white/60">Total Memories</p>
              <p className="text-lg font-semibold text-black/90 dark:text-white/90">{stats.totalMemories}</p>
            </div>
            <div>
              <p className="text-xs text-black/60 dark:text-white/60">User Memories</p>
              <p className="text-lg font-semibold text-black/90 dark:text-white/90">{stats.userMemories}</p>
            </div>
            <div>
              <p className="text-xs text-black/60 dark:text-white/60">Session Memories</p>
              <p className="text-lg font-semibold text-black/90 dark:text-white/90">{stats.sessionMemories}</p>
            </div>
            <div>
              <p className="text-xs text-black/60 dark:text-white/60">Chat Memories</p>
              <p className="text-lg font-semibold text-black/90 dark:text-white/90">{stats.chatMemories}</p>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Level */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Shield size={18} className="text-black/70 dark:text-white/70" />
          <h3 className="text-sm font-medium text-black/90 dark:text-white/90">Privacy Level</h3>
        </div>
        <div className="space-y-2">
          {(['high', 'medium', 'low'] as const).map((level) => (
            <label key={level} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 cursor-pointer">
              <input
                type="radio"
                name="privacyLevel"
                value={level}
                checked={settings.privacyLevel === level}
                onChange={() => updateSetting('privacyLevel', level)}
                className="w-4 h-4 text-[#24A0ED] border-gray-300 focus:ring-[#24A0ED]"
              />
              <div>
                <p className="text-sm text-black/90 dark:text-white/90 capitalize">{level} Privacy</p>
                <p className="text-xs text-black/60 dark:text-white/60">
                  {level === 'high' && 'Minimal data collection, maximum privacy'}
                  {level === 'medium' && 'Balanced data collection and privacy'}
                  {level === 'low' && 'Enhanced features with more data collection'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Retention Settings */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Clock size={18} className="text-black/70 dark:text-white/70" />
          <h3 className="text-sm font-medium text-black/90 dark:text-white/90">Retention Settings</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-black/70 dark:text-white/70 mb-1">
              Retention Days (0 = forever)
            </label>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.retentionDays}
              onChange={(e) => updateSetting('retentionDays', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 dark:text-white rounded-lg text-sm"
              disabled={savingStates.retentionDays}
            />
            <p className="text-xs text-black/60 dark:text-white/60 mt-1">
              How long to keep memories before automatic deletion
            </p>
          </div>

          <div>
            <label className="block text-sm text-black/70 dark:text-white/70 mb-1">
              Maximum Memories (0 = unlimited)
            </label>
            <input
              type="number"
              min="0"
              max="100000"
              value={settings.maxMemories}
              onChange={(e) => updateSetting('maxMemories', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 dark:text-white rounded-lg text-sm"
              disabled={savingStates.maxMemories}
            />
            <p className="text-xs text-black/60 dark:text-white/60 mt-1">
              Maximum number of memories to store per user
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
            <div>
              <p className="text-sm text-black/90 dark:text-white/90 font-medium">
                Automatic Cleanup
              </p>
              <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                Automatically clean up expired memories
              </p>
            </div>
            <Switch
              checked={settings.autoCleanup}
              onChange={(checked) => updateSetting('autoCleanup', checked)}
              className={cn(
                settings.autoCleanup ? 'bg-[#24A0ED]' : 'bg-light-200 dark:bg-dark-200',
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none'
              )}
            >
              <span
                className={cn(
                  settings.autoCleanup ? 'translate-x-6' : 'translate-x-1',
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
                )}
              />
            </Switch>
          </div>
        </div>
      </div>

      {/* Memory Management Actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-black/90 dark:text-white/90">Memory Management</h3>

        <div className="space-y-2">
          <button
            onClick={cleanupMemories}
            disabled={savingStates.cleanup}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-800/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 disabled:opacity-50"
          >
            {savingStates.cleanup ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            ) : (
              <Clock size={16} />
            )}
            <span>Clean Up Expired Memories</span>
          </button>

          <button
            onClick={deleteAllMemories}
            disabled={savingStates.deleteAll}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-800/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 disabled:opacity-50"
          >
            {savingStates.deleteAll ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
            ) : (
              <Trash2 size={16} />
            )}
            <span>Delete All Memories</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemorySettings;