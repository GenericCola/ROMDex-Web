import { materialize } from "@/domain/accepted/core.mjs";
import { fieldTargets } from "@/domain/accepted/rdx/plan-publication.mjs";
import type { JsonObject } from "@/domain/json";
import { workspaceStore } from "@/domain/workspace-store";
import { planKey } from "./plan-documents";
export const planContext = (options: JsonObject | null = null) => {
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
    imports: Object.fromEntries(
      Object.entries(data.rdxImports ?? {}).map(([key, ledger]) => {
        return [
          key,
          {
            ...ledger,
            review:
              ledger.review ??
              (Object.keys(ledger.tasks).length
                ? { message: "Review the latest native plan changes." }
                : undefined),
          },
        ];
      }),
    ),
    destinations: materialize(data.remote, data.operations)
      .filter((item) => {
        return /^PMON-\d+$/.test(item.id);
      })
      .map((item) => {
        return { id: item.id, title: item.summary };
      }),
    fields: options ? fieldTargets(options) : [],
    queueStatus: { message: workspaceStore.getSnapshot().connection },
  };
};
