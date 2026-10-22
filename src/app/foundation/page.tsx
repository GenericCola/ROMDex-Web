import Panel from "@components/panel";
import PwaControls from "@components/pwa-controls";
import ThemeToggle from "@components/theme-toggle";
import ComponentPreview from "../components/component-preview";
const FoundationPage = () => {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">ROMDex</h1>
        <ThemeToggle />
      </header>
      <Panel aria-label="Component preview">
        <ComponentPreview />
      </Panel>
      <Panel aria-label="Install and updates">
        <PwaControls />
      </Panel>
    </main>
  );
};
export default FoundationPage;
