'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BookOpenText, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  focusMode: string;
}

const ChatHistory = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const fetchChats = async () => {
      setLoading(true);

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();
        setChats(data.chats);
      } catch (error) {
        console.error('Failed to fetch chat history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, []);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex flex-col w-full px-1">
      <button 
        onClick={toggleExpanded}
        className="flex items-center w-full px-2 py-1.5 mb-0.5 text-sm text-left rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150"
      >
        <div className="flex items-center gap-1.5">
          <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown size={14} />
          </span>
          <BookOpenText size={14} />
          <span className="font-medium">Library</span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-0.5 overflow-y-auto max-h-[50vh] overflow-x-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style jsx global>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div className="hide-scrollbar pl-1.5 border-l border-black/10 dark:border-white/10 ml-3.5">
            {loading ? (
              <div className="flex justify-center py-2">
                <div className="w-4 h-4 border-2 border-t-sky-400 border-gray-200 rounded-full animate-spin" />
              </div>
            ) : chats.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-black/50 dark:text-white/50">
                No chats found
              </div>
            ) : (
              <div className="flex flex-col">
                {chats.map((chat) => (
                  <Link 
                    href={`/c/${chat.id}`} 
                    key={chat.id}
                    className={cn(
                      "flex flex-col px-2.5 py-1 rounded-md text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                      pathname === `/c/${chat.id}` ? "bg-black/5 dark:bg-white/5 font-medium" : "font-normal"
                    )}
                  >
                    <span className="truncate text-sm leading-tight">{chat.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;