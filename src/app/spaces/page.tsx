'use client';

import { LayoutGrid, Plus, Pencil, Trash2, ClockIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatTimeDifference } from '@/lib/utils';
import { SpaceIcon as SpaceIconType } from '@/lib/db/schema';
import EmojiPicker from '@/components/EmojiPicker';

interface Space {
  id: string;
  name: string;
  description: string | null;
  icon: SpaceIconType | null;
  chatCount: number;
  createdAt: string;
}

const SpaceIconDisplay = ({ icon }: { icon: SpaceIconType | null }) => {
  if (!icon) return <div className="w-10 h-10 rounded-xl bg-indigo-500/20" />;
  if (icon.type === 'emoji') {
    return (
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-light-200 dark:bg-dark-200">
        {icon.value}
      </div>
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-xl"
      style={{ backgroundColor: icon.value }}
    />
  );
};

const CreateSpaceModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (space: Space) => void;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [emojiInput, setEmojiInput] = useState('');
  const [iconType, setIconType] = useState<'color' | 'emoji'>('color');
  const [loading, setLoading] = useState(false);

  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#06b6d4', '#64748b', '#78716c',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const icon =
        iconType === 'emoji' && emojiInput.trim()
          ? { type: 'emoji' as const, value: emojiInput.trim() }
          : { type: 'color' as const, value: selectedColor };

      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, icon }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to create space');
        return;
      }
      onCreated({ ...data.space, chatCount: 0 });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-light-primary dark:bg-dark-primary rounded-2xl border border-light-200 dark:border-dark-200 p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">New Space</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
              placeholder="e.g. Research, Work, Personal"
            />
          </div>
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
              placeholder="What is this Space for?"
            />
          </div>
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">Icon</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setIconType('color')}
                className={`px-3 py-1 text-xs rounded-full border transition ${iconType === 'color' ? 'bg-[#24A0ED] text-white border-[#24A0ED]' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60'}`}
              >
                Color
              </button>
              <button
                type="button"
                onClick={() => setIconType('emoji')}
                className={`px-3 py-1 text-xs rounded-full border transition ${iconType === 'emoji' ? 'bg-[#24A0ED] text-white border-[#24A0ED]' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60'}`}
              >
                Emoji
              </button>
            </div>
            {iconType === 'color' ? (
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`w-7 h-7 rounded-lg transition ${selectedColor === c ? 'ring-2 ring-offset-2 ring-[#24A0ED] dark:ring-offset-dark-primary' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            ) : (
              <EmojiPicker value={emojiInput} onChange={setEmojiInput} />
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-light-200 dark:border-dark-200 hover:bg-light-secondary dark:hover:bg-dark-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[#24A0ED] text-white hover:bg-[#1a8fd4] disabled:opacity-50 transition"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Page = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const fetchSpaces = async () => {
      setLoading(true);
      const res = await fetch('/api/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data.spaces);
      }
      setLoading(false);
    };
    fetchSpaces();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Delete this Space? Threads will remain but lose their Space association.')) return;
    const res = await fetch(`/api/spaces/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSpaces((prev) => prev.filter((s) => s.id !== id));
      toast.success('Space deleted');
    } else {
      toast.error('Failed to delete space');
    }
  };

  return (
    <div>
      <div className="flex flex-col pt-10 border-b border-light-200/20 dark:border-dark-200/20 pb-6 px-2">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div className="flex items-center justify-center">
            <LayoutGrid size={45} className="mb-2.5" />
            <div className="flex flex-col">
              <h1
                className="text-5xl font-normal p-2 pb-0"
                style={{ fontFamily: 'PP Editorial, serif' }}
              >
                Spaces
              </h1>
              <div className="px-2 text-sm text-black/60 dark:text-white/60 text-center lg:text-left">
                Themed workspaces with custom instructions and libraries.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-black/60 dark:text-white/60 rounded-full border border-black/20 dark:border-white/20 px-2 py-0.5">
              <LayoutGrid size={14} />
              {loading ? 'Loading…' : `${spaces.length} ${spaces.length === 1 ? 'space' : 'spaces'}`}
            </span>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-[#24A0ED] text-white hover:bg-[#1a8fd4] transition"
            >
              <Plus size={14} />
              New Space
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={(space) => setSpaces((prev) => [space, ...prev])}
        />
      )}

      {loading ? (
        <div className="flex flex-row items-center justify-center min-h-[60vh]">
          <svg
            aria-hidden="true"
            className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-2 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
            <LayoutGrid className="text-black/70 dark:text-white/70" />
          </div>
          <p className="mt-2 text-black/70 dark:text-white/70 text-sm">No Spaces yet.</p>
          <p className="mt-1 text-black/70 dark:text-white/70 text-sm">
            <button onClick={() => setShowCreate(true)} className="text-sky-400 hover:underline">
              Create a Space
            </button>{' '}
            to group related threads with custom instructions.
          </p>
        </div>
      ) : (
        <div className="pt-6 pb-28 px-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <Link
                key={space.id}
                href={`/spaces/${space.id}`}
                className="group relative flex flex-col gap-3 p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
              >
                <div className="flex items-start justify-between">
                  <SpaceIconDisplay icon={space.icon} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/spaces/${space.id}`;
                      }}
                      className="p-1.5 rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 text-black/50 dark:text-white/50 transition"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(space.id, e)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-black/50 dark:text-white/50 hover:text-red-500 transition"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-base leading-snug group-hover:text-[#24A0ED] transition">
                    {space.name}
                  </h3>
                  {space.description && (
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60 line-clamp-2">
                      {space.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-black/50 dark:text-white/50 mt-auto">
                  <span>{space.chatCount} {space.chatCount === 1 ? 'thread' : 'threads'}</span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon size={11} />
                    {formatTimeDifference(new Date(), space.createdAt)} ago
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;
