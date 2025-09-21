export const ACCEPTED_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
] as const);

export type AcceptedImageMimeType = typeof ACCEPTED_IMAGE_MIME_TYPES[number];

export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const MIN_IMAGE_DIMENSION = 512;
export const MAX_IMAGE_DIMENSION = 2048;

export const isAcceptedImageMimeType = (mime: string | null | undefined): boolean => {
  if (!mime) return false;
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
};

export const getPreferredExtension = (mime: AcceptedImageMimeType): string => {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
};
