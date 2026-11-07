const TileImagePreview = ({
  image,
  missing = false,
}: {
  image: string | null;
  missing?: boolean;
}) => {
  // A tile image lost from this browser shows a placeholder notice instead.
  if (!image)
    return missing ? (
      <p role="status">
        This tile image is missing from this browser. Choose it again; recovery
        copies list the missing image.
      </p>
    ) : null;
  return (
    <span
      className="selector-settings-preview"
      role="img"
      aria-label="Assigned Tile Image Preview"
      style={{
        backgroundImage: "url(" + JSON.stringify(image) + ")",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    />
  );
};
export default TileImagePreview;
