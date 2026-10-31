import { STATUS } from "@/domain/accepted/core.mjs";
import type { LampColor } from "@/domain/types";
import { tw } from "@utils/tw";
const classes = {
  grey: "bulb grey",
  yellow: "bulb yellow",
  blue: "bulb blue",
  purple: "bulb purple",
  amber: "bulb amber",
  green: "bulb green",
  red: "bulb red",
};
const Lamp = ({
  color,
  className,
  label,
}: {
  color: LampColor;
  className?: string;
  label?: string;
}) => {
  return (
    <span
      className={tw(classes[color], className)}
      role="img"
      aria-label={label ?? STATUS[color]}
    />
  );
};
export default Lamp;
