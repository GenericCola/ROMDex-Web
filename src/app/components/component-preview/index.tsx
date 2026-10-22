"use client";
import Button from "@components/button";
import IconButton from "@components/icon-button";
import StatusIndicator from "@components/status-indicator";
import TextField from "@components/text-field";
import { RotateCcw } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState, useSyncExternalStore } from "react";
const noop = () => {
  return undefined;
};
const subscribe = () => {
  return noop;
};
const clientReady = () => {
  return true;
};
const serverReady = () => {
  return false;
};
const ComponentPreview = () => {
  // Prevent early edits from being discarded while React attaches its handlers.
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [name, setName] = useState("");
  const [count, setCount] = useState(0);
  const changeName = (event: ChangeEvent<HTMLInputElement>) => {
    return setName(event.target.value);
  };
  const increment = () => {
    return setCount(count + 1);
  };
  const reset = () => {
    setCount(0);
    setName("");
  };
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Preview text"
        value={name}
        onChange={changeName}
        disabled={!ready}
      />
      <StatusIndicator label={name || "Ready"} />
      <div className="flex flex-wrap gap-3">
        <Button onClick={increment} disabled={!ready}>
          Count: {count}
        </Button>
        <IconButton
          label="Reset preview"
          variant="outlined"
          onClick={reset}
          disabled={!ready}
        >
          <RotateCcw aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  );
};
export default ComponentPreview;
