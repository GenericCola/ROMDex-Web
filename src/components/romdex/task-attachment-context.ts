import { createContext, use } from "react";
export const TaskAttachmentContext = createContext<(id: string) => void>(() => {
  return undefined;
});
export const useOpenAttachments = () => {
  return use(TaskAttachmentContext);
};
