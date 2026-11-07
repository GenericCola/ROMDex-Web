const DeviceBrand = ({ title }: { title: string }) => {
  return (
    <div className="brand">
      <div className="lens" aria-hidden="true" />
      <h1>
        <span className="brand-title">{title}</span>
      </h1>
      <div className="lamps" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
};
export default DeviceBrand;
