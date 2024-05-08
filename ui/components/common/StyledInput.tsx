import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const StyledInput = function StyledInput({
  className,
  ...restProps
}: InputProps) {
  return (
    <input
      className={cn("bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm", className)}
      {...restProps}
    />
  );
};
