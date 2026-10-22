/* eslint-disable no-console -- script */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const LINKS = [
  {
    source: path.join(root, ".agents", "skills"),
    linkPath: path.join(root, ".claude", "skills"),
    label: ".claude/skills -> .agents/skills",
    type: "dir",
  },
  {
    source: path.join(root, "AGENTS.md"),
    linkPath: path.join(root, "CLAUDE.md"),
    label: "CLAUDE.md -> AGENTS.md",
    type: "file",
  },
];

const pathExists = (target) => {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
};

const resolveOrNull = (target) => {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
};

const ensureSource = ({ source, type }) => {
  if (fs.existsSync(source)) return;

  if (type === "dir") {
    fs.mkdirSync(source, { recursive: true });
    console.log(`   • created ${path.relative(root, source)}`);
    return;
  }

  console.error(
    `❌ ${path.relative(root, source)} is missing; cannot link it.`,
  );
  process.exit(1);
};

/** @returns {boolean} true when the correct link is already in place */
const clearExistingLink = ({ source, linkPath }) => {
  if (!pathExists(linkPath)) return false;

  if (!fs.lstatSync(linkPath).isSymbolicLink()) {
    const name = path.relative(root, linkPath);
    console.error(
      `❌ ${name} exists as a real file/directory, not a symlink.\n` +
        `   Move its contents into ${path.relative(root, source)}, then delete ${name} and re-run \`pnpm install\`.`,
    );
    process.exit(1);
  }

  if (resolveOrNull(linkPath) === fs.realpathSync(source)) return true;

  fs.unlinkSync(linkPath);
  console.log("   • removed stale symlink");
  return false;
};

const createLink = ({ source, linkPath, label, type }) => {
  const symlinkType = isWindows && type === "dir" ? "junction" : type;
  const target =
    isWindows && type === "dir"
      ? source
      : path.relative(path.dirname(linkPath), source);

  try {
    fs.symlinkSync(target, linkPath, symlinkType);
    console.log(`✅ ${label}`);
  } catch (err) {
    if (isWindows && err.code === "EPERM") {
      console.error(
        `Optional agent link skipped: ${label}. Read AGENTS.md and .agents/skills directly.`,
      );
      return;
    }
    throw err;
  }
};

const link = (entry) => {
  console.log(`🔗 Linking ${entry.label}...`);
  ensureSource(entry);
  fs.mkdirSync(path.dirname(entry.linkPath), { recursive: true });

  if (clearExistingLink(entry)) {
    console.log(`✅ ${entry.label} already linked`);
    return;
  }

  createLink(entry);
};

LINKS.forEach(link);
