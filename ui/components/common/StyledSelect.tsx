import { cn } from '@/lib/utils';
import type { OptionHTMLAttributes, SelectHTMLAttributes } from 'react';

export interface StyledSelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {}

export const StyledSelect = function StyledSelect({
  className,
  ...restProps
}: StyledSelectProps) {
  return (
    <select
      className={cn(
        'bg-[#111111] px-3 py-2 flex items-center overflow-hidden border border-[#1C1C1C] text-white rounded-lg text-sm',
        className,
      )}
      {...restProps}
    />
  );
};

interface StyledSelectOptionProps extends OptionHTMLAttributes<HTMLOptionElement> {}

StyledSelect.Option = function StyledSelectOption(
  props: StyledSelectOptionProps,
) {
  return <option {...props} />;
};
