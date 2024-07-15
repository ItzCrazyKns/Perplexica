"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import Link from "next/link";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  image: string;
}

const NewsPage = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        console.log("Fetching news...");
        const response = await fetch("/api/news");
        console.log("Response status:", response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched data:", data);
        setNews(data);
      } catch (error) {
        console.error("Error fetching news:", error);
        setError(`Failed to load news. Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-row items-center justify-center min-h-screen">
          <p className="text-black/70 dark:text-white/70 text-sm">Loading news...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-red-500 text-sm mb-2">Failed to load news.</p>
          <p className="text-red-500 text-xs">{error}</p>
        </div>
      );
    }

    if (news.length === 0) {
      return <p className="text-black/70 dark:text-white/70 text-sm text-center">No news available.</p>;
    }
    return (
      <div className="flex flex-col pt-16 lg:pt-24">
        {news.map(item => (
          <div
            key={item.id}
            className="flex flex-col space-y-4 border-b border-white-200 dark:border-dark-200 py-6 md:mx-4"
          >
            {/* Large and Small Responsive Screen Layout */}
            <Link href={`/news/${item.id}`} className="cursor-pointer md:flex flex-row">
              <img src={item.image} alt={item.title} className="w-full h-48 md:h-32 object-cover rounded-lg md:w-32" />
              <div className="flex flex-col space-y-5 ml-4">
                <h3 className="text-black dark:text-white md:text-xl font-medium hover:underline">{item.title}</h3>
                <p className="text-black/70 dark:text-white/70 text-sm hover:text-black dark:hover:text-white">
                  {item.summary}
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="fixed z-40 top-0 left-0 right-0 lg:pl-[104px] lg:pr-6 lg:px-8 px-4 py-4 lg:py-6 border-b border-light-200 dark:border-dark-200">
        <div className="flex flex-row items-center space-x-2 max-w-screen-lg lg:mx-auto">
          <Newspaper />
          <h2 className="text-black dark:text-white lg:text-3xl lg:font-medium">News</h2>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default NewsPage;
