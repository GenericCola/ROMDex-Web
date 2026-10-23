export type JsonValue =
  null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}
export const jsonObject = (value: JsonValue | undefined): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected a JSON object.");
  return value;
};
export const parseJson = (
  text: string,
  maxBytes = 64 * 1024 * 1024,
): JsonValue => {
  if (
    !text.length ||
    new TextEncoder().encode(text).length > maxBytes ||
    text.charCodeAt(0) === 0xfeff
  )
    throw Error(
      "JSON file is empty, oversized or has an unsupported encoding.",
    );
  let at = 0,
    nodes = 0;
  const space = () => {
    while (/[ \t\r\n]/.test(text[at] ?? "!")) at++;
  };
  const string = (): string => {
    const start = at++;
    while (at < text.length) {
      const char = text[at++];
      if (char === '"') {
        const result: unknown = JSON.parse(text.slice(start, at));
        if (typeof result !== "string") throw Error("Invalid JSON string.");
        for (let i = 0; i < result.length; i++) {
          const code = result.charCodeAt(i);
          if (code >= 0xd800 && code <= 0xdbff) {
            const next = result.charCodeAt(++i);
            if (!(next >= 0xdc00 && next <= 0xdfff))
              throw Error("Invalid Unicode.");
          } else if (code >= 0xdc00 && code <= 0xdfff)
            throw Error("Invalid Unicode.");
        }
        return result;
      }
      if (char === "\\") at++;
    }
    throw Error("Unterminated JSON string.");
  };
  const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const value = (depth: number): JsonValue => {
    if (depth > 64 || ++nodes > 1000000)
      throw Error("JSON complexity limit exceeded.");
    space();
    const char = text[at];
    if (char === '"') return string();
    if (char === "{") {
      at++;
      space();
      const result: JsonObject = {},
        keys = new Set<string>();
      if (text[at] === "}") {
        at++;
        return result;
      }
      for (;;) {
        if (text[at] !== '"') throw Error("Invalid JSON object key.");
        const key = string();
        if (
          ["__proto__", "constructor", "prototype"].includes(key) ||
          keys.has(key)
        )
          throw Error("Duplicate or reserved JSON key.");
        keys.add(key);
        space();
        if (text[at++] !== ":") throw Error("Invalid JSON object.");
        result[key] = value(depth + 1);
        space();
        const end = text[at++];
        if (end === "}") return result;
        if (end !== ",") throw Error("Invalid JSON object separator.");
        space();
      }
    }
    if (char === "[") {
      at++;
      space();
      const result: JsonValue[] = [];
      if (text[at] === "]") {
        at++;
        return result;
      }
      for (;;) {
        result.push(value(depth + 1));
        space();
        const end = text[at++];
        if (end === "]") return result;
        if (end !== ",") throw Error("Invalid JSON array.");
      }
    }
    for (const [word, result] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const)
      if (text.startsWith(word, at)) {
        at += word.length;
        return result;
      }
    numberPattern.lastIndex = at;
    const number = numberPattern.exec(text);
    if (!number) throw Error("Invalid JSON value.");
    at += number[0].length;
    const result = Number(number[0]);
    if (
      !Number.isFinite(result) ||
      (Number.isInteger(result) && !Number.isSafeInteger(result))
    )
      throw Error("Unsafe JSON number.");
    return result;
  };
  const result = value(0);
  space();
  if (at !== text.length) throw Error("Unexpected JSON trailing data.");
  return result;
};
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
