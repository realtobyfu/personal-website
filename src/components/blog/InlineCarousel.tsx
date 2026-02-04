import { useState, useRef, useCallback } from 'react';

interface InlineCarouselImage {
  src: string;
  caption?: string;
}

interface InlineCarouselProps {
  images: InlineCarouselImage[];
}

export default function InlineCarousel({ images }: InlineCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

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

  const handleImageClick = () => {
    window.dispatchEvent(new CustomEvent('open-carousel', { detail: { index: currentIndex } }));
  };

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="inline-carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="inline-carousel-container">
        {images.length > 1 && (
          <button
            className="inline-carousel-nav inline-carousel-nav--prev"
            onClick={goPrev}
            aria-label="Previous image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        <div className="inline-carousel-image-wrapper" onClick={handleImageClick}>
          <img
            src={currentImage.src}
            alt={currentImage.caption || ''}
            className="inline-carousel-image"
          />
        </div>

        {images.length > 1 && (
          <button
            className="inline-carousel-nav inline-carousel-nav--next"
            onClick={goNext}
            aria-label="Next image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {currentImage.caption && (
        <div className="inline-carousel-caption">{currentImage.caption}</div>
      )}

      {images.length > 1 && (
        <div className="inline-carousel-dots">
          {images.map((_, index) => (
            <button
              key={index}
              className={`inline-carousel-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goTo(index)}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
