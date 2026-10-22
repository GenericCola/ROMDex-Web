import Panel from "@components/panel";
import PwaControls from "@components/pwa-controls";
import ThemeToggle from "@components/theme-toggle";
import ComponentPreview from "./components/component-preview";
const HomePage = () => {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">ROMDex</h1>
        <ThemeToggle />
      </header>
      <p className="text-fg-muted">
        Web foundation. The application features will be added after the
        original app is ready.
      </p>
      <Panel aria-labelledby="preview-title">
        <h2 id="preview-title" className="mb-4 text-xl font-semibold">
          Component preview
        </h2>
        <ComponentPreview />
      </Panel>
      <Panel aria-labelledby="install-title">
        <h2 id="install-title" className="mb-4 text-xl font-semibold">
          Install and updates
        </h2>
        <PwaControls />
      </Panel>
    </main>
  );
};
export default HomePage;
