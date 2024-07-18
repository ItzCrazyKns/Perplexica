"use client";
import React, { useState } from "react";
import ContextItem from "./ContextItem";

interface ContextItemType {
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
    thumbnail: {
      contentUrl: string;
      width: number;
      height: number;
    };
  };
  article?: string;
  score?: number;
}

interface ExpandableItemsProperties {
  context: ContextItemType[];
}

const ExpandableItems: React.FC<ExpandableItemsProperties> = ({ context }) => {
  const [expanded, setExpanded] = useState(false);

  const handleShowMore = () => {
    setExpanded(!expanded);
  };

  return (
    <div>
      <button
        onClick={handleShowMore}
        className="transition duration-300 ease-in-out transform hover:scale-105  text-white font-bold py-2 px-4 rounded mb-4"
      >
        {expanded ? "Show Less" : `Show More (${context.length})`}
      </button>
      <div className="mb-4">
        <ContextItem item={context[0]} />
      </div>
      {expanded &&
        context.slice(1).map((item, index) => (
          <div key={index} className="mb-4 last:mb-0">
            <ContextItem item={item} />
          </div>
        ))}
    </div>
  );
};

export default ExpandableItems;
