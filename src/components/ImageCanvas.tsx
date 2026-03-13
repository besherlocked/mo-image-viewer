import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { useZoom } from "../hooks/useZoom";
import { BACKGROUND_STYLES } from "../utils/imageFormats";

export function ImageCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
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

  const getTransform = useCallback(() => {
    const transforms: string[] = [];
    transforms.push(`translate(${panX}px, ${panY}px)`);
    transforms.push(`scale(${zoom})`);
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    if (flipH) transforms.push("scaleX(-1)");
    if (flipV) transforms.push("scaleY(-1)");
    return transforms.join(" ");
  }, [panX, panY, zoom, rotation, flipH, flipV]);

  const getImageStyle = useCallback((): React.CSSProperties => {
    if (!containerRef.current || naturalSize.w === 0) {
      return {};
    }

    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = naturalSize.w;
    const ih = naturalSize.h;

    let width: number | string = "auto";
    let height: number | string = "auto";

    switch (fitMode) {
      case "contain": {
        const ratio = Math.min(cw / iw, ch / ih, 1);
        width = iw * ratio;
        height = ih * ratio;
        break;
      }
      case "width": {
        width = cw;
        height = (cw / iw) * ih;
        break;
      }
      case "height": {
        height = ch;
        width = (ch / ih) * iw;
        break;
      }
      case "original": {
        width = iw;
        height = ih;
        break;
      }
    }

    return {
      width,
      height,
      transform: getTransform(),
      transformOrigin: "center center",
      cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
      userSelect: "none",
      transition: isDragging ? "none" : "transform 0.05s ease-out",
    };
  }, [fitMode, naturalSize, getTransform, isDragging, zoom]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || zoom <= 1) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
    },
    [zoom, panX, panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan(e.clientX - dragStart.x, e.clientY - dragStart.y);
    },
    [isDragging, dragStart, setPan]
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
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const bgStyle = BACKGROUND_STYLES[background] || BACKGROUND_STYLES.dark;

  if (!currentImageData && images.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center"
        style={bgStyle}
      >
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
            支持 JPG, PNG, GIF, BMP, WebP, TIFF, SVG, AVIF 等格式
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-hidden relative"
      style={bgStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}

      {currentImageData && (
        <img
          ref={imgRef}
          src={currentImageData}
          alt={images[currentIndex]?.name ?? ""}
          style={getImageStyle()}
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
