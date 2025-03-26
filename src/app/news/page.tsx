'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface News {
  id: string;
  title: string;
  summary: string;
  description: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_AWS_DB_API_URL || '';
const API_URL = `${API_BASE_URL}?queryType=joint&num_results=20`;
const API_KEY = process.env.NEXT_PUBLIC_AWS_DB_API_KEY || '';

const NewsPageContent = () => {
  const [news, setNews] = useState<News[]>([]);
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch news: ${response.statusText}`);
        }

        const data = await response.json();

        console.log("API Response:", data); // Debugging: Log the API response

        // Convert API response into News format
        const formattedNews = data.result.map((item: any) => ({
          id: item[0],         // Video ID (used in YouTube links)
          title: item[1],      // News title
          description: item[3], // Short description
          summary: item[4],    // Full summary (for Show More)
        }));

        setNews(formattedNews);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const toggleSummary = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return (
    <div className="flex flex-row items-center justify-center min-h-screen">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  );

  if (error) return <p className="text-center text-lg text-red-500">Error: {error}</p>;

  return (
    <div className="max-w-screen-xl mx-auto px-4">
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
            className="w-full max-w-6xl mx-auto px-6 py-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row items-start space-y-4 lg:space-y-0 lg:space-x-4 pt-6">
              {/* Thumbnail on the Left */}
              <div className="w-1/2 aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${item.id}`}
                  title={item.title}
                  allowFullScreen
                  className="rounded-lg"
                ></iframe>
              </div>

              {/* Text on the Right */}
              <div className="flex-1 pt-2">
                <h2 className="text-xl font-bold text-black dark:text-white">{item.title}</h2>
                <p 
                  className={`text-lg text-gray-500 dark:text-gray-400 mt-2 overflow-hidden ${
                    expanded[item.id] ? '' : 'line-clamp-3'
                  }`}
                >
                  {expanded[item.id] ? item.description : `${item.description.slice(0, 120)}...`}
                </p>
                <button
                  className="mt-2 text-blue-500 hover:text-blue-700 text-md font-semibold"
                  onClick={() => toggleSummary(item.id)}
                >
                  {expanded[item.id] ? 'Show Less' : 'Show More'}
                </button>
              </div>
            </div>

            {expanded[item.id] && (
              <p className="text-md text-gray-500 dark:text-gray-400 mt-2">{item.summary}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsPageContent;