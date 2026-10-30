const TileImagePreview = ({ image }: { image: string | null }) => {
  if (!image) return null;
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
