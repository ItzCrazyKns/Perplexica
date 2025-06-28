import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { File, LoaderCircle, Paperclip, Plus, Trash } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { File as FileType } from '../ChatWindow';

const Attach = ({
  fileIds,
  setFileIds,
  files,
  setFiles,
  optimizationMode,
}: {
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: FileType[];
  setFiles: (files: FileType[]) => void;
  optimizationMode: string;
}) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<any>();

  const isSpeedMode = optimizationMode === 'speed';
  const isDisabled = isSpeedMode;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;

    setLoading(true);
    const data = new FormData();

    for (let i = 0; i < e.target.files!.length; i++) {
      data.append('files', e.target.files![i]);
    }

    const embeddingModelProvider = localStorage.getItem(
      'embeddingModelProvider',
    );
    const embeddingModel = localStorage.getItem('embeddingModel');
    const chatModelProvider = localStorage.getItem('chatModelProvider');
    const chatModel = localStorage.getItem('chatModel');
    const ollamaContextWindow =
      localStorage.getItem('ollamaContextWindow') || '2048';

    data.append('embedding_model_provider', embeddingModelProvider!);
    data.append('embedding_model', embeddingModel!);
    data.append('chat_model_provider', chatModelProvider!);
    data.append('chat_model', chatModel!);
    if (chatModelProvider === 'ollama') {
      data.append('ollama_context_window', ollamaContextWindow);
    }

    const res = await fetch(`/api/uploads`, {
      method: 'POST',
      body: data,
    });

    const resData = await res.json();

    setFiles([...files, ...resData.files]);
    setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
    setLoading(false);
  };

  return loading ? (
    <div className="flex flex-row items-center justify-between space-x-1">
      <LoaderCircle size={18} className="text-sky-400 animate-spin" />
      <p className="text-sky-400 inline whitespace-nowrap text-xs font-medium">
        Uploading..
      </p>
    </div>
  ) : files.length > 0 ? (
    <div className="relative group">
      <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
        <PopoverButton
          type="button"
          disabled={isDisabled}
          className={cn(
            'flex flex-row items-center justify-between space-x-1 p-2 rounded-xl transition duration-200',
            files.length > 0 ? '-ml-2 lg:-ml-3' : '',
            isDisabled
              ? 'text-black/20 dark:text-white/20 cursor-not-allowed'
              : 'text-black/50 dark:text-white/50 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white',
          )}
        >
          {files.length > 1 && (
            <>
              <File size={19} className={isDisabled ? 'text-sky-900' : 'text-sky-400'} />
              <p className={cn("inline whitespace-nowrap text-xs font-medium", isDisabled ? 'text-sky-900' : 'text-sky-400')}>
                {files.length} files
              </p>
            </>
          )}

          {files.length === 1 && (
            <>
              <File size={18} className={isDisabled ? 'text-sky-900' : 'text-sky-400'} />
              <p className={cn("text-xs font-medium", isDisabled ? 'text-sky-900' : 'text-sky-400')}>
                {files[0].fileName.length > 10
                  ? files[0].fileName.replace(/\.\w+$/, '').substring(0, 3) +
                    '...' +
                    files[0].fileExtension
                  : files[0].fileName}
              </p>
            </>
          )}
        </PopoverButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel className="absolute z-10 w-64 md:w-[350px] right-0">
            <div className="bg-light-primary dark:bg-dark-primary border rounded-md border-light-200 dark:border-dark-200 w-full max-h-[200px] md:max-h-none overflow-y-auto flex flex-col">
              <div className="flex flex-row items-center justify-between px-3 py-2">
                <h4 className="text-black dark:text-white font-medium text-sm">
                  Attached files
                </h4>
                <div className="flex flex-row items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => !isDisabled && fileInputRef.current.click()}
                    disabled={isDisabled}
                    className={cn(
                      'flex flex-row items-center space-x-1 transition duration-200',
                      isDisabled
                        ? 'text-black/20 dark:text-white/20 cursor-not-allowed'
                        : 'text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white',
                    )}
                  >
                    <input
                      type="file"
                      onChange={handleChange}
                      ref={fileInputRef}
                      accept=".pdf,.docx,.txt"
                      multiple
                      hidden
                      disabled={isDisabled}
                    />
                    <Plus size={18} />
                    <p className="text-xs">Add</p>
                  </button>
                  <button
                    onClick={() => {
                      if (!isDisabled) {
                        setFiles([]);
                        setFileIds([]);
                      }
                    }}
                    disabled={isDisabled}
                    className={cn(
                      'flex flex-row items-center space-x-1 transition duration-200',
                      isDisabled
                        ? 'text-black/20 dark:text-white/20 cursor-not-allowed'
                        : 'text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white',
                    )}
                  >
                    <Trash size={14} />
                    <p className="text-xs">Clear</p>
                  </button>
                </div>
              </div>
              <div className="h-[0.5px] mx-2 bg-white/10" />
              <div className="flex flex-col items-center">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex flex-row items-center justify-start w-full space-x-3 p-3"
                  >
                    <div className="bg-dark-100 flex items-center justify-center w-10 h-10 rounded-md">
                      <File size={16} className="text-white/70" />
                    </div>
                    <p className="text-black/70 dark:text-white/70 text-sm">
                      {file.fileName.length > 25
                        ? file.fileName.replace(/\.\w+$/, '').substring(0, 25) +
                          '...' +
                          file.fileExtension
                        : file.fileName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </PopoverPanel>
        </Transition>
      </Popover>
      {isSpeedMode && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-black dark:bg-white text-white dark:text-black text-xs px-2 py-1 rounded whitespace-nowrap">
            File attachments are disabled in Speed mode
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="relative group">
      <button
        type="button"
        onClick={() => !isDisabled && fileInputRef.current.click()}
        disabled={isDisabled}
        className={cn(
          'flex flex-row items-center space-x-1 rounded-xl transition duration-200 p-2',
          isDisabled
            ? 'text-black/20 dark:text-white/20 cursor-not-allowed'
            : 'text-black/50 dark:text-white/50 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white',
        )}
      >
        <input
          type="file"
          onChange={handleChange}
          ref={fileInputRef}
          accept=".pdf,.docx,.txt"
          multiple
          hidden
          disabled={isDisabled}
        />
        <Paperclip size="18" />
      </button>
      {isSpeedMode && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-black dark:bg-white text-white dark:text-black text-xs px-2 py-1 rounded whitespace-nowrap">
            File attachments are disabled in Speed mode
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attach;
