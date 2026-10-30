import { createContext, use } from "react";
export interface DetailContext {
  tab: "notes" | "comments";
  setTab: (value: "notes" | "comments") => void;
  focusNotes: { id: string } | null;
  open: (id: string, child?: boolean, notes?: boolean) => void;
  previous: string | null;
  back: () => void;
}
export const DetailNavigationContext = createContext<DetailContext | null>(
  null,
);
export const useDetailNavigation = () => {
  const value = use(DetailNavigationContext);
  if (!value) throw Error("Details requires its workspace provider.");
  return value;
};
