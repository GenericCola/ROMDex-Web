import { base64Bytes, encodeBytes } from "@/domain/bytes";
export class PlanTransfer {
  private upload: {
    id: string;
    bytes: Uint8Array;
    offset: number;
    expires: number;
  } | null = null;
  readonly chunkBytes = 512 * 1024;
  begin = (size: unknown) => {
    if (
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > 64 * 1024 * 1024
    )
      throw Error("Choose an RDX file up to 64 MiB.");
    this.upload = {
      id: crypto.randomUUID(),
      bytes: new Uint8Array(size),
      offset: 0,
      expires: Date.now() + 15 * 60 * 1000,
    };
    return { id: this.upload.id, chunkBytes: this.chunkBytes };
  };
  private session = (id: unknown) => {
    if (
      !this.upload ||
      id !== this.upload.id ||
      Date.now() > this.upload.expires
    )
      throw Error("Plan transfer expired. Select the file again.");
    return this.upload;
  };
  chunk = (id: unknown, offset: unknown, encoded: unknown) => {
    const upload = this.session(id);
    if (
      offset !== upload.offset ||
      typeof encoded !== "string" ||
      encoded.length > 4 * Math.ceil(this.chunkBytes / 3)
    )
      throw Error("Invalid plan transfer chunk.");
    const bytes = base64Bytes(encoded);
    if (
      !bytes.length ||
      bytes.length > this.chunkBytes ||
      encodeBytes(bytes) !== encoded ||
      upload.offset + bytes.length > upload.bytes.length
    )
      throw Error("Invalid plan transfer bytes.");
    upload.bytes.set(bytes, upload.offset);
    upload.offset += bytes.length;
    return { offset: upload.offset };
  };
  read = (id: unknown) => {
    const upload = this.session(id);
    if (upload.offset !== upload.bytes.length)
      throw Error("The plan transfer is incomplete.");
    return upload.bytes;
  };
  cancel = () => {
    this.upload = null;
  };
}
