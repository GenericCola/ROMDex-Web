import type { AuthorizedProject } from "@/auth/identity";
import { createContext } from "react";
interface ProjectSelection {
  selected: AuthorizedProject | null;
  projects: AuthorizedProject[];
  disabled: boolean;
  choose: (project: AuthorizedProject) => Promise<void>;
}
export const ProjectSelectionContext = createContext<ProjectSelection | null>(
  null,
);
