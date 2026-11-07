import { authIdentity, hasAuthSession } from "@/auth/session";
import { equal } from "@/cloud/delivery-helpers";
import { validateTagSelection } from "@/cloud/tag-types";
import type { JsonObject } from "@/domain/json";
import { nativeEditKey } from "@/domain/native-edit-fields";
import type { TaskItem, TaskPatch } from "@/domain/types";
import { readEditOptions } from "./edit-options";
import type { Field } from "./issue-body";
import { nativeEditPayload } from "./native-edit-payload";
import type { YouTrackRequest } from "./request";
const unchanged = (
  fresh: TaskItem | null,
  patch: TaskPatch,
  expected: TaskItem,
): boolean => {
  return (
    !!fresh &&
    Object.keys(patch).every((key) => {
      return equal(
        fresh[key as keyof TaskItem],
        expected[key as keyof TaskItem],
      );
    })
  );
};
export class NativeEditAdapter {
  private prepared = new Map<string, { stamp: string; options: JsonObject }>();
  constructor(
    private request: YouTrackRequest,
    private get: (id: string) => Promise<TaskItem | null>,
    private fields: (id: string) => Field[],
  ) {}
  private options = () => {
    return readEditOptions(
      this.request,
      hasAuthSession() ? authIdentity().projectId : undefined,
    );
  };
  prepare = async (id: string, patch: TaskPatch, expected: TaskItem) => {
    if (!Object.keys(patch).some(nativeEditKey)) return;
    this.prepared.delete(id);
    const { options } = await this.options();
    const fresh = await this.get(id);
    if (!unchanged(fresh, patch, expected))
      throw Error("The item changed during field review. Nothing was sent.");
    nativeEditPayload(patch, options, this.fields(id));
    this.prepared.set(id, { stamp: JSON.stringify(patch), options });
  };
  fieldsFor = async (id: string, patch: TaskPatch, expected?: TaskItem) => {
    if (!Object.keys(patch).some(nativeEditKey)) return [];
    const review = this.prepared.get(id);
    if (review?.stamp !== JSON.stringify(patch) || !expected)
      throw Error("Native field changes require fresh preparation.");
    const fresh = await this.get(id);
    if (!unchanged(fresh, patch, expected))
      throw Error(
        "The item changed before native field delivery. No new write was sent.",
      );
    return nativeEditPayload(patch, review.options, this.fields(id));
  };
  creation = async (item: TaskItem, body: Record<string, unknown>) => {
    const patch = Object.fromEntries(
      Object.entries(item).filter(([key]) => {
        return nativeEditKey(key);
      }),
    ) as TaskPatch;
    if (!Object.keys(patch).length && item.tags === undefined) return body;
    const { options } = await this.options();
    if (item.tags !== undefined)
      validateTagSelection(item.tags, [], options.tags);
    const extras = nativeEditPayload(patch, options);
    const fields = body.customFields as JsonObject[];
    return {
      ...body,
      customFields: [
        ...fields.filter((field) => {
          return !extras.some((extra) => {
            return extra.name === field.name;
          });
        }),
        ...extras,
      ],
    };
  };
}
