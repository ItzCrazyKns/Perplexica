/* eslint-disable @next/next/no-img-element */
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { Document } from '@langchain/core/documents';
import { File } from 'lucide-react';
import { Fragment, useState } from 'react';

const MessageSources = ({ sources, layout = 'grid' }: { sources: Document[]; layout?: 'grid' | 'list' }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  if (layout === 'list') {
    return (
      <div className="flex flex-col space-y-6">
        {sources.map((source, i) => (
          <div key={i} className="flex items-start space-x-4">
            {/* Left side: favicon */}
            <div className="flex-shrink-0 mt-1">
              {source.metadata.url === 'File' ? (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700">
                  <File size={16} className="text-gray-600 dark:text-gray-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 p-1">
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                    width={20}
                    height={20}
                    alt="favicon"
                    className="rounded-sm"
                  />
                </div>
              )}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <a
                href={source.metadata.url}
                target="_blank"
                className="group block"
              >
                {/* Number and domain line */}
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {i + 1}. {source.metadata.url.replace(/^https?:\/\//, '').split('/')[0]}
                  </span>
                </div>
                
                {/* Title line */}
                <h3 className="text-xl text-gray-700 dark:text-white hover:underline group-hover:underline font-normal leading-tight mb-2 overflow-hidden" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {source.metadata.title}
                </h3>
                
                {/* Description/snippet line */}
                {source.pageContent && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed overflow-hidden" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {source.pageContent.substring(0, 300)}...
                  </p>
                )}
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {sources.slice(0, 3).map((source, i) => (
        <a
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
          key={i}
          href={source.metadata.url}
          target="_blank"
        >
          <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
            {source.metadata.title}
          </p>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center space-x-1">
              {source.metadata.url === 'File' ? (
                <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                  <File size={12} className="text-white/70" />
                </div>
              ) : (
                <img
                  src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                  width={16}
                  height={16}
                  alt="favicon"
                  className="rounded-lg h-4 w-4"
                />
              )}
              <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                {source.metadata.url.replace(/.+\/\/|www.|\..+/g, '')}
              </p>
            </div>
            <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
              <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
              <span>{i + 1}</span>
            </div>
          </div>
        </a>
      ))}
      {sources.length > 3 && (
        <button
          onClick={openModal}
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
        >
          <div className="flex flex-row items-center space-x-1">
            {sources.slice(3, 6).map((source, i) => {
              return source.metadata.url === 'File' ? (
                <div
                  key={i}
                  className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full"
                >
                  <File size={12} className="text-white/70" />
                </div>
              ) : (
                <img
                  key={i}
                  src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                  width={16}
                  height={16}
                  alt="favicon"
                  className="rounded-lg h-4 w-4"
                />
              );
            })}
          </div>
          <p className="text-xs text-black/50 dark:text-white/50">
            View {sources.length - 3} more
          </p>
        </button>
      )}
      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
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
                    Sources
                  </DialogTitle>
                  <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[300px] mt-2 pr-2">
                    {sources.map((source, i) => (
                      <a
                        className="bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 border border-light-200 dark:border-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
                        key={i}
                        href={source.metadata.url}
                        target="_blank"
                      >
                        <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
                          {source.metadata.title}
                        </p>
                        <div className="flex flex-row items-center justify-between">
                          <div className="flex flex-row items-center space-x-1">
                            {source.metadata.url === 'File' ? (
                              <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                                <File size={12} className="text-white/70" />
                              </div>
                            ) : (
                              <img
                                src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata.url}`}
                                width={16}
                                height={16}
                                alt="favicon"
                                className="rounded-lg h-4 w-4"
                              />
                            )}
                            <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                              {source.metadata.url.replace(
                                /.+\/\/|www.|\..+/g,
                                '',
                              )}
                            </p>
                          </div>
                          <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
                            <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
                            <span>{i + 1}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default MessageSources;
