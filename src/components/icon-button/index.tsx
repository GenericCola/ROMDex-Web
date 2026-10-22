import Button from "@components/button";
import type { ButtonProps } from "@components/button/types";
type IconButtonProps = Omit<ButtonProps, "aria-label"> & { label: string };
const IconButton = ({ label, ...props }: IconButtonProps) => {
  return <Button aria-label={label} title={label} {...props} />;
};
export default IconButton;
