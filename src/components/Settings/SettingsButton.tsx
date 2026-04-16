'use client';

import { Settings, LogOut, Shield } from 'lucide-react';
import { useState } from 'react';
import SettingsDialogue from './SettingsDialogue';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';

const SettingsButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    window.location.href = '/';
  };

  return (
    <>
      <div className="relative">
        <div
          className="p-2.5 rounded-full bg-light-200 text-black/70 dark:bg-dark-200 dark:text-white/70 hover:opacity-70 hover:scale-105 transition duration-200 cursor-pointer active:scale-95"
          onClick={() => setIsOpen(true)}
        >
          <Settings size={19} className="cursor-pointer" />
        </div>
      </div>

      <SettingsDialogue isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
};

export default SettingsButton;
