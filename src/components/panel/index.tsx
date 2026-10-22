import { tw } from "@utils/tw";
import type { ComponentProps } from "react";
const Panel = ({ className, ...props }: ComponentProps<"section">) => {
  return (
    <section
      className={tw(
        "rounded-xl border border-border bg-surface p-6",
        className,
      )}
      {...props}
    />
  );
};
export default Panel;
