/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { Message } from './ChatWindow';

type Image = {
  url: string;
  img_src: string;
  title: string;
};

const SearchImages = ({
  query,
  chatHistory,
  messageId,
  onImagesLoaded,
}: {
  query: string;
  chatHistory: Message[];
  messageId: string;
  onImagesLoaded?: (count: number) => void;
}) => {
  const [images, setImages] = useState<Image[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<any[]>([]);
  const [displayLimit, setDisplayLimit] = useState(10); // Initially show only 10 images
  const loadedMessageIdsRef = useRef<Set<string>>(new Set());

  // Function to show more images when the Show More button is clicked
  const handleShowMore = () => {
    // If we're already showing all images, don't do anything
    if (images && displayLimit >= images.length) return;

    // Otherwise, increase the display limit by 10, or show all images
    setDisplayLimit((prev) =>
      images ? Math.min(prev + 10, images.length) : prev,
    );
  };

  useEffect(() => {
    // Skip fetching if images are already loaded for this message
    if (loadedMessageIdsRef.current.has(messageId)) {
      return;
    }

    const fetchImages = async () => {
      // Mark as loaded to prevent refetching
      loadedMessageIdsRef.current.add(messageId);
      setLoading(true);

      const chatModelProvider = localStorage.getItem('chatModelProvider');
      const chatModel = localStorage.getItem('chatModel');
      const customOpenAIBaseURL = localStorage.getItem('openAIBaseURL');
      const customOpenAIKey = localStorage.getItem('openAIApiKey');
      const ollamaContextWindow =
        localStorage.getItem('ollamaContextWindow') || '2048';

      try {
        const res = await fetch(`/api/images`, {
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

        const images = data.images ?? [];
        setImages(images);
        setSlides(
          images.map((image: Image) => {
            return {
              src: image.img_src,
            };
          }),
        );
        if (onImagesLoaded && images.length > 0) {
          onImagesLoaded(images.length);
        }
      } catch (error) {
        console.error('Error fetching images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [query, messageId, chatHistory, onImagesLoaded]);

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
      {images !== null && images.length > 0 && (
        <>
          <div
            className="grid grid-cols-2 gap-2"
            key={`image-results-${messageId}`}
          >
            {images.slice(0, displayLimit).map((image, i) => (
              <img
                onClick={() => {
                  setOpen(true);
                  setSlides([
                    slides[i],
                    ...slides.slice(0, i),
                    ...slides.slice(i + 1),
                  ]);
                }}
                key={i}
                src={image.img_src}
                alt={image.title}
                className="h-full w-full aspect-video object-cover rounded-lg transition duration-200 active:scale-95 hover:scale-[1.02] cursor-zoom-in"
              />
            ))}
          </div>
          {images.length > displayLimit && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleShowMore}
                className="px-4 py-2 bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white rounded-md transition duration-200 flex items-center space-x-2"
              >
                <span>Show More Images</span>
                <span className="text-sm opacity-75">
                  ({displayLimit} of {images.length})
                </span>
              </button>
            </div>
          )}
          <Lightbox open={open} close={() => setOpen(false)} slides={slides} />
        </>
      )}
    </>
  );
};

export default SearchImages;
