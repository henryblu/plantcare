import {
  AcceptedImageMimeType,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_UPLOAD_BYTES,
  MIN_IMAGE_DIMENSION,
  getPreferredExtension,
  isAcceptedImageMimeType,
} from "@core/constants/image";

export interface PreparedImageFile {
  file: File;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasDownscaled: boolean;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const ORIENTATION_TAG = 0x0112;
const LITTLE_ENDIAN = 0x4949;
const BIG_ENDIAN = 0x4d4d;

const needsDimensionSwap = (orientation: number): boolean => orientation >= 5 && orientation <= 8;

const readOrientation = (buffer: ArrayBuffer): number => {
  const view = new DataView(buffer);
  if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) {
    return 1;
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset + 4 <= length) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    if ((marker & 0xff00) !== 0xff00) {
      break;
    }

    const size = view.getUint16(offset, false);
    offset += 2;

    if (size < 2 || offset + size - 2 > length) {
      break;
    }

    if (marker === 0xffe1) {
      const EXIF_MAGIC = 0x45786966;
      const exifHeader = view.getUint32(offset, false);
      if (exifHeader !== EXIF_MAGIC) {
        offset += size - 2;
        continue;
      }

      const tiffOffset = offset + 6;
      if (tiffOffset + 8 > length) {
        break;
      }

      const endian = view.getUint16(tiffOffset, false);
      if (endian !== LITTLE_ENDIAN && endian !== BIG_ENDIAN) {
        break;
      }

      const littleEndian = endian === LITTLE_ENDIAN;
      const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
      let directoryOffset = tiffOffset + firstIfdOffset;
      if (directoryOffset + 2 > length) {
        break;
      }

      const entries = view.getUint16(directoryOffset, littleEndian);
      directoryOffset += 2;

      for (let index = 0; index < entries; index += 1) {
        const entryOffset = directoryOffset + index * 12;
        if (entryOffset + 12 > length) {
          break;
        }

        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === ORIENTATION_TAG) {
          const value = view.getUint16(entryOffset + 8, littleEndian);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }

      break;
    }

    offset += size - 2;
  }

  return 1;
};

const loadImageElement = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageValidationError("Failed to load the selected image."));
    };
    image.src = url;
  });

const applyOrientationTransform = (
  context: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
): void => {
  switch (orientation) {
    case 2:
      context.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      context.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      context.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      context.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      context.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      context.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      context.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      context.transform(1, 0, 0, 1, 0, 0);
      break;
  }
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: AcceptedImageMimeType,
): Promise<{ blob: Blob; type: AcceptedImageMimeType }> =>
  new Promise((resolve, reject) => {
    const attempt = (type: AcceptedImageMimeType, triedFallback = false) => {
      const quality = type === "image/jpeg" ? 0.92 : undefined;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, type });
            return;
          }

          if (!triedFallback && type !== "image/png") {
            attempt("image/png", true);
            return;
          }

          reject(new ImageValidationError("Failed to encode the processed image."));
        },
        type,
        quality,
      );
    };

    attempt(mimeType);
  });

const normalizeFileName = (name: string | undefined, mimeType: AcceptedImageMimeType): string => {
  const extension = getPreferredExtension(mimeType);
  const safeName = name && name.trim().length > 0 ? name.trim() : "plant-photo";
  const base = safeName.replace(/\.[^./\\]+$/, "");
  return `${base}${extension}`;
};

export const prepareImageFile = async (file: File): Promise<PreparedImageFile> => {
  const mimeType = file.type?.toLowerCase() ?? "";
  if (!isAcceptedImageMimeType(mimeType)) {
    throw new ImageValidationError("Unsupported image format. Use JPEG, PNG, or WEBP.");
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ImageValidationError("Image must be 8 MB or smaller.");
  }

  const sliceSize = Math.min(file.size, 256 * 1024);
  const buffer = await file.slice(0, sliceSize).arrayBuffer();
  const orientation = mimeType === "image/jpeg" ? readOrientation(buffer) : 1;

  const image = await loadImageElement(file);
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;

  if (!originalWidth || !originalHeight) {
    throw new ImageValidationError("Could not read image dimensions.");
  }

  const orientedWidth = needsDimensionSwap(orientation) ? originalHeight : originalWidth;
  const orientedHeight = needsDimensionSwap(orientation) ? originalWidth : originalHeight;

  if (orientedWidth < MIN_IMAGE_DIMENSION || orientedHeight < MIN_IMAGE_DIMENSION) {
    throw new ImageValidationError("Image must be at least 512 x 512 pixels.");
  }

  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = orientedWidth;
  baseCanvas.height = orientedHeight;

  const baseContext = baseCanvas.getContext("2d");
  if (!baseContext) {
    throw new ImageValidationError("Unable to prepare the canvas for processing.");
  }

  applyOrientationTransform(baseContext, orientation, originalWidth, originalHeight);
  baseContext.drawImage(image, 0, 0);

  const largestSide = Math.max(orientedWidth, orientedHeight);
  const scale = largestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / largestSide : 1;

  let outputCanvas = baseCanvas;
  let targetWidth = orientedWidth;
  let targetHeight = orientedHeight;
  let wasDownscaled = false;

  if (scale < 1) {
    wasDownscaled = true;
    targetWidth = Math.round(orientedWidth * scale);
    targetHeight = Math.round(orientedHeight * scale);
    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = targetWidth;
    scaledCanvas.height = targetHeight;
    const scaledContext = scaledCanvas.getContext("2d");
    if (!scaledContext) {
      throw new ImageValidationError("Unable to prepare the canvas for scaling.");
    }
    scaledContext.drawImage(baseCanvas, 0, 0, targetWidth, targetHeight);
    outputCanvas = scaledCanvas;
  }

  const { blob, type } = await canvasToBlob(outputCanvas, mimeType as AcceptedImageMimeType);
  const normalizedName = normalizeFileName(file.name, type);
  const normalizedFile = new File([blob], normalizedName, { type });

  return {
    file: normalizedFile,
    width: targetWidth,
    height: targetHeight,
    originalWidth: orientedWidth,
    originalHeight: orientedHeight,
    wasDownscaled,
  };
};
