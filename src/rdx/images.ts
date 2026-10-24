import { checkImageBounds } from "@/domain/accepted/content/image-bounds.mjs";
import { encodeBytes } from "@/domain/bytes";
import { Buffer } from "buffer/index.js";
export const taskImage = async (file: File) => {
  if (
    file.size > 2 * 1024 * 1024 ||
    !/^image\/(png|jpeg|gif|webp)$/.test(file.type)
  )
    throw Error("Choose a PNG, JPEG, GIF or WebP image no larger than 2 MiB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  checkImageBounds(bytes, file.type);
  const bitmap = await createImageBitmap(file);
  bitmap.close();
  return "data:" + file.type + ";base64," + encodeBytes(bytes);
};
