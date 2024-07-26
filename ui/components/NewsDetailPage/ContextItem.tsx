import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ReactMarkdown } from "@/components/Markdown";
import PreviewNewsDetail from "./PreviewNewsDetail";

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
}

const ProviderInfo: React.FC<{ name: string; date: string }> = ({ name, date }) => (
  <div className="absolute -bottom-3 right-0 text-sm text-gray-700 dark:text-gray-300 flex items-end">
    <div className="relative dark:bg-slate-900 flex items-center">
      <span className="truncate max-w-xs">{name}</span>
      <span className="truncate max-w-xs text-xs text-gray-500 dark:text-gray-400 pl-3">{date}</span>
    </div>
  </div>
);

const ContextItem: React.FC<ContextItemProperties> = ({ item }) => {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const togglePreview = () => {
    setIsPreviewVisible(!isPreviewVisible);
  };

  return (
    <>
      <div
        onClick={togglePreview}
        className="no-underline text-black dark:text-white bg-gray-200 dark:bg-slate-900 rounded-lg px-6 py-2 ring-1 items-stretch h-56 ring-slate-900/5 shadow-xl flex flex-row cursor-pointer hover:scale-95 transition-transform duration-300"
      >
        <div className="w-40 h-40 flex-shrink-0">
          {item.image ? (
            <Image
              src={item.image.contentUrl}
              alt={item.name}
              width={150}
              height={150}
              className="rounded w-36 h-36 object-cover"
            />
          ) : (
            <Image
              src={"https://via.placeholder.com/150"}
              alt={"placeholder"}
              width={150}
              height={150}
              className="rounded w-36 h-36 object-cover"
            />
          )}
        </div>
        <div className="flex flex-col items-stretch relative h-48">
          <div className="flex justify-start max-w-xl">
            <h4 className="font-bold text-black dark:text-white truncate">{item.name}</h4>
          </div>
          <div className="max-32 overflow-hidden">
            <ReactMarkdown text={item.description} className="text-gray-700 dark:text-gray-300 line-clamp-3" />
          </div>
          <ProviderInfo name={item.provider[0].name} date={new Date(item.datePublished).toLocaleDateString()} />
        </div>
      </div>

      {isPreviewVisible && <PreviewNewsDetail item={item} togglePreview={togglePreview} />}
    </>
  );
};

export default ContextItem;
