import { cn } from '@/lib/utils';
import { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string; disabled?: boolean }[];
}

export const Select = ({ className, options, ...restProps }: SelectProps) => {
  return (
    <select
      {...restProps}
      className={cn(
        'bg-light-secondary dark:bg-dark-secondary px-3 py-1 flex items-center overflow-visible border border-light-200 dark:border-dark-200 dark:text-white rounded-lg text-sm min-w-[120px] leading-normal',
        className,
      )}
    >
      {options.map(({ label, value, disabled }) => {
        return (
          <option key={value} value={value} disabled={disabled} className="py-1">
            {label}
          </option>
        );
      })}
    </select>
  );
};

export default Select;
