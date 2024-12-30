/* eslint-disable @next/next/no-img-element */
import { BookCopy, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Message } from './ChatWindow';
import Lightbox, { GenericSlide } from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

type Document = {
  url: string;
  title: string;
  snippet: string;
  source: string;
  type: string;
  iframe_src: string;
};

declare module 'yet-another-react-lightbox' {
  export interface PDFSlide extends GenericSlide {
    type: 'pdf';
    url: string;
    iframe_src: string;
  }

  interface SlideTypes {
    'pdf': PDFSlide;
  }
}

const LegalSearch = ({
  query,
  chatHistory,
}: {
  query: string;
  chatHistory: Message[];
}) => {
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);

  const openDocument = (doc: Document) => {
    setCurrentDoc(doc);
    setOpen(true);
  };

  return (
    <>
      {!loading && documents === null && (
        <button
          onClick={async () => {
            setLoading(true);

            const chatModelProvider = localStorage.getItem('chatModelProvider');
            const chatModel = localStorage.getItem('chatModel');

            const customOpenAIBaseURL = localStorage.getItem('openAIBaseURL');
            const customOpenAIKey = localStorage.getItem('openAIApiKey');

            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/legal`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  query: query,
                  chatHistory: chatHistory,
                  chatModel: {
                    provider: chatModelProvider,
                    model: chatModel,
                    ...(chatModelProvider === 'custom_openai' && {
                      customOpenAIBaseURL: customOpenAIBaseURL,
                      customOpenAIKey: customOpenAIKey,
                    }),
                  },
                }),
              },
            );

            const data = await res.json();
            setDocuments(data.documents ?? []);
            setLoading(false);
          }}
          className="border border-dashed border-light-200 dark:border-dark-200 hover:bg-light-200 dark:hover:bg-dark-200 active:scale-95 duration-200 transition px-4 py-2 flex flex-row items-center justify-between rounded-lg dark:text-white text-sm w-full"
        >
          <div className="flex flex-row items-center space-x-2">
            <BookCopy size={17} />
            <p>Rechercher des textes légaux</p>
          </div>
          <PlusIcon className="text-[#24A0ED]" size={17} />
        </button>
      )}
      {loading && (
        <div className="flex flex-col space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-light-secondary dark:bg-dark-secondary h-24 w-full rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}
      {documents !== null && documents.length > 0 && (
        <>
          <div className="flex flex-col space-y-2">
            {documents.length > 4
              ? documents.slice(0, 3).map((doc, i) => (
                  <div
                    key={i}
                    onClick={() => openDocument(doc)}
                    className="bg-light-100 dark:bg-dark-100 p-3 rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200 cursor-pointer"
                  >
                    <h4 className="text-sm font-medium text-black dark:text-white line-clamp-2">
                      {doc.title}
                    </h4>
                    <p className="text-xs text-black/50 dark:text-white/50 mt-1 line-clamp-2">
                      {doc.snippet}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-black/30 dark:text-white/30">
                        {doc.source}
                      </span>
                      <span className="text-xs bg-light-secondary dark:bg-dark-secondary px-1.5 py-0.5 rounded text-black/50 dark:text-white/50">
                        {doc.type}
                      </span>
                    </div>
                  </div>
                ))
              : documents.map((doc, i) => (
                  <div
                    key={i}
                    onClick={() => openDocument(doc)}
                    className="bg-light-100 dark:bg-dark-100 p-3 rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200 cursor-pointer"
                  >
                    <h4 className="text-sm font-medium text-black dark:text-white line-clamp-2">
                      {doc.title}
                    </h4>
                    <p className="text-xs text-black/50 dark:text-white/50 mt-1 line-clamp-2">
                      {doc.snippet}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-black/30 dark:text-white/30">
                        {doc.source}
                      </span>
                      <span className="text-xs bg-light-secondary dark:bg-dark-secondary px-1.5 py-0.5 rounded text-black/50 dark:text-white/50">
                        {doc.type}
                      </span>
                    </div>
                  </div>
                ))}
            {documents.length > 4 && (
              <button
                onClick={() => openDocument(documents[3])}
                className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 p-3 rounded-lg text-black/70 dark:text-white/70 text-sm"
              >
                Voir {documents.length - 3} documents supplémentaires
              </button>
            )}
          </div>
          <Lightbox
            open={open}
            close={() => setOpen(false)}
            render={{
              slide: ({ slide }) =>
                slide.type === 'pdf' ? (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    <div className="text-center mb-4 text-white">
                      <p>Le document ne peut pas être affiché directement.</p>
                      <a 
                        href={slide.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline mt-2 inline-block"
                      >
                        Ouvrir le document dans un nouvel onglet
                      </a>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg max-w-2xl">
                      <h3 className="text-white/90 font-medium mb-2">{currentDoc?.title}</h3>
                      <p className="text-white/70 text-sm">{currentDoc?.snippet}</p>
                    </div>
                  </div>
                ) : null,
            }}
            slides={[
              {
                type: 'pdf',
                url: currentDoc?.url || '',
                iframe_src: currentDoc?.url || '',
              }
            ]}
          />
        </>
      )}
    </>
  );
};

export default LegalSearch;