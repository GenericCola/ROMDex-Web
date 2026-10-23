import { readFile } from "node:fs/promises";
export const acceptanceSources = async (manifest) => {
  const scope = JSON.parse(
    await readFile(
      new URL("../youtrack-acceptance/scope.json", import.meta.url),
      "utf8",
    ),
  );
  if (
    scope.project !== "NPCD" ||
    scope.app !== "romdex-status-acceptance" ||
    !/^\d+\.\d+\.\d+$/.test(scope.version) ||
    scope.prefix !== "[ROMDex acceptance] " ||
    !Array.isArray(scope.issues) ||
    !scope.issues.length ||
    scope.issues.some((id) => !/^NPCD-\d+$/.test(id))
  )
    throw Error("Invalid fixed acceptance scope.");
  let status = await readFile(
    new URL("../youtrack-app/status.js", import.meta.url),
    "utf8",
  );
  if ((status.match(/PMON/g) ?? []).length !== 2)
    throw Error("Review changed handler before creating an acceptance build.");
  status = status
    .replaceAll("PMON", scope.project)
    .replaceAll("romdex-status", scope.app)
    .replace(
      "!issue ||",
      "!issue ||\n    !" +
        JSON.stringify(scope.issues) +
        ".includes(issue.id) ||\n    !issue.summary?.startsWith(" +
        JSON.stringify(scope.prefix) +
        ") ||",
    );
  status += "\nexports.checkAcceptanceIssue = check;\n";
  manifest.name = scope.app;
  manifest.version = scope.version;
  manifest.title = "ROMDex acceptance - synthetic issues only";
  manifest.description =
    "Restricted to NPCD-872 and NPCD-873. No production access.";
  manifest.widgets = [
    {
      key: "acceptance",
      name: "ROMDex acceptance",
      extensionPoint: "ISSUE_ABOVE_ACTIVITY_STREAM",
      indexPath: "acceptance/index.html",
      permissions: ["READ_ISSUE"],
      expectedDimensions: { height: 420 },
    },
  ];
  const capabilities = (
    await readFile(
      new URL("../youtrack-app/capabilities.js", import.meta.url),
      "utf8",
    )
  )
    .replaceAll("PMON", scope.project)
    .replaceAll("romdex-status", scope.app);
  const result = new Map([
    ["manifest.json", JSON.stringify(manifest, null, 2) + "\n"],
    ["status.js", status],
    ["capabilities.js", capabilities],
  ]);
  for (const name of ["index.html", "panel.js", "fault.js"]) {
    const source = await readFile(
      new URL("../youtrack-acceptance/" + name, import.meta.url),
      "utf8",
    );
    result.set(name === "fault.js" ? name : "widgets/acceptance/" + name, source);
  }
  return result;
};
