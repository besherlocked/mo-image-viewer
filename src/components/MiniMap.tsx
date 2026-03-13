import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function MiniMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const { currentImageData, zoom, panX, panY, setPan } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const MAP_SIZE = 150;

  useEffect(() => {
    if (!currentImageData) return;
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = currentImageData;
  }, [currentImageData]);

  if (zoom <= 1 || !currentImageData || imgSize.w === 0) return null;

  const scale = Math.min(MAP_SIZE / imgSize.w, MAP_SIZE / imgSize.h);
  const mapW = imgSize.w * scale;
  const mapH = imgSize.h * scale;

  const viewW = mapW / zoom;
  const viewH = mapH / zoom;
  const viewX = mapW / 2 - viewW / 2 - (panX / (imgSize.w * zoom)) * mapW;
  const viewY = mapH / 2 - viewH / 2 - (panY / (imgSize.h * zoom)) * mapH;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    handleDrag(e);
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const relX = (mx - mapW / 2) / mapW;
    const relY = (my - mapH / 2) / mapH;
    setPan(-relX * imgSize.w * zoom, -relY * imgSize.h * zoom);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleDrag(e);
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  return (
    <div
      ref={mapRef}
      className="absolute bottom-12 right-4 border border-white/20 rounded-lg overflow-hidden shadow-lg cursor-crosshair z-20"
      style={{
        width: mapW,
        height: mapH,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <img
        src={currentImageData}
        alt="minimap"
        style={{ width: mapW, height: mapH, opacity: 0.8 }}
        draggable={false}
      />
      <div
        className="absolute border-2 border-cyan-400/80 rounded-sm"
        style={{
          left: Math.max(0, viewX),
          top: Math.max(0, viewY),
          width: Math.min(viewW, mapW),
          height: Math.min(viewH, mapH),
          backgroundColor: "rgba(0, 200, 255, 0.1)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
