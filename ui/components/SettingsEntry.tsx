import { useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import SettingsDialog from './SettingsDialog';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const SettingsEntry = ({ className }: InputProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Settings
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className={cn('cursor-pointer', className)}
      />

      <SettingsDialog isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} />
    </>
  );
};

export default SettingsEntry;
