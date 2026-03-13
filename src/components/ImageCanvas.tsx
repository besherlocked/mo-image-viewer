import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { useZoom } from "../hooks/useZoom";
import { BACKGROUND_STYLES } from "../utils/imageFormats";

export function ImageCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const {
    currentImageData,
    zoom,
    rotation,
    flipH,
    flipV,
    panX,
    panY,
    setPan,
    fitMode,
    background,
    images,
    currentIndex,
    loading,
  } = useAppStore();

  useZoom(containerRef);

  const computeFitSize = useCallback(() => {
    if (!containerRef.current || naturalSize.w === 0) return null;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = naturalSize.w;
    const ih = naturalSize.h;

    switch (fitMode) {
      case "contain": {
        const ratio = Math.min(cw / iw, ch / ih, 1);
        return { w: iw * ratio, h: ih * ratio };
      }
      case "width":
        return { w: cw, h: (cw / iw) * ih };
      case "height":
        return { w: (ch / ih) * iw, h: ch };
      case "original":
        return { w: iw, h: ih };
      default:
        return { w: iw, h: ih };
    }
  }, [fitMode, naturalSize]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX,
        panY,
      };
    },
    [panX, panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan(dragStartRef.current.panX + dx, dragStartRef.current.panY + dy);
    },
    [isDragging, setPan]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      setNaturalSize({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  }, []);

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const bgStyle = BACKGROUND_STYLES[background] || BACKGROUND_STYLES.dark;
  const hasImage = currentImageData && images.length > 0;
  const fit = computeFitSize();

  const imgStyle: React.CSSProperties = fit
    ? {
        width: fit.w,
        height: fit.h,
        transform: [
          `translate(${panX}px, ${panY}px)`,
          `scale(${zoom})`,
          rotation ? `rotate(${rotation}deg)` : "",
          flipH ? "scaleX(-1)" : "",
          flipV ? "scaleY(-1)" : "",
        ]
          .filter(Boolean)
          .join(" "),
        transformOrigin: "center center",
        cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
        userSelect: "none" as const,
        transition: isDragging ? "none" : "transform 0.05s ease-out",
      }
    : {};

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-hidden relative"
      style={bgStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {!hasImage && (
        <div className="text-center text-gray-400 select-none">
          <svg
            className="w-24 h-24 mx-auto mb-4 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg">拖放图片或文件夹到此处打开</p>
          <p className="text-sm mt-2 opacity-60">
            支持 JPG, PNG, GIF, BMP, WebP, TIFF, SVG, AVIF, PSD 等格式
          </p>
        </div>
      )}

      {loading && hasImage && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}

      {hasImage && (
        <img
          ref={imgRef}
          src={currentImageData}
          alt={images[currentIndex]?.name ?? ""}
          style={imgStyle}
          onLoad={handleImageLoad}
          draggable={false}
          className="max-w-none"
        />
      )}

      {images.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 px-3 py-1 rounded-full text-sm select-none backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
          {zoom !== 1 && ` · ${Math.round(zoom * 100)}%`}
        </div>
      )}
    </div>
  );
}
