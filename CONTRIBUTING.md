# Contributing to drizzle-migration-guard

Thanks for helping improve `drizzle-migration-guard`.

This project is a small GitHub Action, so high-signal contributions are usually the ones that keep behavior easy to reason about: focused fixes, clear docs, strong tests, and minimal surprise in CI.

Please read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before participating. We want issue threads, PR reviews, and design discussions to stay respectful, calm, and useful.
For support routing and maintainer expectations, see [SUPPORT.md](./SUPPORT.md) and [MAINTAINERS.md](./MAINTAINERS.md).

## Good ways to contribute

- Report bugs with a small reproduction or failing scenario.
- Improve docs, examples, and troubleshooting notes.
- Tighten parser, discovery, or reporter behavior with regression tests.
- Add compatibility or smoke coverage for real-world Drizzle workflows.

## Reporting issues

When opening an issue, the most helpful reports usually include:

- the expected behavior
- the actual behavior
- a minimal repo shape or config example
- raw `drizzle-kit check` output when relevant
- whether the failure happened locally, in CI, or both

If the issue is about pull request matching, include which files changed in the PR. If it is about config loading, include the relevant `drizzle.config.*` shape.

## Before you start

- Small documentation fixes and targeted bug fixes can usually go straight to a pull request.
- For bigger behavior changes, new inputs, output shape changes, or broader product direction, open an issue first so we can align on scope.
- Keep pull requests focused. A small, reviewable PR is much easier to merge than a mixed refactor.
- If you are changing action behavior, prefer updating tests in the same PR rather than leaving follow-up coverage for later.

## Local setup

This repository uses Node.js and npm.

```bash
npm install
npm run build
npm test
```

Recommended baseline:

- Node.js 20 or newer for local work.
- npm as the package manager for this repository.

Current CI coverage includes:

- Node 20 and 22
- Ubuntu, macOS, and Windows

## Project layout

- `src/`: action runtime, discovery, parser, reporter, and GitHub integration code
- `tests/`: unit, integration, and end-to-end coverage
- `docs/`: repository assets used by the README
- `dist/`: committed action bundle consumed by GitHub Actions

## TypeScript-first code standards

The repository source is TypeScript-first.

- Prefer `.ts` for runtime source and tests.
- Do not add new JavaScript source files under `src/` unless a tooling boundary requires it.
- Keep exported function signatures and shared data shapes explicit.
- Prefer narrow types, discriminated unions, and small helper types over broad `string | any` style fallbacks.
- Prefer `unknown` plus narrowing over `any`.
- When a value comes from Drizzle config loading, GitHub payloads, or command output, validate and narrow it before use.

## Making changes

When you update behavior, please keep these repo-specific rules in mind:

- Add or update tests for any user-visible behavior change.
- Update `README.md` and `action.yml` when inputs, outputs, defaults, or examples change.
- Rebuild `dist/` when runtime source files change.
- Avoid unrelated cleanup in the same PR unless it is required to make the change safe.

For this repository, behavior changes often fall into one of these buckets:

- config discovery and changed-file matching
- command execution and timeout handling
- parser classification and failure messaging
- markdown report or sticky comment rendering

Try to keep the change scoped to one bucket unless the behavior truly crosses boundaries.

Useful commands:

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run verify:dist
npm run ci
npm run ci:strict
```

## Validation expectations

Choose the smallest command set that matches the scope of your change:

- Docs-only changes: self-review for wording, examples, and link accuracy.
- Test-only changes: `npm test`
- Source changes: `npm run ci`
- Changes that affect runtime packaging, CI behavior, or release confidence: `npm run ci:strict`

`npm run ci:strict` is the best final check before asking for review because it includes typechecking, tests, coverage, and `dist/` verification.

## Pull request expectations

Please make it easy for reviewers to answer three questions quickly:

1. What changed?
2. Why did it change?
3. How was it validated?

A strong pull request usually:

- Links the related issue when one exists.
- Summarizes the user-facing impact.
- Lists the validation commands that were run.
- Calls out any follow-up work or intentionally deferred edge cases.
- Includes sample output when the action summary, PR comment, or failure wording changes.
- Notes whether `dist/` changed and why.

## Review standards

PRs are easier to merge when they are:

- small enough to review in one sitting
- backed by focused tests
- clear about behavior changes versus refactors
- updated to match repository docs when public behavior changes

Maintainers may ask for scope reduction if a PR mixes multiple unrelated concerns.

## Dist artifacts

This repository commits built action artifacts in `dist/`.

If your change affects runtime code under `src/`, run:

```bash
npm run build
```

Then make sure the updated `dist/index.js` and `dist/index.js.map` are included in your PR. `npm run verify:dist` checks that committed artifacts are in sync.

## Commit and review guidance

- Use clear commit messages that describe the change.
- Prefer one topic per PR.
- If review feedback requires follow-up commits, that is completely fine; readability matters more than a perfectly compressed history while the work is in flight.

## Licensing

There is no separate CLA at this time.

By submitting a contribution, you agree that your work will be licensed under the repository's MIT license.
