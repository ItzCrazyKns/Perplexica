import { useEffect, useMemo, useState } from 'react';
import { Cpu, ChevronDown, Link } from 'lucide-react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { Fragment } from 'react';
import ModelSelector from './ModelSelector';
import { cn } from '@/lib/utils';

type SelectedModel = { provider: string; model: string } | null;

const STORAGE_KEYS = {
  chatProvider: 'chatModelProvider',
  chatModel: 'chatModel',
  systemProvider: 'systemModelProvider',
  systemModel: 'systemModel',
  link: 'linkSystemToChat',
} as const;

export default function ModelConfigurator({
  showModelName,
  truncateModelName = true,
}: {
  showModelName?: boolean;
  truncateModelName?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Initialize from localStorage (default ON when absent)
  const [linkSystemToChat, setLinkSystemToChat] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem(STORAGE_KEYS.link);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  // Prevent post-mount effects from using pre-hydration default values
  const [hydrated, setHydrated] = useState(false);
  const [chatModel, setChatModel] = useState<SelectedModel>(null);
  const [systemModel, setSystemModel] = useState<SelectedModel>(null);

  // Responsive default for showing model text on the main button
  const computedShowName = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (typeof showModelName === 'boolean') return showModelName;
    return window.matchMedia('(min-width: 640px)').matches;
  }, [showModelName]);

  // Load persisted selections and ensure defaults (without overriding stored false)
  useEffect(() => {
    try {
      const chatProvider = localStorage.getItem(STORAGE_KEYS.chatProvider);
      const chat = localStorage.getItem(STORAGE_KEYS.chatModel);
      if (chatProvider && chat) {
        setChatModel({ provider: chatProvider, model: chat });
      }

      const linkStored = localStorage.getItem(STORAGE_KEYS.link);
      if (linkStored === null) {
        // Ensure the default is written once for new users (state already initialized)
        localStorage.setItem(STORAGE_KEYS.link, 'true');
      }

      const systemProvider = localStorage.getItem(STORAGE_KEYS.systemProvider);
      const system = localStorage.getItem(STORAGE_KEYS.systemModel);
      if (systemProvider && system) {
        setSystemModel({ provider: systemProvider, model: system });
      } else if ((linkStored === null || linkStored === 'true') && chatProvider && chat) {
        // Mirror chat if linking and no explicit system set
        setSystemModel({ provider: chatProvider, model: chat });
        localStorage.setItem(STORAGE_KEYS.systemProvider, chatProvider);
        localStorage.setItem(STORAGE_KEYS.systemModel, chat);
      }

      setHydrated(true);
    } catch (e) {
      console.error('ModelConfigurator: error loading model selection', e);
      setHydrated(true);
    }
  }, []);

  // When linking is enabled, mirror system to chat (after hydration)
  useEffect(() => {
    if (!hydrated) return; // avoid running with pre-hydration default
    localStorage.setItem(
      STORAGE_KEYS.link,
      linkSystemToChat ? 'true' : 'false',
    );
    if (linkSystemToChat && chatModel) {
      setSystemModel(chatModel);
      localStorage.setItem(STORAGE_KEYS.systemProvider, chatModel.provider);
      localStorage.setItem(STORAGE_KEYS.systemModel, chatModel.model);
    }
  }, [hydrated, linkSystemToChat, chatModel]);
  
  const handleSelectChat = (m: { provider: string; model: string }) => {
    setChatModel(m);
    localStorage.setItem(STORAGE_KEYS.chatProvider, m.provider);
    localStorage.setItem(STORAGE_KEYS.chatModel, m.model);
    if (linkSystemToChat) {
      setSystemModel(m);
      localStorage.setItem(STORAGE_KEYS.systemProvider, m.provider);
      localStorage.setItem(STORAGE_KEYS.systemModel, m.model);
    }
  };

  const handleSelectSystem = (m: { provider: string; model: string }) => {
    if (linkSystemToChat) return; // disabled while linked
    setSystemModel(m);
    localStorage.setItem(STORAGE_KEYS.systemProvider, m.provider);
    localStorage.setItem(STORAGE_KEYS.systemModel, m.model);
  };

  const mainButtonText = useMemo(() => {
    if (!computedShowName) return null;
    if (!chatModel) return 'Loading...';
    // The ModelSelector derives a displayName via providers list; we only have the key here.
    // To keep it simple and consistent, show provider/model keys. The dialog shows friendly names.
    return `Chat: ${chatModel.model} (${chatModel.provider})`;
  }, [computedShowName, chatModel]);

  return (
    <>
      <button
        type="button"
        className="p-2 group flex text-fg/50 rounded-xl hover:bg-surface-2 active:scale-95 transition duration-200 hover:text-fg"
        onClick={() => setOpen(true)}
        aria-label="Configure models"
      >
        <Cpu size={18} />
        {computedShowName && (
          <span
            className={cn(
              'ml-2 text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap',
              {
                'max-w-44': truncateModelName,
              },
            )}
          >
            {mainButtonText}
          </span>
        )}
        <ChevronDown size={16} className="transition-transform" />
      </button>

      <Transition show={open} as={Fragment}>
        <Dialog onClose={() => setOpen(false)} className="relative z-50">
          <TransitionChild
            as={Fragment}
            enter="transition-opacity ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </TransitionChild>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <DialogPanel className="w-full max-w-lg rounded-lg bg-surface border border-surface-2 shadow-lg">
                <div className="px-5 py-4 border-b border-surface-2">
                  <h2 className="text-sm font-semibold text-fg/90">Model Configuration</h2>
                  <p className="text-xs text-fg/60 mt-1">
                    Choose the Chat and System models. Link them to keep System in sync with Chat.
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fg/80">Link System to Chat</span>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={linkSystemToChat}
                        onChange={(e) => setLinkSystemToChat(e.target.checked)}
                      />
                      <div className="w-10 h-5 bg-surface-2 rounded-full peer peer-checked:bg-accent transition-colors relative">
                        <div className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', linkSystemToChat ? 'translate-x-5' : 'translate-x-0')} />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-fg/70">Chat Model</span>
                      <ModelSelector
                        role="chat"
                        selectedModel={chatModel}
                        setSelectedModel={handleSelectChat}
                        showModelName
                        truncateModelName
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                      <span className="text-xs text-fg/70">System Model</span>
                      {linkSystemToChat && (
                          <span className="text-[10px] bg-surface px-2 py-0.5 rounded border border-surface-2 text-fg/60"><Link size={14} /></span>
                        )}
                      </div>
                      <div className={cn('relative', linkSystemToChat ? 'opacity-60 pointer-events-none' : '')}>
                        <ModelSelector
                          role="system"
                          selectedModel={systemModel}
                          setSelectedModel={handleSelectSystem}
                          showModelName
                          truncateModelName
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-surface-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm rounded bg-surface-2 hover:bg-surface-3 text-fg/80"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
