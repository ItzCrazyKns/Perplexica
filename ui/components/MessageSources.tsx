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

const MessageSources = ({ sources }: { sources: Document[] }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  const getSourceUrl = (source: Document) => {
    if (source.metadata.isFile) {
      // Pour les fichiers locaux, on retourne à la fois l'URL du viewer et l'URL directe du PDF
      const page = source.metadata.page || 1;
      return {
        viewerUrl: source.metadata.url, // On utilise l'URL déjà construite
        pdfUrl: `/api/uploads/${source.metadata.fileId}/content?page=${page}`
      };
    }
    // Pour les URLs web, on retourne la même URL pour les deux
    return {
      viewerUrl: source.metadata.url,
      pdfUrl: source.metadata.url
    };
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {sources.slice(0, 3).map((source, i) => {
        const urls = getSourceUrl(source);
        const isFile = source.metadata.isFile;
        
        const CardContent = () => (
          <>
            <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
              {source.metadata.title}
            </p>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center space-x-1">
                {isFile ? (
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
                  {isFile 
                    ? `Page ${source.metadata.page || 1}`
                    : source.metadata.url.replace(/.+\/\/|www.|\..+/g, '')}
                </p>
              </div>
              <div className="flex flex-row items-center space-x-2">
                {!isFile && (
                  <a
                    href={urls.viewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-600 transition-colors duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Voir
                  </a>
                )}
                <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
                  <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
                  <span>{i + 1}</span>
                </div>
              </div>
            </div>
          </>
        );

        return isFile ? (
          <a
            key={i}
            href={urls.viewerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
          >
            <CardContent />
          </a>
        ) : (
          <div
            key={i}
            className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
          >
            <CardContent />
          </div>
        );
      })}
      {sources.length > 3 && (
        <button
          onClick={openModal}
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
        >
          <div className="flex flex-row items-center space-x-1">
            {sources.slice(3, 6).map((source, i) => {
              return source.metadata.isFile ? (
                <div key={i} className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
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
      <Dialog as="div" className="relative z-50" open={isDialogOpen} onClose={closeModal}>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
              <Dialog.Title className="text-lg font-medium leading-6 dark:text-white">
                Sources
              </Dialog.Title>
              <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[300px] mt-2 pr-2">
                {sources.map((source, i) => {
                  const urls = getSourceUrl(source);
                  return (
                    <div
                      key={i}
                      className="bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 border border-light-200 dark:border-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
                    >
                      <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
                        {source.metadata.title}
                      </p>
                      <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-row items-center space-x-1">
                          {source.metadata.isFile ? (
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
                            {source.metadata.isFile 
                              ? `Page ${source.metadata.page || 1}`
                              : source.metadata.url.replace(/.+\/\/|www.|\..+/g, '')}
                          </p>
                        </div>
                        <div className="flex flex-row items-center space-x-2">
                          {source.metadata.isFile && (
                            <a
                              href={urls.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:text-blue-600 transition-colors duration-200"
                            >
                              PDF
                            </a>
                          )}
                          <a
                            href={urls.viewerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-600 transition-colors duration-200"
                          >
                            {source.metadata.isFile ? 'Voir' : 'Voir'}
                          </a>
                          <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
                            <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
                            <span>{i + 1}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default MessageSources;
