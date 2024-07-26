import React from "react";
import Image from "next/image";
import { ReactMarkdown } from "@/components/Markdown";

interface ContextItemProperties {
  item: {
    name: string;
    url: string;
    description: string;
    provider: {
      name: string;
      image?: {
        thumbnail: {
          contentUrl: string;
        };
      };
    }[];
    datePublished: string;
    image?: {
      contentUrl: string;
      thumbnail: { contentUrl: string; width: number; height: number };
    };
    article?: string;
    score?: number;
  };
  togglePreview: () => void; // Add togglePreview prop
}

const PreviewNewsDetail: React.FC<ContextItemProperties> = ({ item, togglePreview = () => {} }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-8">
      <div className="bg-white dark:bg-slate-800 p-8 justify-center rounded-lg overflow-hidden relative w-4/5 h-4/5">
        <div className="flex justify-between items-start">
          <h2 className="truncate">{item.name}</h2>
          <button onClick={togglePreview} className="p-2 rounded focus:outline-none">
            <span className="text-4xl font-bold">&times;</span>
          </button>
        </div>
        <ReactMarkdown className="overflow-y-auto h-2/3 mb-8" text={item.article || ""} />
        <a
          href={item.url}
          className="absolute bottom-2 right-2 block no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit
        </a>
      </div>
    </div>
  );
};

export default PreviewNewsDetail;
