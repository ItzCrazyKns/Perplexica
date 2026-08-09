'use client';

import { useEffect, useState } from 'react';
import { Check, PenLine, Plus, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  WriteConfirmationBlock,
  WriteConfirmationItem,
} from '@/lib/types';
import type { WriteConfirmationCollisionOption } from '@/lib/agents/search/writes/types';
import { cn } from '@/lib/utils';

const COLLISION_OPTIONS: {
  value: WriteConfirmationCollisionOption;
  label: string;
  hint: string;
}[] = [
  {
    value: 'cancel',
    label: '取消',
    hint: '不建立，也不寫入任何頁面',
  },
  {
    value: 'create-duplicate',
    label: '建立重複頁面',
    hint: '不管同名頁面，直接新增一個新頁面',
  },
  {
    value: 'write-into-existing',
    label: '寫入既有頁面',
    hint: '把內容寫進找到的同名頁面',
  },
];

const KIND_META: Record<
  WriteConfirmationItem['kind'],
  { label: string; icon: typeof PenLine; className: string }
> = {
  append: {
    label: 'Append',
    icon: PenLine,
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  },
  update: {
    label: 'Update',
    icon: PenLine,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  create: {
    label: 'Create',
    icon: Plus,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
};

const WriteConfirmation = ({ block }: { block: WriteConfirmationBlock }) => {
  const { status, writes, sessionId } = block.data;
  const pending = status === 'pending';

  const [resolutions, setResolutions] = useState<
    Record<string, WriteConfirmationCollisionOption>
  >({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pending) return;
    // Default every collision to the safest option (cancel) until the
    // user actively picks another.
    setResolutions((prev) => {
      const next = { ...prev };
      for (const item of writes) {
        if (item.collision && !next[item.id]) {
          next[item.id] = 'cancel';
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const sendDecision = async (action: 'approve' | 'reject') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/notion/write/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          blockId: block.id,
          decision:
            action === 'approve' ? { action, resolutions } : { action },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data.message || '無法送出確認，請重新整理後再試一次',
        );
        setSubmitting(false);
      }
      // On success the stream updates the block to approved/rejected;
      // nothing else to do here.
    } catch {
      toast.error('無法送出確認，請檢查連線後再試一次');
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3 border-b border-light-200 dark:border-dark-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-black dark:text-white" />
          <span className="text-sm font-medium text-black dark:text-white">
            Notion 寫入確認
            {pending ? `（${writes.length} 個操作）` : ''}
          </span>
        </div>
        {status === 'approved' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> 已執行
          </span>
        )}
        {status === 'rejected' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
            <X className="w-3.5 h-3.5" /> 已取消
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {writes.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              className="rounded-md border border-light-200 dark:border-dark-200 bg-light-100 dark:bg-dark-100 p-3"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
                    meta.className,
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </span>
                <span className="text-sm text-black dark:text-white font-medium">
                  {item.kind === 'create'
                    ? item.title
                    : item.target.title}
                </span>
                {item.kind === 'create' && (
                  <span className="text-xs text-black/60 dark:text-white/60">
                    {item.target.id
                      ? `→ ${item.target.title}`
                      : '→ Workspace 頂層'}
                  </span>
                )}
                {item.kind === 'update' && item.title && (
                  <span className="text-xs text-black/60 dark:text-white/60">
                    新標題：{item.title}
                  </span>
                )}
              </div>

              {item.contentPreview && (
                <p className="mt-2 text-xs text-black/70 dark:text-white/70 whitespace-pre-wrap line-clamp-4 font-mono">
                  {item.contentPreview}
                </p>
              )}

              {pending && item.collision && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    已有同名頁面「{item.collision.existingTitle}」，請選擇處理方式：
                  </p>
                  <div className="space-y-1.5">
                    {COLLISION_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-start gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`collision-${item.id}`}
                          checked={resolutions[item.id] === option.value}
                          onChange={() =>
                            setResolutions((prev) => ({
                              ...prev,
                              [item.id]: option.value,
                            }))
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="text-sm text-black dark:text-white">
                            {option.label}
                          </span>
                          <span className="block text-xs text-black/60 dark:text-white/60">
                            {option.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {item.result && (
                <p
                  className={cn(
                    'mt-2 text-xs',
                    item.result.ok
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {item.result.ok ? '✓ ' : '✗ '}
                  {item.result.message}
                  {item.result.url && (
                    <>
                      {' '}
                      <a
                        href={item.result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        開啟頁面
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {pending && (
        <div className="flex items-center gap-2 p-3 border-t border-light-200 dark:border-dark-200">
          <button
            onClick={() => sendDecision('approve')}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition duration-200"
          >
            <Check className="w-4 h-4" />
            全部執行
          </button>
          <button
            onClick={() => sendDecision('reject')}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-light-100 dark:bg-dark-100 text-black/80 dark:text-white/80 border border-light-200 dark:border-dark-200 hover:bg-light-200 dark:hover:bg-dark-200 disabled:opacity-50 transition duration-200"
          >
            <X className="w-4 h-4" />
            取消
          </button>
        </div>
      )}
    </div>
  );
};

export default WriteConfirmation;
