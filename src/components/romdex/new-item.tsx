import { createTask } from "@/domain/task-actions";
import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent, FormEvent } from "react";
import Dialog from "./dialog";
const NewItem = ({
  draft,
}: {
  draft: NonNullable<WorkspaceData["newTask"]>;
}) => {
  const close = () => {
    void workspaceStore.change((data) => {
      data.newTask = null;
    });
  };
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const title = event.target.value;
    void workspaceStore.change((data) => {
      if (data.newTask) data.newTask.title = title;
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void workspaceStore.change((data) => {
      const id = createTask(data, draft.parentId, draft.title);
      data.view.selected = id;
      data.view.detailsMode = "default";
      data.newTask = null;
      if (draft.parentId && !data.view.expanded.includes(draft.parentId))
        data.view.expanded.push(draft.parentId);
    });
  };
  return (
    <Dialog title={draft.parentId ? "Add Item" : "Add Epic"} close={close}>
      <form className="port-form" onSubmit={submit}>
        <label htmlFor="new-item-title">Name</label>
        <input
          id="new-item-title"
          value={draft.title}
          onChange={change}
          required
          autoComplete="off"
        />
        <div className="dialog-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Create Item
          </button>
        </div>
      </form>
    </Dialog>
  );
};
export default NewItem;
