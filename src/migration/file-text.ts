export const readMigrationText = async (file: Blob) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw Error(
      "The selected file is not valid UTF-8. No browser data changed.",
    );
  }
};
