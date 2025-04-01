import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Chat } from '@/app/library/page';

interface BatchDeleteChatsProps {
  chatIds: string[];
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  onComplete: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const BatchDeleteChats = ({
  chatIds,
  chats,
  setChats,
  onComplete,
  isOpen,
  setIsOpen,
}: BatchDeleteChatsProps) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (chatIds.length === 0) return;
    
    setLoading(true);
    try {
      for (const chatId of chatIds) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      const newChats = chats.filter(chat => !chatIds.includes(chat.id));
      setChats(newChats);
      
      toast.success(`${chatIds.length} thread${chatIds.length > 1 ? 's' : ''} deleted`);
      onComplete();
    } catch (err: any) {
      toast.error('Failed to delete threads');
    } finally {
      setIsOpen(false);
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          if (!loading) {
            setIsOpen(false);
          }
        }}
      >
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-200"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle className="text-lg font-medium leading-6 dark:text-white">
                  Delete Confirmation
                </DialogTitle>
                <Description className="text-sm dark:text-white/70 text-black/70">
                  Are you sure you want to delete {chatIds.length} selected thread{chatIds.length !== 1 ? 's' : ''}?
                </Description>
                <div className="flex flex-row items-end justify-end space-x-4 mt-6">
                  <button
                    onClick={() => {
                      if (!loading) {
                        setIsOpen(false);
                      }
                    }}
                    className="text-black/50 dark:text-white/50 text-sm hover:text-black/70 hover:dark:text-white/70 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-red-400 text-sm hover:text-red-500 transition duration-200"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BatchDeleteChats;
