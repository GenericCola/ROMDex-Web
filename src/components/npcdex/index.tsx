import type { WorkspaceData } from "@/domain/types";
import { contentRevision, contentTarget, targetKey } from "@/npcdex/model";
import Content from "./content";
import DraftEditor from "./draft-editor";
import Evidence from "./evidence";
import Navigation from "./navigation";
import RecoveredEditors from "./recovered-editors";
import { useNavigation } from "./use-navigation";
const Npcdex = ({ data }: { data: WorkspaceData }) => {
  const {
    target,
    gender,
    stage,
    message,
    document,
    choose,
    setGender,
    setStage,
  } = useNavigation(data);
  if (!document)
    return (
      <main className="workspace suite-tray port-empty-workspace">
        <h2>NPCDex</h2>
        <p>
          Import your verified desktop export to open maps, encounters,
          dialogue, timelines, notes and history. Current content stays separate
          from proposed changes.
        </p>
      </main>
    );
  const current = contentTarget(document, target);
  return (
    <main
      className="workspace suite-tray npcdex-workspace"
      aria-label="NPCDex Workspace"
    >
      <Navigation
        document={document}
        target={target}
        gender={gender}
        stage={stage}
        choose={choose}
        setGender={setGender}
        setStage={setStage}
      />
      <p role="status">{message}</p>
      <div className="npcdex-panes">
        <Content {...current} gender={gender} stage={stage} />
        {current.town && (
          <DraftEditor
            key={targetKey(target) + contentRevision(document)}
            data={data}
            target={target}
          />
        )}
      </div>
      <RecoveredEditors data={data} />
      <Evidence data={data} document={document} town={current.town} />
    </main>
  );
};
export default Npcdex;
