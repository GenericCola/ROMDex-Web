import { flushLocal } from "@/auth/flush-local";
import { errorText } from "@utils/error-text";
import { type FormEvent, type ReactNode, useState } from "react";
// One-shot secret entry: the value lives in component state until it is sent, then is cleared.
const CredentialForm = ({
  busy,
  label,
  action,
  secret = false,
  children,
  send,
}: {
  busy: boolean;
  label: string;
  action: string;
  secret?: boolean;
  children: ReactNode;
  send: (value: string) => Promise<void>;
}) => {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async () => {
    const entered = value.trim();
    setPending(true);
    setMessage("");
    try {
      await flushLocal();
      setValue("");
      await send(entered);
    } catch (error) {
      setMessage(errorText(error, "Sign-in failed."));
      setPending(false);
    }
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };
  const handleValue = (event: FormEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value);
  };
  const disabled = busy || pending;
  return (
    <form onSubmit={handleSubmit}>
      <label>
        {label}
        <input
          type={secret ? "password" : "text"}
          autoComplete="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={handleValue}
        />
      </label>
      {children}
      <button className="primary" disabled={disabled || !value.trim()}>
        {pending ? "Signing in…" : action}
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
};
export default CredentialForm;
