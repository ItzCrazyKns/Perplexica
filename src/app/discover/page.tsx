'use client';

import { Search, Sliders, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, useRef, memo, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Discover {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

const categories = [
  'For You', 'AI', 'Technology', 'Current News', 'Sports', 
  'Money', 'Gaming', 'Entertainment', 'Art and Culture', 
  'Science', 'Health', 'Travel'
];

// Header component with categories
const DiscoverHeader = memo(({ 
  activeCategory, 
  setActiveCategory, 
  setShowPreferences,
  userPreferences
}: { 
  activeCategory: string; 
  setActiveCategory: (category: string) => void;
  setShowPreferences: (show: boolean) => void;
  userPreferences: string[];
}) => {
  const categoryContainerRef = useRef<HTMLDivElement>(null);

  // Filter categories to show only what the user has selected in preferences
  // Always include "For You" and the currently active category if it's not in preferences
  const visibleCategories = useMemo(() => {
    // Always start with "For You"
    const filtered = ['For You'];
    
    // Add user's preferred categories
    userPreferences.forEach(category => {
      if (!filtered.includes(category)) {
        filtered.push(category);
      }
    });
    
    // Add active category if it's not already included
    if (activeCategory && !filtered.includes(activeCategory)) {
      filtered.push(activeCategory);
    }
    
    // If user has no preferences, show a limited default set
    if (filtered.length <= 1) {
      return ['For You', 'AI', 'Technology', 'Current News'];
    }
    
    return filtered;
  }, [userPreferences, activeCategory]);

  const scrollCategories = (direction: 'left' | 'right') => {
    const container = categoryContainerRef.current;
    if (!container) return;
    
    const scrollAmount = container.clientWidth * 0.8;
    const currentScroll = container.scrollLeft;
    
    container.scrollTo({
      left: direction === 'left' 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <div className="flex flex-col pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Search />
          <h1 className="text-3xl font-medium p-2">Discover</h1>
        </div>
        <button 
          className="p-2 rounded-full bg-light-secondary dark:bg-dark-secondary hover:bg-light-primary hover:dark:bg-dark-primary transition-colors"
          onClick={() => setShowPreferences(true)}
          aria-label="Personalize"
        >
          <Sliders size={20} />
        </button>
      </div>
      
      <div className="relative flex items-center py-4">
        <button 
          className="absolute left-0 z-10 p-1 rounded-full bg-light-secondary dark:bg-dark-secondary hover:bg-light-primary/80 hover:dark:bg-dark-primary/80 transition-colors"
          onClick={() => scrollCategories('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div 
          className="flex overflow-x-auto mx-8 no-scrollbar scroll-smooth" 
          ref={categoryContainerRef}
          style={{ scrollbarWidth: 'none' }} // For Firefox
        >
          <div className="flex space-x-2">
            {visibleCategories.map((category) => (
              <button
                key={category}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  activeCategory === category 
                    ? 'bg-light-primary dark:bg-dark-primary text-white' 
                    : 'bg-light-secondary dark:bg-dark-secondary hover:bg-light-primary/80 hover:dark:bg-dark-primary/80'
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          className="absolute right-0 z-10 p-1 rounded-full bg-light-secondary dark:bg-dark-secondary hover:bg-light-primary/80 hover:dark:bg-dark-primary/80 transition-colors"
          onClick={() => scrollCategories('right')}
          aria-label="Scroll right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      <hr className="border-t border-[#2B2C2C] my-4 w-full" />
    </div>
  );
});

DiscoverHeader.displayName = 'DiscoverHeader';

// Content component that displays articles
const DiscoverContent = memo(({ 
  activeCategory, 
  userPreferences, 
  preferredLanguages 
}: { 
  activeCategory: string; 
  userPreferences: string[];
  preferredLanguages: string[];
}) => {
  const [discover, setDiscover] = useState<Discover[] | null>(null);
  const [contentLoading, setContentLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setContentLoading(true);
      try {
        let endpoint = `/api/discover`;
        let params = [];
        
        if (activeCategory !== 'For You') {
          params.push(`category=${encodeURIComponent(activeCategory)}`);
        } else if (userPreferences.length > 0) {
          params.push(`preferences=${encodeURIComponent(JSON.stringify(userPreferences))}`);
        }
        
        if (preferredLanguages.length > 0) {
          params.push(`languages=${encodeURIComponent(JSON.stringify(preferredLanguages))}`);
        }
        
        if (params.length > 0) {
          endpoint += `?${params.join('&')}`;
        }
        
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message);
        }

        // Filter out items without thumbnails (double-checking)
        data.blogs = data.blogs.filter((blog: Discover) => blog.thumbnail);

        setDiscover(data.blogs);
      } catch (err: any) {
        console.error('Error fetching data:', err.message);
        toast.error('Error fetching data');
      } finally {
        setContentLoading(false);
      }
    };

    fetchData();
  }, [activeCategory, userPreferences, preferredLanguages]);

  if (contentLoading) {
    return (
      <div className="flex flex-row items-center justify-center py-20">
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
  }

  if (!discover || discover.length === 0) {
    return (
      <div className="flex flex-row items-center justify-center min-h-[50vh]">
        <p className="text-black/70 dark:text-white/70 text-sm">
          No content found for this category.
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 pb-28 lg:pb-8 w-full justify-items-center lg:justify-items-start">
      {discover.map((item, i) => (
        <Link
          href={`/?q=Summary: ${item.url}`}
          key={i}
          className="max-w-sm rounded-lg overflow-hidden bg-light-secondary dark:bg-dark-secondary hover:-translate-y-[1px] transition duration-200"
          target="_blank"
        >
          {/* Using img tag with URL processing for thumbnails */}
          <img
            className="object-cover w-full aspect-video"
            src={
              new URL(item.thumbnail).origin +
              new URL(item.thumbnail).pathname +
              `?id=${new URL(item.thumbnail).searchParams.get('id')}`
            }
            alt={item.title}
          />
          <div className="px-6 py-4">
            <div className="font-bold text-lg mb-2">
              {item.title.slice(0, 100)}...
            </div>
            <p className="text-black-70 dark:text-white/70 text-sm">
              {item.content.slice(0, 100)}...
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
});

DiscoverContent.displayName = 'DiscoverContent';

// Preferences modal for personalization
const PreferencesModal = memo(({
  showPreferences,
  setShowPreferences,
  userPreferences,
  setUserPreferences,
  preferredLanguages,
  setPreferredLanguages,
  setActiveCategory
}: {
  showPreferences: boolean;
  setShowPreferences: (show: boolean) => void;
  userPreferences: string[];
  setUserPreferences: (prefs: string[]) => void;
  preferredLanguages: string[];
  setPreferredLanguages: (langs: string[]) => void;
  setActiveCategory: (category: string) => void;
}) => {
  const [tempPreferences, setTempPreferences] = useState<string[]>([]);
  const [tempLanguages, setTempLanguages] = useState<string[]>([]);

  useEffect(() => {
    if (showPreferences) {
      setTempPreferences([...userPreferences]);
      setTempLanguages([...preferredLanguages]);
    }
  }, [showPreferences, userPreferences, preferredLanguages]);

  const saveUserPreferences = async (preferences: string[], languages: string[]) => {
    try {
      const res = await fetch(`/api/discover/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          categories: preferences,
          languages
        }),
      });

      if (res.ok) {
        toast.success('Preferences saved successfully');
      } else {
        const data = await res.json();
        throw new Error(data.message);
      }
    } catch (err: any) {
      console.error('Error saving preferences:', err.message);
      toast.error('Error saving preferences');
    }
  };

  if (!showPreferences) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Personalize Your Feed</h2>
        
        <h3 className="font-medium mb-2">Select categories you&apos;re interested in:</h3>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {categories.filter(c => c !== 'For You').map((category) => (
            <button
              key={category}
              onClick={() => {
                if (tempPreferences.includes(category)) {
                  setTempPreferences(tempPreferences.filter(p => p !== category));
                } else {
                  setTempPreferences([...tempPreferences, category]);
                }
              }}
              className={`px-3 py-2 rounded-md text-left transition-colors border ${
                tempPreferences.includes(category)
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-light-secondary dark:bg-dark-secondary border-gray-400 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        <div className="mb-6">
          <h3 className="font-medium mb-2">Preferred Languages</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { code: 'en', name: 'English' },
              { code: 'ar', name: 'Arabic' },
              { code: 'zh', name: 'Chinese' },
              { code: 'fr', name: 'French' },
              { code: 'de', name: 'German' },
              { code: 'hi', name: 'Hindi' },
              { code: 'it', name: 'Italian' },
              { code: 'ja', name: 'Japanese' },
              { code: 'ko', name: 'Korean' },
              { code: 'pt', name: 'Portuguese' },
              { code: 'ru', name: 'Russian' },
              { code: 'es', name: 'Spanish' },
            ].map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  if (tempLanguages.includes(language.code)) {
                    setTempLanguages(tempLanguages.filter(l => l !== language.code));
                  } else {
                    setTempLanguages([...tempLanguages, language.code]);
                  }
                }}
                className={`px-3 py-2 rounded-md text-left transition-colors border ${
                  tempLanguages.includes(language.code)
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-light-secondary dark:bg-dark-secondary border-gray-400 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
                }`}
              >
                {language.name}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {tempLanguages.length === 0 
              ? "No languages selected will show results in all languages" 
              : `Selected: ${tempLanguages.length} language(s)`}
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button 
            className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
            onClick={() => {
              setShowPreferences(false);
              // Reset temp preferences
              setTempPreferences([]);
              setTempLanguages([]);
            }}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 rounded bg-light-primary dark:bg-dark-primary text-white hover:bg-light-primary/80 hover:dark:bg-dark-primary/80 transition-colors"
            onClick={async () => {
              await saveUserPreferences(tempPreferences, tempLanguages);
              // Update the actual preferences after saving
              setUserPreferences(tempPreferences);
              setPreferredLanguages(tempLanguages);
              setShowPreferences(false);
              setActiveCategory('For You'); // Switch to For You view to show personalized content
              
              // Reset temp preferences
              setTempPreferences([]);
              setTempLanguages([]);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
});

PreferencesModal.displayName = 'PreferencesModal';

// Main page component
const Page = () => {
  const [activeCategory, setActiveCategory] = useState('For You');
  const [showPreferences, setShowPreferences] = useState(false);
  const [userPreferences, setUserPreferences] = useState<string[]>(['AI', 'Technology']);
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>(['en']);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load user preferences on initial render
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const res = await fetch(`/api/discover/preferences`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUserPreferences(data.categories || ['AI', 'Technology']);
          setPreferredLanguages(data.languages || ['en']);
        }
      } catch (err: any) {
        console.error('Error loading preferences:', err.message);
      } finally {
        setInitialLoading(false);
      }
    };

    loadUserPreferences();
  }, []);

  if (initialLoading) {
    return (
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
  }

  return (
    <div>
      <DiscoverHeader 
        activeCategory={activeCategory} 
        setActiveCategory={setActiveCategory} 
        setShowPreferences={setShowPreferences}
        userPreferences={userPreferences}
      />
      
      <DiscoverContent 
        activeCategory={activeCategory} 
        userPreferences={userPreferences} 
        preferredLanguages={preferredLanguages} 
      />
      
      <PreferencesModal 
        showPreferences={showPreferences}
        setShowPreferences={setShowPreferences}
        userPreferences={userPreferences}
        setUserPreferences={setUserPreferences}
        preferredLanguages={preferredLanguages}
        setPreferredLanguages={setPreferredLanguages}
        setActiveCategory={setActiveCategory}
      />
    </div>
  );
};

export default Page;
