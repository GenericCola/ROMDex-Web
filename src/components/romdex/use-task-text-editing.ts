import { setTaskComposition, setTaskTextEditing } from "@/domain/task-editing";
import { useLayoutEffect } from "react";
export const useTaskTextEditing = (id: string, field: string) => {
  const key = id + ":" + field;
  const focus = () => {
    setTaskTextEditing(key, true);
  };
  const blur = () => {
    setTaskTextEditing(key, false);
  };
  const compositionStart = () => {
    setTaskComposition(key, true);
  };
  const compositionEnd = () => {
    setTaskComposition(key, false);
  };
  const track = () => {
    return () => {
      setTaskTextEditing(key, false);
    };
  };
  useLayoutEffect(track, [key]);
  return { focus, blur, compositionStart, compositionEnd };
};
