export const MAX_PART_BYTES = 4_000_000;

export const megabytes = (size: number): string => {
  return `${(size / 1_000_000).toFixed(1)} MB`;
};

export const tooLargeMessage = (name: string, size: number): string => {
  return `"${name}" is ${megabytes(size)}. ROMDex can store files up to 4 MB in YouTrack for now. Nothing was uploaded; your copy stays in this browser.`;
};

export class PartTooLargeError extends Error {
  key: string;
  fileName: string;
  size: number;

  constructor(key: string, fileName: string, size: number) {
    super(tooLargeMessage(fileName, size));
    this.name = "PartTooLargeError";
    this.key = key;
    this.fileName = fileName;
    this.size = size;
  }
}
