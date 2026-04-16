'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '@/components/ui/Loader';

interface Settings {
  search: {
    searxngURL?: string;
    [key: string]: any;
  };
  modelProviders: any[];
}

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [searxngURL, setSearxngURL] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setSearxngURL(d.settings?.search?.searxngURL || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: { searxngURL },
        }),
      });

      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to save settings');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SearXNG Settings */}
      <div className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-black dark:text-white mb-1">
          Search Settings
        </h3>
        <p className="text-xs text-black/50 dark:text-white/50 mb-4">
          Configure the SearXNG search instance
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
              SearXNG URL
            </label>
            <input
              type="url"
              value={searxngURL}
              onChange={(e) => setSearxngURL(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 text-black dark:text-white text-sm"
              placeholder="http://localhost:4000"
            />
            <p className="text-xs text-black/50 dark:text-white/50 mt-1">
              Leave empty to disable SearXNG search
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1e8fd1] disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* AI Model Providers */}
      <div className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-black dark:text-white mb-1">
          AI Model Providers
        </h3>
        <p className="text-xs text-black/50 dark:text-white/50 mb-4">
          Manage AI model provider configurations
        </p>

        {settings?.modelProviders && settings.modelProviders.length > 0 ? (
          <div className="space-y-3">
            {settings.modelProviders.map((provider: any) => (
              <div
                key={provider.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200"
              >
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">
                    {provider.name}
                  </p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {provider.chatModels?.length || 0} chat models,{' '}
                    {provider.embeddingModels?.length || 0} embedding models
                  </p>
                </div>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  Active
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            No AI model providers configured.
          </p>
        )}

        <p className="text-xs text-black/50 dark:text-white/50 mt-3">
          To add or modify AI model providers, use the Settings dialog in the main app.
        </p>
      </div>
    </div>
  );
}
