import { registerDraftEditor } from "@/domain/editor-drafts";
import { itemName, taskTier } from "@/domain/task-presentation";
import { applyTileSettings, type TileDraft } from "@/domain/tile-settings";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { taskImage } from "@/rdx/images";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Dialog from "./dialog";
import TileImagePreview from "./tile-image-preview";
import { useAttachmentWork } from "./use-attachment-work";

const TileSettings = ({
  item,
  depth,
  image,
  close,
}: {
  item: TaskItem;
  depth: number;
  image: string | null;
  close: () => void;
}) => {
  const [draft, setDraft] = useState<TileDraft>(() => {
    return {
      id: item.id,
      baseSummary: item.summary,
      baseImage: image,
      name: itemName(item),
      image,
    };
  });
  const currentRef = useRef(draft);
  useLayoutEffect(() => {
    currentRef.current = draft;
  }, [draft]);
  const { busy, message, run } = useAttachmentWork();
  useLayoutEffect(() => {
    return registerDraftEditor({
      label: "Unapplied Tile Settings",
      dirty: () => {
        return (
          currentRef.current.name !==
            itemName({ summary: currentRef.current.baseSummary }) ||
          currentRef.current.image !== currentRef.current.baseImage
        );
      },
      capture: () => {
        return { kind: "tile-settings", ...currentRef.current };
      },
      flush: () => {
        return Promise.reject(
          Error(
            "Apply or close Tile Settings before switching workspace or updating.",
          ),
        );
      },
    });
  }, [draft]);
  const dismiss = () => {
    if (!busy) close();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(async () => {
      await workspaceStore.change((data) => {
        return applyTileSettings(data, currentRef.current);
      });
      await workspaceStore.flush();
      close();
    });
  };
  return (
    <Dialog
      id="image-dialog"
      title="Tile Settings"
      close={dismiss}
      canClose={!busy}
      desktop
    >
      <form id="tile-settings-form" onSubmit={submit}>
        <p className="muted">
          {taskTier(depth)} · {item.id}
        </p>
        <label htmlFor="tile-name">Name</label>
        <input
          id="tile-name"
          required
          value={draft.name}
          disabled={busy}
          onChange={(event) => {
            return setDraft({ ...draft, name: event.target.value });
          }}
        />
        <h3>Choose Image</h3>
        <TileImagePreview image={draft.image} />
        <div className="selector-settings-actions">
          <label>
            Upload Image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="Upload Tile Image"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file)
                  run(async () => {
                    const nextImage = await taskImage(file);
                    setDraft((next) => {
                      return { ...next, image: nextImage };
                    });
                  });
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              return setDraft({ ...draft, image: null });
            }}
          >
            Remove Image
          </button>
        </div>
        <p className="muted small">
          Images are kept in your ROMDex workspace in this browser.
        </p>
        <p role="status" hidden={!message}>
          {message}
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={dismiss} disabled={busy}>
            Close
          </button>
          <button className="primary" type="submit" disabled={busy}>
            Apply Tile Changes
          </button>
        </div>
      </form>
    </Dialog>
  );
};
export default TileSettings;
