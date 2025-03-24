'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// TODO: add source with little profile pic of cnbc, bloomberg, etc.

export interface News {
  id: string;
  title: string;
  summary: string;
}

const mockNewsData: News[] = [
  {
    "id": "_TSLA2025OUTLOOK",
    "title": "Tesla faces market challenges but bets on AI and autonomy",
    "summary": "Tesla's stock has been volatile, currently at $279.17, after a 40% decline from recent highs. Revenue growth remains stagnant, and U.S. EV market share has dropped to 44%. Elon Musk's political engagements may be affecting brand perception, with Tesla registrations in Germany falling 76%. Despite challenges, Tesla is investing in AI, robotics, and autonomous driving, aiming to launch Full Self-Driving in Austin by June 2025 and the Cybercab ride-hailing vehicle by 2026. Analysts are divided—Morgan Stanley sees growth potential, while Bank of America has lowered its price target."
  }
  ,
  { id: '_4dn88SBPLM1', title: 'Tech giants announce a new AI breakthrough', summary: 'Tech giants announce a new AI breakthrough.' },
  { id: '_4dn88SBPLM2', title: 'Sports update: Local team secures championship win.', summary: 'Sports update: Local team secures championship win.' },
  { id: '_4dn88SBPLM3', title: 'Market trends: Stocks surge after latest reports.', summary: 'Market trends: Stocks surge after latest reports.' },
  { id: '_4dn88SBPLM4', title: 'Entertainment: Upcoming movies and releases for this year.', summary: 'Entertainment: Upcoming movies and releases for this year.' },
];

const NewsPage = () => {
  const [news] = useState<News[]>(mockNewsData);
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  const toggleSummary = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col pt-4">
        <div className="flex items-center">
          <Search />
          <h1 className="text-3xl font-medium p-2">Latest News</h1>
        </div>
        <hr className="border-t border-[#2B2C2C] my-4 w-full" />
      </div>

      <div className="flex flex-col pt-4 pb-28 lg:pb-8 w-full space-y-4">
        {news.map((item) => (
          <div
            key={item.id}
            className="rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 bg-white dark:bg-gray-800 overflow-hidden"
          >
            {/* Construct YouTube URL dynamically */}

            <div className="flex items-start space-x-4 pt-6">
              {/* Thumbnail on the Left */}
              <div className="w-1/4 aspect-[16/9] relative">
                <Link href={`https://www.youtube.com/watch?v=${item.id}`} target="_blank" className="block">
                  <Image
                    src="/placeholder1.jpg"
                    alt="placeholder"
                    fill
                    className="rounded-lg object-cover"
                  />
                </Link>
              </div>

              {/* Text on the Right */}
              <div className="flex-1 pt-2">
                <h2 className="text-xl font-bold text-black dark:text-white">{item.title}</h2>

                {/* Sliced Summary */}
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">
                  {expanded[item.id] ? item.summary : `${item.summary.slice(0, 100)}...`}
                </p>

                {/* Toggle Button */}
                <button
                  className="mt-2 text-blue-500 hover:text-blue-700 text-md font-semibold"
                  onClick={() => toggleSummary(item.id)}
                >
                  {expanded[item.id] ? 'Show Less' : 'Show More'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsPage;