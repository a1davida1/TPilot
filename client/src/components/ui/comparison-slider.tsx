import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ComparisonSliderProps {
  originalImage: string;
  protectedImage: string;
  initialPosition?: number;
  onPositionChange?: (position: number) => void;
  className?: string;
}

export function ComparisonSlider({
  originalImage,
  protectedImage,
  initialPosition = 50,
  onPositionChange,
  className
}: ComparisonSliderProps) {
  const [position, setPosition] = useState(initialPosition);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    setPosition(percentage);
    onPositionChange?.(percentage);
  };

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseFloat(e.target.value);
    setPosition(newPosition);
    onPositionChange?.(newPosition);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border bg-muted"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Protected image (bottom layer) */}
        <img
          src={protectedImage}
          alt="Protected"
          className="absolute inset-0 w-full h-full object-contain select-none"
          draggable={false}
        />

        {/* Original image (top layer with clipping) */}
        <div
          className="absolute inset-0 overflow-hidden select-none"
          style={{ width: `${position}%` }}
        >
          <img
            src={originalImage}
            alt="Original"
            className="absolute inset-0 w-full h-full object-contain select-none"
            style={{ width: containerRef.current ? `${(containerRef.current.offsetWidth / position) * 100}%` : '100%' }}
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-ew-resize z-10"
          style={{ left: `${position}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={() => isDragging.current = true}
          onTouchEnd={() => isDragging.current = false}
        >
          {/* Drag handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-700">
              <path d="M6 4L2 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 4L14 8L10 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          Original
        </div>
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          Protected
        </div>
      </div>

      {/* Slider control */}
      <div className="px-2">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={position}
          onChange={handleSliderChange}
          aria-label="Reveal original image"
          data-testid="comparison-slider"
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Protected Only</span>
          <span>{position.toFixed(0)}%</span>
          <span>Original Only</span>
        </div>
      </div>
    </div>
  );
}
