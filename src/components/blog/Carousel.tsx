import { useState, useEffect, useCallback, useRef } from 'react';

interface CarouselImage {
  src: string;
  caption?: string;
}

interface CarouselProps {
  images?: CarouselImage[];
}

export default function Carousel({ images: propImages }: CarouselProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<CarouselImage[]>(propImages || []);
  const touchStartX = useRef<number | null>(null);

  // On mount, collect all prose images for the carousel
  useEffect(() => {
    const proseImages = document.querySelectorAll('.prose img');
    if (proseImages.length > 0) {
      const collectedImages = Array.from(proseImages).map((img) => {
        const htmlImg = img as HTMLImageElement;
        return {
          src: htmlImg.src,
          caption: htmlImg.alt || htmlImg.title || '',
        };
      });
      setImages(collectedImages);

      // Make images clickable
      proseImages.forEach((img, index) => {
        const htmlImg = img as HTMLImageElement;
        htmlImg.style.cursor = 'pointer';
        htmlImg.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('open-carousel', { detail: { index } }));
        });
      });
    }
  }, []);

  const open = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
    document.body.classList.add('carousel-open');
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    document.body.classList.remove('carousel-open');
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0) {
      setCurrentIndex(images.length - 1);
    } else if (index >= images.length) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(index);
    }
  }, [images.length]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen) return;

    const preloadIndices = [
      (currentIndex - 1 + images.length) % images.length,
      (currentIndex + 1) % images.length,
    ];

    preloadIndices.forEach((idx) => {
      const img = new Image();
      img.src = images[idx].src;
    });
  }, [currentIndex, images, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'Escape':
          close();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goNext, goPrev, close]);

  // Listen for open-carousel custom event
  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ index: number }>) => {
      open(e.detail.index);
    };

    window.addEventListener('open-carousel', handleOpen as EventListener);
    return () => window.removeEventListener('open-carousel', handleOpen as EventListener);
  }, [open]);

  // Handle touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    touchStartX.current = null;
  };

  // Handle image load
  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Handle click navigation (left/right thirds)
  const handleMainClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (x < third) {
      goPrev();
    } else if (x > third * 2) {
      goNext();
    }
  };

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className={`carousel ${isOpen ? 'is-open' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="carousel-close"
        onClick={close}
        aria-label="Close carousel"
      >
        ×
      </button>

      <div className="carousel-counter">
        {currentIndex + 1} / {images.length}
      </div>

      <div className="carousel-main" onClick={handleMainClick}>
        <div className="carousel-image-wrapper">
          <img
            src={currentImage.src}
            alt={currentImage.caption || ''}
            className={`carousel-image ${isLoading ? 'is-loading' : ''}`}
            onLoad={handleImageLoad}
          />
        </div>
      </div>

      {currentImage.caption && (
        <div className="carousel-caption">{currentImage.caption}</div>
      )}

      {currentIndex > 0 && (
        <button
          className="carousel-nav carousel-nav--prev"
          onClick={goPrev}
          aria-label="Previous image"
        >
          ‹
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          className="carousel-nav carousel-nav--next"
          onClick={goNext}
          aria-label="Next image"
        >
          ›
        </button>
      )}
    </div>
  );
}
