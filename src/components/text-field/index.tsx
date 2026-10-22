import type { ComponentProps } from "react";
import { useId } from "react";
type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
};
const TextField = ({ label, error, id, ...props }: TextFieldProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const description =
    [props["aria-describedby"], error ? fieldId + "-error" : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={description}
        className="min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-fg focus-visible:outline-2 focus-visible:outline-focus"
      />
      {error && (
        <p id={fieldId + "-error"} className="text-error-600">
          {error}
        </p>
      )}
    </div>
  );
};
export default TextField;
