# Foundation verification

Verified on October 22, 2026 in C:\Users\mrgen\ROMDex on branch codex/web-foundation.

This is a fresh foundation from template revision 79d05e273dff44b1bba534752aeacb6aee071dc8. It does not recover the historical e9ef385 foundation. The template's Git history is preserved.

## Results

- Node.js 24.19.0 and pnpm 11.25.0.
- Frozen dependency installation succeeded.
- pnpm check passed: TypeScript, formatting, ESLint with zero warnings, four React component tests and eight worker/build tests.
- pnpm build passed and generated a static export with a content-hashed service worker covering 59 public shell assets.
- pnpm test:e2e passed all 20 checks across Chromium, Firefox, WebKit, Pixel 7 emulation and iPhone 13 emulation.
- Browser checks cover manifests, icons, headers, 404 responses, input/counter/reset behavior, horizontal overflow, offline reopening in another window, and explicit update consent with protection for other windows.
- Development on port 3001 and production preview on port 3000 returned HTTP 200. Owned smoke and test servers were stopped.

The browser tests found and verified fixes for an update-consent message timing race and input loss before React hydration. The preview controls remain disabled until their handlers are ready.

## Repository and boundaries

The origin is https://github.com/GenericCola/ROMDex-Web.git. The user authorized repository creation and publishing. The repository was created and confirmed private on October 22, 2026, with main as its default branch. The public template remote has push URL DISABLED. No hosting, release or Actions setup was performed.

Real iPhone/iPad installation, real-device offline/update behavior and HTTPS hosting acceptance remain unverified. Mobile browser emulation does not certify those behaviors. There is no application authentication, local data store, offline operation queue or YouTrack connection yet.

The original application, migration data and credentials were left untouched. Feature porting still awaits explicit authorization after original feature completion.

Local checkpoint: foundation changes are saved on codex/web-foundation. The repository-local Git identity uses the connected GenericCola profile.
