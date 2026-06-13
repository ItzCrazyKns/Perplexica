'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import EmptyChatMessageInput from './EmptyChatMessageInput';
import { File } from './ChatWindow';
import Link from 'next/link';
import WeatherWidget from './WeatherWidget';
import NewsArticleWidget from './NewsArticleWidget';
import SettingsButtonMobile from '@/components/Settings/SettingsButtonMobile';
import {
  getShowNewsWidget,
  getShowWeatherWidget,
} from '@/lib/config/clientRegistry';
import { useChat, SpaceSummary } from '@/lib/hooks/useChat';

const SpaceIconMini = ({ icon }: { icon: SpaceSummary['icon'] }) => {
  if (!icon) return <div className="w-4 h-4 rounded bg-indigo-500/30" />;
  if (icon.type === 'emoji') {
    return <span className="text-base leading-none">{icon.value}</span>;
  }
  return <div className="w-4 h-4 rounded" style={{ backgroundColor: icon.value }} />;
};

const EmptyChat = () => {
  const { spaceInfo } = useChat();
  const [showWeather, setShowWeather] = useState(() =>
    typeof window !== 'undefined' ? getShowWeatherWidget() : true,
  );
  const [showNews, setShowNews] = useState(() =>
    typeof window !== 'undefined' ? getShowNewsWidget() : true,
  );

  useEffect(() => {
    const updateWidgetVisibility = () => {
      setShowWeather(getShowWeatherWidget());
      setShowNews(getShowNewsWidget());
    };

    updateWidgetVisibility();

    window.addEventListener('client-config-changed', updateWidgetVisibility);
    window.addEventListener('storage', updateWidgetVisibility);

    return () => {
      window.removeEventListener(
        'client-config-changed',
        updateWidgetVisibility,
      );
      window.removeEventListener('storage', updateWidgetVisibility);
    };
  }, []);

  return (
    <div className="relative">
      <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
        <SettingsButtonMobile />
      </div>
      <div className="flex flex-col items-center justify-center min-h-screen max-w-screen-sm mx-auto p-2 space-y-4">
        <div className="flex flex-col items-center justify-center w-full space-y-8">
          {spaceInfo && (
            <a
              href={`/spaces/${spaceInfo.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 text-sm text-black/70 dark:text-white/70 hover:text-[#24A0ED] transition-colors duration-150 -mt-4"
            >
              <SpaceIconMini icon={spaceInfo.icon} />
              <span>New thread in <strong>{spaceInfo.name}</strong></span>
            </a>
          )}
          <h2 className="text-black/70 dark:text-white/70 text-3xl font-medium -mt-8">
            Research begins here.
          </h2>
          <EmptyChatMessageInput />
        </div>
        {(showWeather || showNews) && (
          <div className="flex flex-col w-full gap-4 mt-2 sm:flex-row sm:justify-center">
            {showWeather && (
              <div className="flex-1 w-full">
                <WeatherWidget />
              </div>
            )}
            {showNews && (
              <div className="flex-1 w-full">
                <NewsArticleWidget />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyChat;
