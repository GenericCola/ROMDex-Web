export const downloadFile = (bytes: Blob | Uint8Array, name: string) => {
  const blob =
      bytes instanceof Blob
        ? new Blob([bytes], { type: "application/octet-stream" })
        : new Blob([Uint8Array.from(bytes)], {
            type: "application/octet-stream",
          }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
