# Unit and fixture type contracts

`pnpm check` includes `pnpm typecheck:tests`, using `tests/tsconfig.json`.
This checks unit tests, fixtures and Playwright end-to-end test types as well as application types. Executing
TypeScript tests through tsx alone does not perform this check.

The October 31 audit found 156 diagnostics across 43 test/fixture files. Repairs
add checked array/union narrowing, current required fixture fields, correct
persistence callback argument order and accurate callback/JSON types. Tests for
deliberately invalid data still construct invalid inputs and assert rejection.
The project-switch test now performs a real persistence save before switching.

Three declaration-only boundaries were clarified: the original desktop save
attention export, dynamic native custom-field keys and dynamic plan-preview
properties. No production behavior was changed. Plan preview tokens are checked
as strings before a test uses them for explicit publication approval.

The gate includes `.ts` and `.tsx` tests and fixtures, including Playwright
`.spec.ts` files. Typechecking does not execute Playwright browser tests. Passing types or unit tests does not replace the separate
browser workflow matrix, service-worker verification or installed-Windows
acceptance. Test lint is also separate: historical large fixtures still have
style/length diagnostics; no lint suppression was added to hide them.
