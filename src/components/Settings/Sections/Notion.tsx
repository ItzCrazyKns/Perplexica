'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, NotebookPen, Unplug } from 'lucide-react';
import { toast } from 'sonner';

interface NotionStatus {
  configured: boolean;
  connected: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
}

const Notion = ({
  _fields,
  _values,
}: {
  // The section is rendered by the settings dialogue with generic props;
  // it manages its own state through the /api/notion/* routes.
  _fields?: unknown[];
  _values?: Record<string, unknown>;
}) => {
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/notion/status');
      if (!res.ok) throw new Error('status request failed');
      setStatus((await res.json()) as NotionStatus);
    } catch (err) {
      console.error('Failed to load Notion connection status:', err);
      toast.error('Failed to load Notion connection status.');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connect = () => {
    setConnecting(true);
    window.location.href = '/api/notion/auth';
  };

  const disconnect = async () => {
    try {
      const res = await fetch('/api/notion/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('disconnect request failed');
      toast.success('Notion disconnected.');
      await fetchStatus();
    } catch (err) {
      console.error('Failed to disconnect Notion:', err);
      toast.error('Failed to disconnect Notion.');
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-black/40 dark:text-white/40" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
        <div className="space-y-3 lg:space-y-5">
          <div className="flex flex-row items-start space-x-3">
            <NotebookPen className="mt-0.5 h-4 w-4 text-black/60 dark:text-white/60" />
            <div>
              <h4 className="text-sm text-black dark:text-white">
                {status.connected ? status.workspaceName : 'Notion'}
              </h4>
              <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
                {status.connected
                  ? 'Connected. Read notes from chat with @Notion (writing arrives in a later update).'
                  : status.configured
                    ? 'Connect your Notion workspace to read notes in chat.'
                    : 'Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in the environment to enable the Notion connection.'}
              </p>
            </div>
          </div>

          {status.connected ? (
            <button
              onClick={disconnect}
              className="flex flex-row items-center space-x-2 rounded-lg border border-red-300/60 dark:border-red-500/40 px-4 py-2 text-xs text-red-500 transition duration-200 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95"
            >
              <Unplug className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={!status.configured || connecting}
              className="flex flex-row items-center space-x-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-white transition duration-200 hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Connect Notion</span>
            </button>
          )}
        </div>
      </section>

      <p className="px-1 text-[11px] text-black/40 dark:text-white/40">
        Notion is only active in conversations where you select or mention a
        page with @Notion. Connecting never grants access to pages you did not
        choose to share. Disconnecting only removes Vane's copy; also revoke the
        connection in Notion settings to fully remove access.
      </p>
    </div>
  );
};

export default Notion;
