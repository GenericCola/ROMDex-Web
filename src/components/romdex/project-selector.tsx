import type { AuthorizedProject } from "@/auth/identity";
import { use, useState } from "react";
import Dialog from "./dialog";
import { ProjectSelectionContext } from "./project-selection-context";
const ProjectSelector = () => {
  const selection = use(ProjectSelectionContext);
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  if (!selection?.selected)
    return <span className="eyebrow">Pokémon / PMON</span>;
  const { selected, projects, disabled, choose } = selection;
  const renderProject = (project: AuthorizedProject) => {
    const select = () => {
      close();
      if (project.id !== selected.id) void choose(project);
    };
    return (
      <button
        key={project.id}
        disabled={disabled}
        onClick={select}
        aria-current={project.id === selected.id ? "true" : undefined}
      >
        {project.name} ({project.shortName})
      </button>
    );
  };
  return (
    <>
      <button
        type="button"
        className="eyebrow project-selector-trigger"
        aria-label={`Change project: ${selected.name} (${selected.shortName})`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
      >
        {selected.name} / {selected.shortName}
      </button>
      {open && (
        <Dialog title="Choose project" close={close}>
          <div className="project-selector-content">
            <div className="port-actions">{projects.map(renderProject)}</div>
            <button type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
};
export default ProjectSelector;
