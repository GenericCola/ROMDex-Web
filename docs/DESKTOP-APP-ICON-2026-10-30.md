# Restore the actual desktop application icon

The owner requested the desktop app artwork, not the header orb, Pokéball file
icon or a newly designed substitute. The web app still contained unrelated
starter N/R artwork; this correction removes that branding from app icon routes.

Source: private `GenericCola/ROMDex`, commit
`28c0ce4d449e655661dd7469999a6dc56779f28f`:

- `apps/romdex/desktop/main.cjs` selects `desktop/app.ico` for both BrowserWindow
  and the system tray.
- `apps/romdex/desktop/icons-original/README.md` distinguishes the old icon backups
  from the October 19 RD08 pixel-art revision.
- Current `shared-ui/romdex-pixel.svg` and `public/icon.svg` are identical Git blob
  `b413cef8b52c06914cff37e123f10e0bc9b1d3e9`.
- The exact original ICO is copied to `public/favicon.ico`, SHA256
  `36655b2b66acb932ab4973a85e027e0224a9595deea72c17c69b2d89e16c9c6e`.

`src/app/icon.svg` and `public/icons/source.svg` preserve the exact source bytes.
The build helper renders the original 16×16 grid and uses nearest-neighbor scaling
for 192px, 512px and 180px assets. The 256px result was compared byte-for-byte in
RGBA pixels with the recovered original `desktop/app.png`: identical. Normal
icons preserve transparency. Only the maskable icon adds padding: 288px artwork
centered inside 512px on the existing desktop red. Every artwork pixel stays
inside the central 80%-diameter safe circle. No artwork was regenerated or redrawn.

Manifest/viewport colors now use the existing desktop palette. The PWA shell
inventory hashes these assets normally; this is not a request to clear task
storage. Already installed browser/OS shortcuts may update their cached icon
separately from the page. Actual Windows install-icon refresh is not yet verified.
