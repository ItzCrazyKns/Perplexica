'use client';

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Switch,
} from '@headlessui/react';
import { AnimatePresence, motion } from 'motion/react';
import { SiNotion } from '@icons-pack/react-simple-icons';
import { LoaderCircle, Search, Trash } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useChat } from '@/lib/hooks/useChat';
import { fuzzyMatchPages } from '@/lib/connectors/notion/fuzzy';
import type { AuthorizedPage } from '@/lib/connectors/notion/types';

const Notion = () => {
  const { notionPages, setNotionPages } = useChat();

  const [pages, setPages] = useState<AuthorizedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [query, setQuery] = useState('');

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setNotConnected(false);
    try {
      const res = await fetch('/api/notion/pages');
      if (res.status === 409) {
        setNotConnected(true);
        setPages([]);
        return;
      }
      if (!res.ok) throw new Error(`Failed to load pages (${res.status})`);
      const data = (await res.json()) as { pages: AuthorizedPage[] };
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to load Notion pages:', err);
      toast.error('Failed to load Notion pages.');
    } finally {
      setLoading(false);
    }
  }, []);

  const togglePage = (page: AuthorizedPage) => {
    const selected = notionPages.some((p) => p.id === page.id);
    setNotionPages(
      selected
        ? notionPages.filter((p) => p.id !== page.id)
        : [...notionPages, page],
    );
  };

  const visiblePages = query.trim() ? fuzzyMatchPages(pages, query) : pages;

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <FetchOnOpen open={open} onFetch={fetchPages} />
          <PopoverButton className="relative flex items-center justify-center active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white">
            <SiNotion
              size={16}
              className={notionPages.length > 0 ? 'text-sky-500' : ''}
            />
            {notionPages.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-sky-500 text-white text-[9px] font-medium">
                {notionPages.length}
              </span>
            )}
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                static
                className="absolute z-10 w-64 md:w-[300px] right-0"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-top-right flex flex-col bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-1 max-h-[300px] overflow-y-auto shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center justify-center py-6">
                      <LoaderCircle className="h-4 w-4 animate-spin text-black/40 dark:text-white/40" />
                    </div>
                  ) : notConnected ? (
                    <div className="px-3 py-4">
                      <p className="text-xs text-black/70 dark:text-white/70">
                        Notion 尚未連接。請到 設定 → Notion 連接你的
                        workspace，之後就能在對話中選擇頁面。
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-row items-center justify-between px-2 py-1.5">
                        <div className="relative flex-1 mr-2">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-black/40 dark:text-white/40" />
                          <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜尋頁面…"
                            className="w-full rounded-md border border-light-200 dark:border-dark-200 bg-transparent pl-7 pr-2 py-1.5 text-xs text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-sky-500/50"
                          />
                        </div>
                        {notionPages.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setNotionPages([])}
                            className="flex items-center space-x-1 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition duration-200"
                          >
                            <Trash size={12} />
                            <p className="text-[11px]">Clear</p>
                          </button>
                        )}
                      </div>

                      <div className="h-[0.5px] mx-2 bg-white/10" />

                      {visiblePages.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-black/40 dark:text-white/40">
                          {query.trim()
                            ? `找不到「${query.trim()}」`
                            : '沒有可用的頁面'}
                        </p>
                      ) : (
                        visiblePages.map((page) => {
                          const selected = notionPages.some(
                            (p) => p.id === page.id,
                          );
                          return (
                            <div
                              key={page.id}
                              className="flex flex-row justify-between hover:bg-light-100 hover:dark:bg-dark-100 rounded-md py-2.5 px-2 cursor-pointer"
                              onClick={() => togglePage(page)}
                            >
                              <div className="flex flex-col min-w-0">
                                <p className="text-xs text-black/80 dark:text-white/80 truncate">
                                  {page.title}
                                </p>
                                <p className="text-[10px] text-black/40 dark:text-white/40">
                                  {page.type === 'database' ? '資料庫' : '頁面'}
                                </p>
                              </div>
                              <Switch
                                checked={selected}
                                className="group relative flex h-4 w-7 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-0.5 duration-200 ease-in-out focus:outline-none transition-colors data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
                              >
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none inline-block size-3 translate-x-[1px] group-data-[checked]:translate-x-3 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                                />
                              </Switch>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

/**
 * Fetches exactly once per popover open transition. Keyed on the
 * headless-ui `open` flag (not on pages/notConnected), so a failed or
 * not-connected load can never retrigger itself in a loop.
 */
const FetchOnOpen = ({
  open,
  onFetch,
}: {
  open: boolean;
  onFetch: () => void;
}) => {
  useEffect(() => {
    if (open) onFetch();
  }, [open, onFetch]);

  return null;
};

export default Notion;
