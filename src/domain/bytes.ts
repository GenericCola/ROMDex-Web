export const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) => {
    return byte.toString(16).padStart(2, "0");
  }).join("");
};
export const base64Bytes = (value: string): Uint8Array => {
  const body = value.replace(/={1,2}$/, "");
  if (
    value.length % 4 !== 0 ||
    /[^A-Za-z0-9+/]/.test(body) ||
    value.length - body.length > 2
  )
    throw Error("Invalid base64 bytes.");
  return Uint8Array.from(atob(value), (char) => {
    return char.charCodeAt(0);
  });
};

export const encodeBytes = (bytes: Uint8Array) => {
  let text = "";
  for (let index = 0; index < bytes.length; index += 8192)
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(text);
};
