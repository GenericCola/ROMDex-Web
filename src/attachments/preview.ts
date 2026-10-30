const rasterTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);
export const isRasterAttachment = (mimeType: string) => {
  return rasterTypes.has(mimeType);
};
export const previewBlob = (bytes: Blob | Uint8Array, mimeType: string) => {
  if (!isRasterAttachment(mimeType))
    throw Error("Download this file to view it.");
  return new Blob([bytes instanceof Blob ? bytes : Uint8Array.from(bytes)], {
    type: mimeType,
  });
};
