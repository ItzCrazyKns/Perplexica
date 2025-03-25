'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export interface News {
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

  if (loading) return <p className="text-center text-lg">Loading news...</p>;
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

const NewsPage = () => {
  return (
    <>
        <NewsPageContent />
    </>
  );
};

export default NewsPage;