import React from "react";
import Image from "next/image";
import { ReactMarkdown } from "@/components/Markdown";

interface ContextItemProps {
  item: {
    name: string;
    url: string;
    description: string;
    provider: { name: string; image?: { thumbnail: { contentUrl: string } } }[];
    datePublished: string;
    image?: {
      contentUrl: string;
      thumbnail: { contentUrl: string; width: number; height: number };
    };
  };
}

const ContextItem: React.FC<ContextItemProps> = ({ item }) => {
  return (
    <div className="border p-4 rounded-lg mb-4 dark:border-gray-700">
      <h4 className="font-bold text-black dark:text-white">{item.name}</h4>
      {item.image && (
        <Image
          src={item.image.contentUrl}
          alt={item.name}
          width={item.image.thumbnail.width}
          height={item.image.thumbnail.height}
          className="my-2 rounded"
        />
      )}
      <div className="text-black dark:text-white">
        <ReactMarkdown text={item.description} />
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
        Read more
      </a>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {item.provider[0].name} | {new Date(item.datePublished).toLocaleDateString()}
      </div>
    </div>
  );
};

export default ContextItem;
