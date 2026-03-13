import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/appStore";
import type { ThumbnailData } from "../types";

interface Props {
  folder: string;
}

export function ThumbnailGrid({ folder }: Props) {
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    invoke<ThumbnailData[]>("get_thumbnails", { folder, size: 150 })
      .then((data) => {
        if (!cancelled) {
          setThumbnails(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folder]);

  const handleClick = (path: string) => {
    useAppStore.getState().openFile(path);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (thumbnails.length === 0) {
    return (
      <div className="p-4 text-center text-white/40 text-sm">
        无图片文件
      </div>
    );
  }

  return (
    <div className="p-2 overflow-y-auto max-h-[380px]">
      <div className="grid grid-cols-3 gap-1.5">
        {thumbnails.map((thumb) => (
          <div
            key={thumb.path}
            className="group cursor-pointer"
            onClick={() => handleClick(thumb.path)}
          >
            <div className="aspect-square rounded overflow-hidden bg-black/30 border border-transparent group-hover:border-cyan-400/50 transition-colors">
              <img
                src={thumb.data}
                alt={thumb.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <p className="text-[10px] text-white/50 mt-0.5 truncate group-hover:text-white/80">
              {thumb.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
