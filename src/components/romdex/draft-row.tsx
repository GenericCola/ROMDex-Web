import type { CSSProperties, ReactNode } from "react";
import Lamp from "./lamp";

const DraftRow = ({
  depth,
  decorative,
  input,
  children,
  rowIndex,
}: {
  depth: number;
  rowIndex: number;
  decorative: boolean;
  input: ReactNode;
  children: ReactNode;
}) => {
  const hidden = decorative ? ("true" as const) : undefined;
  return (
    <tr
      className="draft-row"
      style={{ "--depth": depth } as CSSProperties}
      aria-rowindex={rowIndex}
    >
      <td>
        <div className="task-cell">
          <span className="row-gutter" aria-hidden={hidden} />
          <div className="row-hierarchy">
            <span className="draft-indent" aria-hidden={hidden} />
            <span className="draft-status">
              <Lamp color="grey" />
            </span>
            {input}
          </div>
        </div>
      </td>
      {children}
    </tr>
  );
};
export default DraftRow;
