import { materialize } from "@/domain/accepted/core.mjs";
import { workspaceStore } from "@/domain/workspace-store";
import { planKey } from "./plan-documents";
export const planContext = () => {
  const { data } = workspaceStore.getSnapshot();
  const heads = new Map(
    (data.rdxFiles ?? [])
      .filter((file) => {
        return file.kind === "plan";
      })
      .map((file) => {
        return [planKey(file), file];
      }),
  );
  return {
    documents: [...heads].map(([key, file]) => {
      return { key, title: file.name };
    }),
    imports: data.rdxImports ?? {},
    destinations: materialize(data.remote, data.operations)
      .filter((item) => {
        return /^PMON-\d+$/.test(item.id);
      })
      .map((item) => {
        return { id: item.id, title: item.summary };
      }),
    fields: [],
    queueStatus: { message: workspaceStore.getSnapshot().connection },
  };
};
