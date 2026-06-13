'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { LayoutGrid, X } from 'lucide-react';
import { toast } from 'sonner';
import { SpaceSummary } from '@/lib/hooks/useChat';

interface Space {
  id: string;
  name: string;
  icon: { type: 'emoji' | 'color'; value: string } | null;
}

interface MoveToSpaceProps {
  chatId: string;
  currentSpaceId: string | null;
  onMoved: (spaceId: string | null, spaceInfo: SpaceSummary | null) => void;
  buttonClassName?: string;
  popoverDirection?: 'up' | 'down';
}

const SpaceIconMini = ({ icon }: { icon: Space['icon'] }) => {
  if (!icon) return <div className="w-5 h-5 rounded bg-indigo-500/30" />;
  if (icon.type === 'emoji') {
    return (
      <span className="w-5 h-5 flex items-center justify-center text-sm leading-none">
        {icon.value}
      </span>
    );
  }
  return (
    <div className="w-5 h-5 rounded" style={{ backgroundColor: icon.value }} />
  );
};

const MoveToSpace = ({
  chatId,
  currentSpaceId,
  onMoved,
  buttonClassName,
  popoverDirection = 'down',
}: MoveToSpaceProps) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [movingTo, setMovingTo] = useState<string | null | 'remove'>(undefined as any);

  const fetchSpaces = async () => {
    if (spaces.length > 0) return;
    setLoadingSpaces(true);
    try {
      const res = await fetch('/api/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data.spaces);
      }
    } finally {
      setLoadingSpaces(false);
    }
  };

  const move = async (
    spaceId: string | null,
    close: () => void,
  ) => {
    setMovingTo(spaceId ?? 'remove');
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId }),
      });
      if (!res.ok) {
        toast.error('Failed to update thread');
        return;
      }
      const targetSpace = spaceId
        ? spaces.find((s) => s.id === spaceId) ?? null
        : null;
      const info: SpaceSummary | null = targetSpace
        ? { id: targetSpace.id, name: targetSpace.name, icon: targetSpace.icon }
        : null;
      onMoved(spaceId, info);
      close();
      toast.success(spaceId ? `Moved to ${targetSpace?.name}` : 'Removed from Space');
    } finally {
      setMovingTo(undefined as any);
    }
  };

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <PopoverButton
            onClick={fetchSpaces}
            className={
              buttonClassName ??
              'p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200'
            }
            title="Move to Space"
          >
            <LayoutGrid size={16} className="text-black/60 dark:text-white/60" />
          </PopoverButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom={`opacity-0 ${popoverDirection === 'up' ? '-translate-y-1' : 'translate-y-1'}`}
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo={`opacity-0 ${popoverDirection === 'up' ? '-translate-y-1' : 'translate-y-1'}`}
          >
            <PopoverPanel className={`absolute right-0 w-64 rounded-2xl bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 shadow-xl shadow-black/10 dark:shadow-black/30 z-50 ${popoverDirection === 'up' ? 'bottom-full mb-2 origin-bottom-right' : 'mt-2 origin-top-right'}`}>
              <div className="p-3">
                <p className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wide mb-2">
                  Move to Space
                </p>
                {loadingSpaces ? (
                  <p className="text-xs text-black/40 dark:text-white/40 py-2 text-center">
                    Loading…
                  </p>
                ) : spaces.length === 0 ? (
                  <p className="text-xs text-black/40 dark:text-white/40 py-2 text-center">
                    No Spaces yet
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-56 overflow-y-auto">
                    {spaces.map((space) => (
                      <button
                        key={space.id}
                        disabled={!!movingTo}
                        onClick={() => move(space.id, close)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors duration-150 ${
                          currentSpaceId === space.id
                            ? 'bg-light-secondary dark:bg-dark-secondary'
                            : 'hover:bg-light-secondary dark:hover:bg-dark-secondary'
                        }`}
                      >
                        <SpaceIconMini icon={space.icon} />
                        <span className="flex-1 text-sm text-black dark:text-white truncate">
                          {space.name}
                        </span>
                        {currentSpaceId === space.id && (
                          <span className="text-[10px] text-[#24A0ED] font-medium">
                            Current
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {currentSpaceId && (
                  <>
                    <div className="border-t border-light-200 dark:border-dark-200 my-2" />
                    <button
                      disabled={!!movingTo}
                      onClick={() => move(null, close)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                    >
                      <X size={14} className="text-red-500" />
                      <span className="text-sm text-red-500">Remove from Space</span>
                    </button>
                  </>
                )}
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default MoveToSpace;
