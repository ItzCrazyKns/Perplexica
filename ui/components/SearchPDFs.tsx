/* eslint-disable @next/next/no-img-element */
'use client';
import { File, ExternalLink, PlusIcon, Download } from 'lucide-react';
import { useState } from 'react';
import { Message } from './ChatWindow';

type PDF = {
  title: string;
  url: string;
  type?: 'academic' | 'document' | 'article';
};

export const SearchPDFs = ({
  query,
  chatHistory,
}: {
  query: string;
  chatHistory: Message[];
}) => {
  const [pdfs, setPdfs] = useState<PDF[] | null>(null);
  const [loading, setLoading] = useState(false);

  const getPDFType = (title: string): 'academic' | 'document' | 'article' => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('paper') || lowerTitle.includes('journal') || lowerTitle.includes('research')) {
      return 'academic';
    }
    if (lowerTitle.includes('article') || lowerTitle.includes('blog')) {
      return 'article';
    }
    return 'document';
  };

  const getTypeColor = (type: 'academic' | 'document' | 'article') => {
    switch (type) {
      case 'academic':
        return 'bg-blue-500/10 text-blue-500';
      case 'article':
        return 'bg-green-500/10 text-green-500';
      default:
        return 'bg-red-500/10 text-red-500';
    }
  };

  const formatChatHistory = (history: Message[]) => {
    return history.map(msg => {
      return [msg.role === 'user' ? 'human' : 'ai', msg.content];
    });
  };

  const searchForPDFs = async () => {
    setLoading(true);

    const chatModelProvider = localStorage.getItem('chatModelProvider');
    const chatModel = localStorage.getItem('chatModel');

    const customOpenAIBaseURL = localStorage.getItem('openAIBaseURL');
    const customOpenAIKey = localStorage.getItem('openAIApiKey');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `PDF documents about: ${query}`,
            focusMode: 'webSearch',
            optimizationMode: 'balanced',
            history: formatChatHistory(chatHistory),
            chatModel: {
              provider: chatModelProvider,
              model: chatModel,
              ...(chatModelProvider === 'custom_openai' && {
                customOpenAIKey: customOpenAIKey,
                customOpenAIBaseURL: customOpenAIBaseURL,
              }),
            },
          }),
        },
      );

      const data = await res.json();
      console.log("Search response:", data);
      
      // Extract PDF results from the message and sources
      let pdfResults: PDF[] = [];
      
      // Check for PDF URLs in sources
      if (data.sources && Array.isArray(data.sources)) {
        pdfResults = data.sources
          .filter((source: any) => 
            source.metadata?.url?.toLowerCase().endsWith('.pdf') || 
            source.metadata?.title?.includes('PDF') ||
            source.metadata?.url?.includes('.pdf')
          )
          .map((source: any) => ({
            title: source.metadata.title || 'PDF Document',
            url: source.metadata.url,
            type: getPDFType(source.metadata.title || '')
          }));
      }
      
      setPdfs(pdfResults);
    } catch (error) {
      console.error('Error searching for PDFs:', error);
      setPdfs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!loading && pdfs === null && (
        <button
          id="search-pdfs"
          onClick={searchForPDFs}
          className="border border-dashed border-light-200 dark:border-dark-200 hover:bg-light-200 dark:hover:bg-dark-200 active:scale-95 duration-200 transition px-4 py-2 flex flex-row items-center justify-between rounded-lg dark:text-white text-sm w-full"
        >
          <div className="flex flex-row items-center space-x-2">
            <File size={17} />
            <p>Search PDFs</p>
          </div>
          <PlusIcon className="text-[#24A0ED]" size={17} />
        </button>
      )}
      
      {loading && (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-light-secondary dark:bg-dark-secondary h-32 w-full rounded-lg animate-pulse aspect-video object-cover"
            />
          ))}
        </div>
      )}
      
      {pdfs !== null && pdfs.length > 0 && (
        <div className="bg-light-secondary dark:bg-dark-secondary w-full rounded-lg p-4 flex flex-col space-y-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center space-x-2">
              <File />
              <h3 className="font-medium text-black dark:text-white">PDF Documents</h3>
              <span className="text-xs text-black/50 dark:text-white/50">({pdfs.length})</span>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            {pdfs.map((pdf, i) => (
              <div
                key={i}
                className="bg-light-100 dark:bg-dark-100 rounded-lg p-3 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200"
              >
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-row items-center space-x-3 flex-grow min-w-0">
                    <div className={`p-2 rounded-md ${getTypeColor(pdf.type || 'document')}`}>
                      <File size={16} />
                    </div>
                    <div className="flex flex-col space-y-1 flex-grow min-w-0">
                      <p className="text-sm font-medium text-black dark:text-white truncate" title={pdf.title}>
                        {pdf.title}
                      </p>
                      <p className="text-xs text-black/50 dark:text-white/50 truncate">
                        {new URL(pdf.url).hostname}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-row items-center space-x-2 flex-shrink-0 ml-2">
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <a
                      href={pdf.url}
                      download
                      className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {pdfs !== null && pdfs.length === 0 && (
        <div className="bg-light-secondary dark:bg-dark-secondary w-full rounded-lg p-4 flex flex-col space-y-2">
          <div className="flex flex-row items-center space-x-2">
            <File />
            <h3 className="font-medium text-black dark:text-white">PDF Documents</h3>
          </div>
          <p className="text-sm text-black/60 dark:text-white/60">No PDF documents found related to your query.</p>
        </div>
      )}
    </>
  );
};