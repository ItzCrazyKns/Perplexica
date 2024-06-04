import { useState } from 'react';
import { Settings } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import SettingsDialog from './SettingsDialog';

const SettingsEntry = ({ className, ...restProps }: LucideProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Settings
        {...restProps}
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className={cn('cursor-pointer', className)}
      />

      <SettingsDialog isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </>
  );
};

export default SettingsEntry;
