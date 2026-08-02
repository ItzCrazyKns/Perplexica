import { Globe2Icon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import SmallNewsCard from '@/components/Discover/SmallNewsCard';
import MajorNewsCard from '@/components/Discover/MajorNewsCard';
import {
  discoverTopics,
  getDiscoverArticles,
  isDiscoverTopic,
} from '@/lib/discover';

export interface Discover {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

/* Server component: the article fetch happens during render instead
   of a client fetch waterfall behind a spinner. Topic tabs are links
   driving the searchParams. */
const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) => {
  const { topic: topicParam } = await searchParams;
  const activeTopic = isDiscoverTopic(topicParam ?? '')
    ? (topicParam as (typeof discoverTopics)[number]['key'])
    : discoverTopics[0].key;

  let discover: Discover[] = [];

  try {
    const articles = await getDiscoverArticles(activeTopic);
    discover = articles.filter((blog: Discover) => blog.thumbnail);
  } catch (err: any) {
    console.error('Error fetching discover articles:', err.message);
  }

  return (
    <div>
      <div className="flex flex-col pt-10 border-b border-light-200/20 dark:border-dark-200/20 pb-6 px-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center justify-center">
            <Globe2Icon size={45} className="mb-2.5" />
            <h1
              className="text-5xl font-normal p-2"
              style={{ fontFamily: 'PP Editorial, serif' }}
            >
              Discover
            </h1>
          </div>
          <div className="flex flex-row items-center space-x-2 overflow-x-auto">
            {discoverTopics.map((t) => (
              <Link
                key={t.key}
                href={`/discover?topic=${t.key}`}
                className={cn(
                  'border-[0.1px] rounded-full text-sm px-3 py-1 text-nowrap transition duration-200 cursor-pointer',
                  activeTopic === t.key
                    ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-300/20 border-cyan-700/60 dar:bg-cyan-300/30 dark:border-cyan-300/40'
                    : 'border-black/30 dark:border-white/30 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                <span>{t.display}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-28 pt-5 lg:pb-8 w-full">
        <div className="block lg:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {discover.map((item, i) => (
              <SmallNewsCard key={`mobile-${i}`} item={item} />
            ))}
          </div>
        </div>

        <div className="hidden lg:block">{renderDesktopSections(discover)}</div>
      </div>
    </div>
  );
};

const renderDesktopSections = (discover: Discover[]) => {
  if (discover.length === 0) return null;

  const sections = [];
  let index = 0;

  while (index < discover.length) {
    if (sections.length > 0) {
      sections.push(
        <hr
          key={`sep-${index}`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < discover.length) {
      sections.push(
        <MajorNewsCard
          key={`major-${index}`}
          item={discover[index]}
          isLeft={false}
        />,
      );
      index++;
    }

    if (index < discover.length) {
      sections.push(
        <hr
          key={`sep-${index}-after`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < discover.length) {
      const smallCards = discover.slice(index, index + 3);
      sections.push(
        <div
          key={`small-group-${index}`}
          className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4"
        >
          {smallCards.map((item, i) => (
            <SmallNewsCard key={`small-${index + i}`} item={item} />
          ))}
        </div>,
      );
      index += 3;
    }

    if (index < discover.length) {
      sections.push(
        <hr
          key={`sep-${index}-after-small`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < discover.length - 1) {
      const twoMajorCards = discover.slice(index, index + 2);
      twoMajorCards.forEach((item, i) => {
        sections.push(
          <MajorNewsCard
            key={`double-${index + i}`}
            item={item}
            isLeft={i === 0}
          />,
        );
        if (i === 0) {
          sections.push(
            <hr
              key={`sep-double-${index + i}`}
              className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
            />,
          );
        }
      });
      index += 2;
    } else if (index < discover.length) {
      sections.push(
        <MajorNewsCard
          key={`final-major-${index}`}
          item={discover[index]}
          isLeft={true}
        />,
      );
      index++;
    }

    if (index < discover.length) {
      sections.push(
        <hr
          key={`sep-${index}-after-major`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < discover.length) {
      const smallCards = discover.slice(index, index + 3);
      sections.push(
        <div
          key={`small-group-2-${index}`}
          className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4"
        >
          {smallCards.map((item, i) => (
            <SmallNewsCard key={`small-2-${index + i}`} item={item} />
          ))}
        </div>,
      );
      index += 3;
    }
  }

  return sections;
};

export default Page;
