import { flushDraftEditors } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
const WorkspaceMenu = ({ workspace }: { workspace: "romdex" | "npcdex" }) => {
  const [menu, setMenu] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const watchMenu = () => {
    if (!menu) return;
    anchorRef.current
      ?.querySelector<HTMLButtonElement>("[role=menuitemradio]")
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !anchorRef.current?.contains(event.target)
      )
        setMenu(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenu(false);
      triggerRef.current?.focus();
    };
    const focusOutside = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !anchorRef.current?.contains(event.target)
      )
        setMenu(false);
    };
    document.addEventListener("focusin", focusOutside);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    const stop = () => {
      document.removeEventListener("focusin", focusOutside);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
    return stop;
  };
  useEffect(watchMenu, [menu]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!menu) {
      setMenu(true);
      return;
    }
    const buttons = Array.from(
      anchorRef.current?.querySelectorAll<HTMLButtonElement>(
        "[role=menuitemradio]",
      ) ?? [],
    );
    const current = buttons.findIndex((button) => {
      return button === document.activeElement;
    });
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[index]?.focus();
  };
  const toggle = () => {
    return setMenu(!menu);
  };
  const open = async (id: "romdex" | "npcdex") => {
    await flushDraftEditors();
    void workspaceStore.change((data) => {
      data.view.workspace = id;
    });
    setMenu(false);
    triggerRef.current?.focus();
  };
  const romdex = () => {
      void open("romdex").catch((error: unknown) => {
        workspaceStore.setConnection(
          error instanceof Error
            ? error.message
            : "Save the NPCDex draft before switching.",
        );
      });
    },
    npcdex = () => {
      void open("npcdex").catch((error: unknown) => {
        workspaceStore.setConnection(
          error instanceof Error
            ? error.message
            : "Save the NPCDex draft before switching.",
        );
      });
    };
  return (
    <div className="suite-menu-anchor" ref={anchorRef} onKeyDown={navigate}>
      <button
        id="workspace-switcher"
        ref={triggerRef}
        className="workspace-switcher"
        aria-label="Switch Workspace"
        title="Switch Workspace"
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-controls={menu ? menuId : undefined}
        onClick={toggle}
      />
      {menu && (
        <div
          id={menuId}
          className="suite-popover"
          role="menu"
          aria-label="Workspaces"
        >
          <button
            role="menuitemradio"
            aria-checked={workspace === "romdex"}
            onClick={romdex}
          >
            ROMDex
          </button>
          <button
            role="menuitemradio"
            aria-checked={workspace === "npcdex"}
            onClick={npcdex}
          >
            NPCDex
          </button>
        </div>
      )}
    </div>
  );
};
export default WorkspaceMenu;
