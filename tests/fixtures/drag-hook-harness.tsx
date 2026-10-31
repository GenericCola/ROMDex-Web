import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
interface BundlerApi {
  onResolve: (
    filter: { filter: RegExp },
    resolve: (args: {
      path: string;
    }) => { path: string; namespace: string } | undefined,
  ) => void;
  onLoad: (
    filter: { filter: RegExp; namespace: string },
    load: (args: { path: string }) => { contents: string; loader: string },
  ) => void;
}
const require = createRequire(import.meta.url);
// tsx is a declared dev dependency; use its locked bundler without relying on hoisting.
const { build } = createRequire(require.resolve("tsx/package.json"))(
  "esbuild",
) as {
  build: (
    options: Record<string, unknown> & {
      plugins: { name: string; setup: (api: BundlerApi) => void }[];
    },
  ) => Promise<{ outputFiles: { text: string }[] }>;
};
interface HookModules {
  useTaskDrag: typeof import("../../src/components/romdex/use-task-drag").useTaskDrag;
  SelectorBranch: typeof import("../../src/components/romdex/selector-branch").default;
  workspaceStore: typeof import("../../src/domain/workspace-store").workspaceStore;
  emptyWorkspace: typeof import("../../src/domain/workspace-data").emptyWorkspace;
  indexTree: typeof import("../../src/domain/accepted/core.mjs").indexTree;
}
// Real hook/selector/store; only React primitives and pointer geometry are doubles.
export const dragHookHarness = async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const effects: (() => void | (() => void))[] = [],
    listeners = new Map<string, (event: unknown) => void>();
  const harness = {
    effects,
    states: [] as unknown[],
    start: {
      id: "PMON-2",
      x: 0,
      y: 0,
      pointer: 1,
      signature: "fixture",
      active: false,
      intent: null,
    },
    preview: null as unknown,
  };
  const priorHarness = Object.getOwnPropertyDescriptor(
    globalThis,
    "__dragHookHarness",
  );
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "__dragHookHarness", {
    configurable: true,
    value: harness,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (name: string, fn: (event: unknown) => void) => {
        return listeners.set(name, fn);
      },
      removeEventListener: (name: string) => {
        return listeners.delete(name);
      },
    },
  });
  const modules: Record<string, string> = {
    react: `const h=globalThis.__dragHookHarness;export const useRef=value=>({current:value});export const useState=value=>[value,next=>h.states.push(next)];export const useEffect=fn=>h.effects.push(fn);`,
    "react/jsx-runtime": `export const Fragment='fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
    "next/image": `export default function Image(){return null}`,
    "./task-drag-start": `export const startTaskDrag=()=>globalThis.__dragHookHarness.start;`,
    "./task-drag-preview": `export const taskDragPreview=()=>globalThis.__dragHookHarness.preview;`,
    "./task-drag-context": `export const useWorkspaceDrag=()=>({preview:null,dragId:null});`,
  };
  const result = await build({
    stdin: {
      contents: `export {useTaskDrag} from './src/components/romdex/use-task-drag';export {default as SelectorBranch} from './src/components/romdex/selector-branch';export {workspaceStore} from './src/domain/workspace-store';export {emptyWorkspace} from './src/domain/workspace-data';export {indexTree} from './src/domain/accepted/core.mjs';`,
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    tsconfig: path.join(root, "tests/tsconfig.json"),
    plugins: [
      {
        name: "test-hook-primitives",
        setup: (api) => {
          api.onResolve({ filter: /.*/ }, (args) => {
            return modules[args.path]
              ? { path: args.path, namespace: "test-hook" }
              : undefined;
          });
          api.onLoad({ filter: /.*/, namespace: "test-hook" }, (args) => {
            return {
              contents: modules[args.path]!,
              loader: "js",
            };
          });
        },
      },
    ],
  });
  const temp = await mkdtemp(path.join(tmpdir(), "romdex-drag-hook-"));
  const bundle = path.join(temp, "hook.cjs");
  await writeFile(bundle, result.outputFiles[0]!.text);
  const loaded = createRequire(import.meta.url)(bundle) as HookModules;
  const cleanups: (() => void)[] = [];
  return {
    ...loaded,
    harness,
    listeners,
    effects,
    mount: () => {
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (typeof cleanup === "function") cleanups.push(cleanup);
      }
    },
    dispose: async () => {
      for (const cleanup of cleanups.reverse()) cleanup();
      if (priorHarness)
        Object.defineProperty(globalThis, "__dragHookHarness", priorHarness);
      else Reflect.deleteProperty(globalThis, "__dragHookHarness");
      if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
      else Reflect.deleteProperty(globalThis, "window");
      await rm(temp, { recursive: true });
    },
  };
};
