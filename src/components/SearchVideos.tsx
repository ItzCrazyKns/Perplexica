/* eslint-disable @next/next/no-img-element */
import { PlayCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Lightbox, { GenericSlide, VideoSlide } from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { Message } from './ChatWindow';

type Video = {
  url: string;
  img_src: string;
  title: string;
  iframe_src: string;
};

declare module 'yet-another-react-lightbox' {
  export interface VideoSlide extends GenericSlide {
    type: 'video-slide';
    src: string;
    iframe_src: string;
  }

  interface SlideTypes {
    'video-slide': VideoSlide;
  }
}

const Searchvideos = ({
  query,
  chatHistory,
  messageId,
  onVideosLoaded,
}: {
  query: string;
  chatHistory: Message[];
  messageId: string;
  onVideosLoaded?: (count: number) => void;
}) => {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<VideoSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<(HTMLIFrameElement | null)[]>([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Skip fetching if videos are already loaded for this message
    if (hasLoadedRef.current) {
      return;
    }

    const fetchVideos = async () => {
      setLoading(true);

      const chatModelProvider = localStorage.getItem('chatModelProvider');
      const chatModel = localStorage.getItem('chatModel');
      const customOpenAIBaseURL = localStorage.getItem('openAIBaseURL');
      const customOpenAIKey = localStorage.getItem('openAIApiKey');
      const ollamaContextWindow =
        localStorage.getItem('ollamaContextWindow') || '2048';

      try {
        const res = await fetch(`/api/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            chatHistory: chatHistory,
            chatModel: {
              provider: chatModelProvider,
              model: chatModel,
              ...(chatModelProvider === 'custom_openai' && {
                customOpenAIBaseURL: customOpenAIBaseURL,
                customOpenAIKey: customOpenAIKey,
              }),
              ...(chatModelProvider === 'ollama' && {
                ollamaContextWindow: parseInt(ollamaContextWindow),
              }),
            },
          }),
        });

        const data = await res.json();

        const videos = data.videos ?? [];
        setVideos(videos);
        setSlides(
          videos.map((video: Video) => {
            return {
              type: 'video-slide',
              iframe_src: video.iframe_src,
              src: video.img_src,
            };
          }),
        );
        if (onVideosLoaded && videos.length > 0) {
          onVideosLoaded(videos.length);
        }
        // Mark as loaded to prevent refetching
        hasLoadedRef.current = true;
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();

    // Reset the loading state when component unmounts
    return () => {
      hasLoadedRef.current = false;
    };
  }, [query, messageId]);

  return (
    <>
      {loading && (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-light-secondary dark:bg-dark-secondary h-32 w-full rounded-lg animate-pulse aspect-video object-cover"
            />
          ))}
        </div>
      )}
      {videos !== null && videos.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {videos.map((video, i) => (
              <div
                onClick={() => {
                  setOpen(true);
                  setSlides([
                    slides[i],
                    ...slides.slice(0, i),
                    ...slides.slice(i + 1),
                  ]);
                }}
                className="relative transition duration-200 active:scale-95 hover:scale-[1.02] cursor-pointer"
                key={i}
              >
                <img
                  src={video.img_src}
                  alt={video.title}
                  className="relative h-full w-full aspect-video object-cover rounded-lg"
                />
                <div className="absolute bg-white/70 dark:bg-black/70 text-black/70 dark:text-white/70 px-2 py-1 flex flex-row items-center space-x-1 bottom-1 right-1 rounded-md">
                  <PlayCircle size={15} />
                  <p className="text-xs">Video</p>
                </div>
              </div>
            ))}
          </div>
          <Lightbox
            open={open}
            close={() => setOpen(false)}
            slides={slides}
            index={currentIndex}
            on={{
              view: ({ index }) => {
                const previousIframe = videoRefs.current[currentIndex];
                if (previousIframe?.contentWindow) {
                  previousIframe.contentWindow.postMessage(
                    '{"event":"command","func":"pauseVideo","args":""}',
                    '*',
                  );
                }

                setCurrentIndex(index);
              },
            }}
            render={{
              slide: ({ slide }) => {
                const index = slides.findIndex((s) => s === slide);
                return slide.type === 'video-slide' ? (
                  <div className="h-full w-full flex flex-row items-center justify-center">
                    <iframe
                      src={`${slide.iframe_src}${slide.iframe_src.includes('?') ? '&' : '?'}enablejsapi=1`}
                      ref={(el) => {
                        if (el) {
                          videoRefs.current[index] = el;
                        }
                      }}
                      className="aspect-video max-h-[95vh] w-[95vw] rounded-2xl md:w-[80vw]"
                      allowFullScreen
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                ) : null;
              },
            }}
          />
        </>
      )}
    </>
  );
};

export default Searchvideos;
