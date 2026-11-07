import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import { taskImage } from "@/rdx/images";
import { putImage } from "@/storage/image-storage";
import { errorText } from "@utils/error-text";
import { useState } from "react";
const TaskImage = ({ id, data }: { id: string; data: WorkspaceData }) => {
  const [message, setMessage] = useState("");
  const load = async (file: File) => {
    try {
      const image = await taskImage(file);
      const ref = await putImage(image);
      await workspaceStore.change((next) => {
        next.images ??= {};
        next.images[id] = ref;
      });
      await workspaceStore.flush();
      setMessage("Task image saved in this browser.");
    } catch (error) {
      setMessage(errorText(error, "Image could not be saved."));
    }
  };
  const clear = () => {
    void workspaceStore.change((next) => {
      if (next.images) delete next.images[id];
    });
  };
  return (
    <details>
      <summary>Task image</summary>
      <label>
        Choose task image
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file)
              void trackWorkspaceWork(() => {
                return load(file);
              });
            event.target.value = "";
          }}
        />
      </label>
      {data.images?.[id] && <button onClick={clear}>Remove Task Image</button>}
      <p role="status">{message}</p>
    </details>
  );
};
export default TaskImage;
