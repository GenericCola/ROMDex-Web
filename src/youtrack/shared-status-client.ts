import {
  attachSharedStatus,
  parseSharedStatus,
  validateStatusWrite,
} from "@/cloud/shared-status-protocol";
import type {
  SharedStatusPort,
  SharedStatusWrite,
} from "@/cloud/shared-status-types";
import type { TaskItem } from "@/domain/types";
import type { YouTrackRequest } from "./request";
import { issueId } from "./request";
export class SharedStatusClient implements SharedStatusPort {
  private ready: Promise<void> | undefined;
  constructor(private request: YouTrackRequest) {}
  probe = () => {
    this.ready ??= this.check();
    return this.ready;
  };
  private check = async () => {
    const result = await this.request(
      "extensionEndpoints/romdex-status/capabilities/check",
    );
    if (
      !result ||
      typeof result !== "object" ||
      !("schema" in result) ||
      result.schema !== 1 ||
      !("app" in result) ||
      result.app !== "romdex-status" ||
      !("project" in result) ||
      result.project !== "PMON" ||
      !("statusRules" in result) ||
      result.statusRules !== 2
    )
      throw Error(
        "The ROMDex status app is unavailable or incompatible. Shared status was stopped.",
      );
  };
  get = async (id: string) => {
    await this.probe();
    const value = await this.request(
      "issues/" +
        issueId(id) +
        "/extensionEndpoints/romdex-status/status/assigned",
    );
    return parseSharedStatus(value, id);
  };
  write = async (id: string, body: SharedStatusWrite) => {
    validateStatusWrite(body);
    await this.probe();
    await this.request(
      "issues/" +
        issueId(id) +
        "/extensionEndpoints/romdex-status/status/assigned",
      "POST",
      body,
    );
  };
  annotate = async (item: TaskItem) => {
    return attachSharedStatus(item, await this.get(item.id));
  };
  annotateAll = async (items: TaskItem[]) => {
    const result: TaskItem[] = [];
    for (let at = 0; at < items.length; at += 10) {
      const batch = items.slice(at, at + 10).map((item) => {
        return this.annotate(item);
      });
      result.push(...(await Promise.all(batch)));
    }
    return result;
  };
}
