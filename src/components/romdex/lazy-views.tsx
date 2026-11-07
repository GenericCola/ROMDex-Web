"use client";
import dynamic from "next/dynamic";
import Pending from "./pending";
import WorkspaceSkeleton from "./workspace-skeleton";

const loadingDialog = (label: string) => {
  const Loading = () => {
    return <Pending active label={label} />;
  };
  return Loading;
};
const loadingWorkspace = () => {
  return <WorkspaceSkeleton />;
};
/** Rarely used views, loaded on demand so the initial bundle stays small. */
export const LazyNpcdex = dynamic(
  () => {
    return import("@components/npcdex");
  },
  {
    ssr: false,
    loading: loadingWorkspace,
  },
);
export const LazyNpcdexSidebar = dynamic(
  () => {
    return import("@components/npcdex/sidebar");
  },
  { ssr: false, loading: loadingDialog("Opening NPCDex…") },
);
export const LazyConnection = dynamic(
  () => {
    return import("./connection");
  },
  {
    ssr: false,
    loading: loadingDialog("Opening connection details…"),
  },
);
export const LazyMigration = dynamic(
  () => {
    return import("./migration");
  },
  {
    ssr: false,
    loading: loadingDialog("Opening migration…"),
  },
);
export const LazyRdxLibrary = dynamic(
  () => {
    return import("./rdx-library");
  },
  {
    ssr: false,
    loading: loadingDialog("Opening RDX library…"),
  },
);
export const LazyUpdateCheck = dynamic(
  () => {
    return import("./update-check");
  },
  {
    ssr: false,
    loading: loadingDialog("Opening update check…"),
  },
);
export const LazyTileSettings = dynamic(
  () => {
    return import("./tile-settings");
  },
  {
    ssr: false,
    loading: loadingDialog("Opening tile settings…"),
  },
);
export const LazyItemEditDialog = dynamic(
  () => {
    return import("./item-edit-dialog");
  },
  {
    ssr: false,
    loading: loadingDialog("Opening editor…"),
  },
);
