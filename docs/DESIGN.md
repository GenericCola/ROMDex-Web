# Design

The visual system. The token mechanics below ship with the template; the sections after them are yours to fill in.

## Tokens

`src/styles/colors.css` holds the raw color ramps. `src/styles/globals.css` turns them into tokens inside `@theme`, so each one is also a Tailwind utility.

- **Ramps.** Each color family (`grey`, `accent`, plus status colors) has stops `50`–`950`, light to dark, stored as HSL triplets (`--color-<family>-<stop>-base`). Add or swap families freely; keep the 11-stop shape.
- **Alpha.** Use a Tailwind modifier (`bg-grey-900/10`) in markup, or `hsl(var(--color-grey-900-base) / 0.1)` in CSS and inline styles.
- **Semantic roles.** `bg`, `surface`, `fg`, `fg-muted`, `border` and `focus` point into the ramps. Components use roles first and ramp stops only when no role fits.
- **Dark mode.** The dark theme (`<meta name="color-scheme" content="dark">`, see docs/CONVENTIONS.md) reverses every ramp's triplets (50 ↔ 950, black ↔ white). Roles and components follow automatically, so there are no dark-only colors.
- **Type scale.** `--fs-*` (`4xs` … `4xl`) shrinks below 1024px. The text components in `src/components/html` use it; Tailwind's `text-*` sizes are also available.
- **Fonts.** Four roles: `sans`, `serif`, `mono` and `cursive` (`font-sans` … `font-cursive`), loaded with `next/font` in `src/styles/fonts.ts`. To change a font, swap its loader there.
- **Everything else** (spacing, radii, shadows) is Tailwind's default until you need otherwise.

To rebrand, change the ramp values in `colors.css`. Nothing else has to move.

## Brand & style

_TBD: the feeling, references, and anti-references._

## Typography

_TBD: which font does what, and the heading/body scale._

## Components

_TBD: patterns worth keeping consistent (buttons, cards, forms)._

## Motion

Keep it subtle. `prefers-reduced-motion` is respected globally in `src/styles/defaults.css`.

## Loading states

One approach for every wait: `Pending`, `useDelayedFlag` and the `.romdex-spinner` / `.romdex-skeleton` classes (`src/components/romdex`, `src/styles/romdex-tools.css`).

- **Delay plus minimum.** A loader appears only after the work has run for 250 ms, and once shown stays for at least 400 ms. Fast IndexedDB reads show nothing; medium waits do not flicker. The delay only hides the loader, it never slows the work.
- **Reserved status line.** Render `Pending` in a fixed place. It always outputs the same `role="status"` line, so the spinner and label replace the message in place and nothing below jumps.
- **Label swap on the trigger.** The button that started the work changes its own text while busy ("Moving…", "Deleting…", "Applying…") and stays disabled.
- **Skeleton where the layout is known.** Use `.romdex-skeleton` blocks (opacity pulse only, `aria-hidden`) inside a container with `role="status"` and a label. Use a spinner when the shape is unknown.
- **Errors and empty states.** Errors use `role="alert"`. Show an empty state ("No comments yet.") only after loading has finished, never while the first read is in flight.
