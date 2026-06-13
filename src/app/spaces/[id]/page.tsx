'use client';

import {
  ArrowLeft,
  Check,
  ClockIcon,
  FileText,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatTimeDifference } from '@/lib/utils';
import { SpaceIcon as SpaceIconType, SpaceWebSource, DBFile } from '@/lib/db/schema';
import EmojiPicker from '@/components/EmojiPicker';

interface SpaceChat {
  id: string;
  title: string;
  createdAt: string;
  spaceId: string | null;
}

interface Space {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  icon: SpaceIconType | null;
  useGlobalInstructions: boolean;
  defaultSourceScope: 'space' | 'web' | 'both';
  files: DBFile[];
  webSources: SpaceWebSource[];
  createdAt: string;
  updatedAt: string;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#78716c',
];

const SpaceIconDisplay = ({ icon, size = 'md' }: { icon: SpaceIconType | null; size?: 'sm' | 'md' | 'lg' }) => {
  const cls = size === 'lg' ? 'w-14 h-14 text-2xl' : size === 'sm' ? 'w-7 h-7 text-sm' : 'w-10 h-10 text-xl';
  if (!icon) return <div className={`${cls} rounded-xl bg-indigo-500/20`} />;
  if (icon.type === 'emoji') {
    return (
      <div className={`${cls} rounded-xl flex items-center justify-center bg-light-200 dark:bg-dark-200`}>
        {icon.value}
      </div>
    );
  }
  return <div className={`${cls} rounded-xl`} style={{ backgroundColor: icon.value }} />;
};

const SourceStatusBadge = ({ source, onRetry }: { source: SpaceWebSource; onRetry: () => void }) => {
  if (source.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
        <Loader2 size={11} className="animate-spin" />
        Indexing…
      </span>
    );
  }
  if (source.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Check size={11} />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500">
      <X size={11} />
      Failed
      <button
        onClick={onRetry}
        title={source.error || 'Retry'}
        className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/40 text-red-600 dark:text-red-400 transition text-xs"
      >
        <RefreshCw size={10} />
        Retry
      </button>
    </span>
  );
};

const Page = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [space, setSpace] = useState<Space | null>(null);
  const [chats, setChats] = useState<SpaceChat[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [descVal, setDescVal] = useState('');
  const [instructionsVal, setInstructionsVal] = useState('');
  const [useGlobalInstructions, setUseGlobalInstructions] = useState(true);
  const [defaultSourceScope, setDefaultSourceScope] = useState<'space' | 'web' | 'both'>('both');
  const [iconType, setIconType] = useState<'color' | 'emoji'>('color');
  const [iconColor, setIconColor] = useState('#6366f1');
  const [iconEmoji, setIconEmoji] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const [newUrl, setNewUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSpace = async () => {
    const res = await fetch(`/api/spaces/${id}`);
    if (!res.ok) { router.push('/spaces'); return; }
    const data = await res.json();
    setSpace(data.space);
    setChats(data.chats);

    if (!loading) return;
    setNameVal(data.space.name);
    setDescVal(data.space.description || '');
    setInstructionsVal(data.space.instructions || '');
    setUseGlobalInstructions(data.space.useGlobalInstructions);
    setDefaultSourceScope(data.space.defaultSourceScope);
    const icon = data.space.icon;
    if (icon?.type === 'emoji') { setIconType('emoji'); setIconEmoji(icon.value); }
    else { setIconType('color'); setIconColor(icon?.value || '#6366f1'); }
    setLoading(false);
  };

  useEffect(() => {
    fetchSpace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll every 2s while any source is pending.
  // Intentionally simple — natural candidate to replace with SSE status events in the future.
  useEffect(() => {
    if (!space) return;
    const hasPending = space.webSources.some((s) => s.status === 'pending');
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/spaces/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setSpace(data.space);
        const stillPending = (data.space.webSources as SpaceWebSource[]).some((s) => s.status === 'pending');
        if (!stillPending && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 2000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?.webSources]);

  const getEmbeddingModel = () => ({
    key: localStorage.getItem('embeddingModelKey') || '',
    providerId: localStorage.getItem('embeddingModelProviderId') || '',
  });

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      const icon =
        iconType === 'emoji' && iconEmoji.trim()
          ? { type: 'emoji' as const, value: iconEmoji.trim() }
          : { type: 'color' as const, value: iconColor };

      const res = await fetch(`/api/spaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal.trim(),
          description: descVal.trim() || null,
          instructions: instructionsVal.trim() || null,
          icon,
          useGlobalInstructions,
          defaultSourceScope,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Save failed'); return; }
      setSpace(data.space);
      setEditingName(false);
      toast.success('Saved');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setAddingUrl(true);
    try {
      const { key, providerId } = getEmbeddingModel();
      const res = await fetch(`/api/spaces/${id}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), embeddingModelKey: key, embeddingModelProviderId: providerId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Failed to add source'); return; }
      setSpace((prev) => prev ? { ...prev, webSources: [...prev.webSources, data.source] } : prev);
      setNewUrl('');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    const res = await fetch(`/api/spaces/${id}/sources`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message || 'Failed to remove source'); return; }
    setSpace((prev) => prev ? { ...prev, webSources: data.sources } : prev);
  };

  const handleRetrySource = async (sourceId: string) => {
    const { key, providerId } = getEmbeddingModel();
    const res = await fetch(`/api/spaces/${id}/sources`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, embeddingModelKey: key, embeddingModelProviderId: providerId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message || 'Failed to retry'); return; }
    setSpace((prev) =>
      prev ? { ...prev, webSources: prev.webSources.map((s) => s.id === sourceId ? { ...s, status: 'pending', error: null } : s) } : prev
    );
    toast.success('Re-indexing started');
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFiles(true);
    try {
      const { key, providerId } = getEmbeddingModel();
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      formData.append('embedding_model_key', key);
      formData.append('embedding_model_provider_id', providerId);

      const res = await fetch(`/api/spaces/${id}/files`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Upload failed'); return; }
      setSpace((prev) => prev ? { ...prev, files: data.files } : prev);
      toast.success('Files added to library');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    const res = await fetch(`/api/spaces/${id}/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message || 'Failed to remove file'); return; }
    setSpace((prev) => prev ? { ...prev, files: data.files } : prev);
  };

  const handleRemoveChat = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaceId: null }),
    });
    if (!res.ok) { toast.error('Failed to remove thread from space'); return; }
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-black/40 dark:text-white/40" size={32} />
      </div>
    );
  }

  if (!space) return null;

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 pt-8 pb-6 border-b border-light-200/20 dark:border-dark-200/20 px-2">
        <Link href="/spaces" className="p-2 rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 text-black/60 dark:text-white/60 transition">
          <ArrowLeft size={18} />
        </Link>
        <SpaceIconDisplay icon={space.icon} size="lg" />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                className="text-2xl font-semibold bg-transparent border-b border-[#24A0ED] outline-none w-full max-w-xs"
              />
              <button onClick={saveMeta} disabled={savingMeta} className="text-[#24A0ED] hover:opacity-70 transition">
                {savingMeta ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button onClick={() => { setEditingName(false); setNameVal(space.name); }} className="text-black/50 dark:text-white/50 hover:opacity-70 transition">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-semibold truncate">{space.name}</h1>
              <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-light-200 dark:hover:bg-dark-200 text-black/50 dark:text-white/50">
                <Pencil size={14} />
              </button>
            </div>
          )}
          {space.description && (
            <p className="text-sm text-black/60 dark:text-white/60 mt-0.5 truncate">{space.description}</p>
          )}
        </div>
        <Link
          href={`/?space=${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#24A0ED] text-white text-sm hover:bg-[#1a8fd4] transition"
        >
          <Plus size={14} />
          New Thread
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-2 pt-6">
        {/* Left column: Settings */}
        <div className="flex flex-col gap-6">
          {/* Icon picker */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <h2 className="font-semibold text-sm mb-3">Icon</h2>
            <div className="flex gap-2 mb-3">
              {(['color', 'emoji'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setIconType(t)}
                  className={`px-3 py-1 text-xs rounded-full border transition ${iconType === t ? 'bg-[#24A0ED] text-white border-[#24A0ED]' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60'}`}>
                  {t === 'color' ? 'Color' : 'Emoji'}
                </button>
              ))}
            </div>
            {iconType === 'color' ? (
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setIconColor(c)}
                    className={`w-7 h-7 rounded-lg transition ${iconColor === c ? 'ring-2 ring-offset-2 ring-[#24A0ED] dark:ring-offset-dark-primary' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            ) : (
              <EmojiPicker value={iconEmoji} onChange={setIconEmoji} />
            )}
          </section>

          {/* Overview */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <h2 className="font-semibold text-sm mb-3">Overview</h2>
            <textarea
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              rows={3}
              placeholder="Describe what this Space is for…"
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED] resize-none"
            />
          </section>

          {/* Custom Instructions */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <h2 className="font-semibold text-sm mb-1">Custom Instructions</h2>
            <p className="text-xs text-black/50 dark:text-white/50 mb-3">Injected after global instructions in every thread.</p>
            <textarea
              value={instructionsVal}
              onChange={(e) => {
                if (e.target.value.length <= 1500) setInstructionsVal(e.target.value);
              }}
              rows={8}
              placeholder="e.g. Always respond concisely. Prefer academic sources."
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED] resize-none leading-relaxed"
            />
            <p className={`text-xs mt-1.5 text-right ${instructionsVal.length >= 1400 ? 'text-orange-500' : 'text-black/40 dark:text-white/40'}`}>
              {instructionsVal.length} / 1,500
            </p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input type="checkbox" checked={useGlobalInstructions} onChange={(e) => setUseGlobalInstructions(e.target.checked)}
                className="rounded" />
              <span className="text-sm text-black/70 dark:text-white/70">Include global system instructions</span>
            </label>
          </section>

          {/* Source scope default */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <h2 className="font-semibold text-sm mb-1">Default Source Scope</h2>
            <p className="text-xs text-black/50 dark:text-white/50 mb-3">Default for new threads in this Space.</p>
            <div className="flex gap-2">
              {(['both', 'space', 'web'] as const).map((scope) => (
                <button key={scope} type="button" onClick={() => setDefaultSourceScope(scope)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition ${defaultSourceScope === scope ? 'bg-[#24A0ED] text-white border-[#24A0ED]' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60'}`}>
                  {scope === 'both' ? 'Both' : scope === 'space' ? 'Space files only' : 'Web only'}
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={saveMeta}
            disabled={savingMeta}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#24A0ED] text-white text-sm hover:bg-[#1a8fd4] disabled:opacity-50 transition"
          >
            {savingMeta ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
        </div>

        {/* Right column: Library + Threads */}
        <div className="flex flex-col gap-6">
          {/* Files */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Files ({space.files.length})</h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-light-200 dark:border-dark-200 hover:bg-light-secondary dark:hover:bg-dark-secondary disabled:opacity-50 transition"
              >
                {uploadingFiles ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Add files
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.docx" className="hidden" onChange={handleUploadFiles} />
            </div>
            {space.files.length === 0 ? (
              <p className="text-xs text-black/50 dark:text-white/50">No files yet. Add PDFs, text files, or Word docs.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {space.files.map((file) => (
                  <div key={file.fileId} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary group transition">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="shrink-0 text-black/50 dark:text-white/50" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <button onClick={() => handleRemoveFile(file.fileId)}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Web Sources */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Web Sources ({space.webSources.length})</h2>
            </div>
            <form onSubmit={handleAddUrl} className="flex gap-2 mb-3">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="flex-1 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
              />
              <button type="submit" disabled={addingUrl || !newUrl.trim()}
                className="px-3 py-2 rounded-lg bg-[#24A0ED] text-white text-sm hover:bg-[#1a8fd4] disabled:opacity-50 transition">
                {addingUrl ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </form>
            {space.webSources.length === 0 ? (
              <p className="text-xs text-black/50 dark:text-white/50">No sources yet. Paste a URL above to index it.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {space.webSources.map((src) => (
                  <div key={src.id} className="flex items-start justify-between gap-2 py-2 px-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary group transition">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Globe size={14} className="shrink-0 mt-0.5 text-black/50 dark:text-white/50" />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{src.title !== src.url ? src.title : src.url}</p>
                        {src.title !== src.url && <p className="text-xs text-black/40 dark:text-white/40 truncate">{src.url}</p>}
                        <div className="mt-0.5">
                          <SourceStatusBadge source={src} onRetry={() => handleRetrySource(src.id)} />
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveSource(src.id)}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Threads */}
          <section className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-5">
            <h2 className="font-semibold text-sm mb-3">Threads ({chats.length})</h2>
            {chats.length === 0 ? (
              <p className="text-xs text-black/50 dark:text-white/50">
                No threads yet.{' '}
                <Link href={`/?space=${id}`} className="text-sky-400 hover:underline">Start one</Link>.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {chats.map((chat) => (
                  <div key={chat.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary group transition">
                    <Link href={`/c/${chat.id}`} className="flex-1 min-w-0 text-sm truncate hover:text-[#24A0ED] transition">
                      {chat.title}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-black/40 dark:text-white/40 hidden group-hover:inline-flex items-center gap-1">
                        <ClockIcon size={10} />
                        {formatTimeDifference(new Date(), chat.createdAt)} ago
                      </span>
                      <button onClick={() => handleRemoveChat(chat.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition"
                        title="Remove from Space">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Page;
