export const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "tiff",
  "tif",
  "svg",
  "avif",
  "ico",
  "heic",
  "heif",
]);

export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

export const BACKGROUND_STYLES: Record<string, React.CSSProperties> = {
  dark: { backgroundColor: "#1a1a1a" },
  light: { backgroundColor: "#f0f0f0" },
  gray: { backgroundColor: "#808080" },
  checkerboard: {
    backgroundImage:
      "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
    backgroundColor: "#fff",
  },
};
