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
  };
}
const ContextItem: React.FC<ContextItemProperties> = ({ item }) => {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block no-underline text-black dark:text-white "
    >
      <div
        className="bg-gray-200 dark:bg-slate-900 rounded-lg px-6 py-2 ring-1 items-stretch h-56
      ring-slate-900/5 shadow-xl flex flex-row cursor-pointer hover:scale-95 transition-transform duration-300"
      >
        <div className="w-40 h-40 flex-shrink-0">
          {/* div for image if the link does not exist use the placeholder image */}
          {!item.image && (
            <img
              src={"https://via.placeholder.com/150"}
              alt={"placeholder"}
              className="rounded w-36 h-36 object-cover"
            />
          )}
          {item.image && <img src={item.image.contentUrl} alt={item.name} className="rounded w-36 h-36 object-cover" />}
        </div>
        <div className="flex flex-col items-stretch relative h-48">
          {/* div for other text info */}
          <div className="flex justify-start max-w-xl">
            <h4 className="font-bold text-white truncate">{item.name}</h4>
          </div>

          {/* Content container with controlled overflow */}
          <div className="max-32">
            <ReactMarkdown text={item.description} className="text-slate-500 dark:text-slate-40 line-clamp-3" />
          </div>

          {/* Absolute positioned provider info */}
          <div className="absolute bottom-3 right-0 text-sm text-gray-700 dark:text-gray-300 flex items-end">
            <div className="absolute right-40 top-0 bottom-0 w-40 bg-gradient-to-r from-transparent to-slate-900 pointer-events-none"></div>
            {item.provider[0].image && (
              <Image
                src={item.provider[0].image.thumbnail.contentUrl}
                alt={`${item.provider[0].name} logo`}
                width={16}
                height={16}
              />
            )}
            <span className="dark:bg-slate-900">{item.provider[0].name}</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 dark:bg-slate-900">
              {new Date(item.datePublished).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
};

export default ContextItem;
