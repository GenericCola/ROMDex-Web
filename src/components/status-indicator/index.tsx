const StatusIndicator = ({ label }: { label: string }) => {
  return (
    <p role="status" className="text-sm text-fg-muted">
      {label}
    </p>
  );
};
export default StatusIndicator;
