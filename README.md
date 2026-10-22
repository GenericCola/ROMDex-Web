# ROMDex Web

React and PWA foundation, restarted from theGobindSingh/next-starter-template on October 22, 2026. Application features have not been ported.

Requires Node.js 24+ and pnpm 11.25.0.

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build
    pnpm browser:install
    pnpm test:e2e

Run pnpm dev at http://localhost:3001. Run pnpm build followed by pnpm start for the static preview at http://localhost:3000. Browser tests use port 3100. Service workers register only in production.

Read docs/PROJECT.md, docs/PWA.md, docs/CONVENTIONS.md and docs/DESIGN.md. The template components, styling tokens and tooling are retained where compatible. Payload and Lenis are removed. YouTrack is the only future application backend.

No deployment has been configured. Production hosting needs HTTPS, root-origin paths and the headers from public/_headers. Real iOS installation and HTTPS hosting require separate acceptance checks.
