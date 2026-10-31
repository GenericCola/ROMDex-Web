import { checkImageBounds } from "@/domain/accepted/content/image-bounds.mjs";
import { Buffer } from "buffer/index.js";
export const tileImageSize = (width: number, height: number) => {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 4096 ||
    height > 4096 ||
    width * height > 8 * 1024 * 1024
  )
    throw Error("The image dimensions exceed the supported bound.");
  const scale = Math.min(1, 192 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};
export const taskImage = async (file: File) => {
  if (
    file.size > 8 * 1024 * 1024 ||
    !/^image\/(png|jpeg|gif|webp)$/.test(file.type)
  )
    throw Error("Choose a PNG, JPEG, GIF or WebP image no larger than 8 MiB.");
  checkImageBounds(Buffer.from(await file.arrayBuffer()), file.type);
  const bitmap = await createImageBitmap(file);
  try {
    const size = tileImageSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw Error("The image preview could not be prepared.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const image = canvas.toDataURL("image/png");
    if (!image.startsWith("data:image/png;base64,"))
      throw Error("The image preview could not be encoded.");
    return image;
  } finally {
    bitmap.close();
  }
};
