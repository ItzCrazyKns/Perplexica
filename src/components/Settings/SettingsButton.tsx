import { Settings } from 'lucide-react';
import { useState } from 'react';
import SettingsDialogue from './SettingsDialogue';
import { AnimatePresence } from 'motion/react';

const SettingsButton = ({
  variant = 'sidebar',
}: {
  variant?: 'sidebar' | 'mobile';
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <>
      {variant === 'sidebar' ? (
        <div
          className="p-2.5 rounded-full bg-light-200 text-black/70 dark:bg-dark-200 dark:text-white/70 hover:opacity-70 hover:scale-105 transition duration-200 cursor-pointer active:scale-95"
          onClick={() => setIsOpen(true)}
        >
          <Settings size={19} className="cursor-pointer" />
        </div>
      ) : (
        <button className="lg:hidden" onClick={() => setIsOpen(true)}>
          <Settings size={18} />
        </button>
      )}
      <AnimatePresence>
        {isOpen && <SettingsDialogue isOpen={isOpen} setIsOpen={setIsOpen} />}
      </AnimatePresence>
    </>
  );
};

export default SettingsButton;
