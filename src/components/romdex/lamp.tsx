import { STATUS } from "@/domain/accepted/core.mjs";
import type { LampColor } from "@/domain/types";
const classes = {
  grey: "bulb grey",
  yellow: "bulb yellow",
  blue: "bulb blue",
  purple: "bulb purple",
  green: "bulb green",
  red: "bulb red",
};
const Lamp = ({ color }: { color: LampColor }) => {
  return (
    <span className={classes[color]} role="img" aria-label={STATUS[color]} />
  );
};
export default Lamp;
