import { cn } from '@/lib/utils';

export default function TokenPill({
  label,
  value,
  highlight = false,
  title,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  title?: string;
}) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  const display = Number.isNaN(numeric) ? String(value ?? '') : numeric.toLocaleString();
  return (
    <div
      className={cn(
        'px-2 py-1 rounded-full border whitespace-nowrap text-xs',
        highlight ? 'border-accent text-accent' : 'border-surface-2',
      )}
      title={title ?? `${label} tokens`}
    >
      <span className="mr-1 opacity-75">{label}:</span>
      <span className="tabular-nums">{display}</span>
    </div>
  );
}
