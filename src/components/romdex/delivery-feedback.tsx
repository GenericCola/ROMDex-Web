import { useEffect, useRef } from "react";
const DeliveryFeedback = ({ message }: { message: string }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ block: "nearest" });
  }, [message]);
  return (
    <p ref={ref} role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
};
export default DeliveryFeedback;
