<p align="center">
  <img src="https://raw.githubusercontent.com/saudademjj/drizzle-migration-guard/main/docs/logo.svg" alt="drizzle-migration-guard logo" width="96" height="96" />
</p>

<h1 align="center">drizzle-migration-guard</h1>

<p align="center">
  Explain Drizzle migration collisions in pull requests.
</p>

<p align="center">
  <a href="https://github.com/saudademjj/drizzle-migration-guard/releases">
    <img src="https://img.shields.io/github/v/release/saudademjj/drizzle-migration-guard?display_name=tag" alt="GitHub Release" />
  </a>
  <a href="https://github.com/saudademjj/drizzle-migration-guard/releases">
    <img src="https://img.shields.io/badge/action-v1-0ea5e9" alt="Action version" />
  </a>
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/saudademjj/drizzle-migration-guard/main/docs/hero.svg" alt="drizzle-migration-guard hero" width="1100" />
</p>

<p align="center">
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="./SUPPORT.md">Support</a> ·
  <a href="./SECURITY.md">Security</a> ·
  <a href="./MAINTAINERS.md">Maintainers</a>
</p>

`drizzle-migration-guard` wraps `drizzle-kit check`, turns raw failures into a short diagnosis, and leaves a sticky PR comment with concrete next steps when your migration history collides.

## Feature matrix

| Capability | Raw `drizzle-kit check` | `drizzle-migration-guard` |
| --- | --- | --- |
| Pull request-aware execution | Manual log inspection | Automatically scopes checks to relevant PR changes |
| Collision diagnosis | Raw CLI output | Classifies failures into actionable categories |
| GitHub Actions summary | Not provided by default | Writes a readable markdown summary |
| Sticky PR comment | Not provided by default | Posts a fix-oriented PR comment |
| Monorepo targeting | Manual scripting | Supports `working-directory` and explicit `config` input |
| Blocking policy | All-or-nothing shell scripting | `collision`, `all`, or `none` via `fail-on` |
| Re-run guidance | Reviewer must infer next steps | Gives a concrete fix recipe in the PR |

## Why this exists

Drizzle already ships `drizzle-kit check`, but the default output still makes reviewers jump between logs, local repro steps, and migration snapshots. This action adds the experience layer:

- Auto-detects `drizzle.config.ts` in the working directory.
- Skips itself when the PR does not touch Drizzle config, schema, or migration files.
- Normalizes failures into `collision/history`, `config/dependency`, or `unknown`.
- Writes a GitHub Actions summary and a sticky PR comment with a fix recipe.
- Blocks the PR only for `collision/history` by default.

## Quick start

Use the latest major tag in workflows so you automatically receive compatible patch updates.

```yaml
name: drizzle-migration-guard

on:
  pull_request:
    paths:
      - "drizzle.config.ts"
      - "src/db/**"
      - "drizzle/**"
      - "package.json"
      - "package-lock.json"

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - uses: saudademjj/drizzle-migration-guard@v1
        with:
          github-token: ${{ github.token }}
```

## Monorepo example

Use `working-directory` to choose which package should run `drizzle-kit check`, and use `config` when the config file is not the default `drizzle.config.*` in that directory.

```yaml
name: drizzle-migration-guard-monorepo

on:
  pull_request:
    paths:
      - "packages/api/**"
      - "package.json"
      - "package-lock.json"
      - "pnpm-lock.yaml"

jobs:
  guard-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - uses: saudademjj/drizzle-migration-guard@v1
        with:
          github-token: ${{ github.token }}
          working-directory: packages/api
          config: drizzle.config.ts
```

## Inputs

| Input | Default | Notes |
| --- | --- | --- |
| `config` | empty | Comma or newline separated config paths or glob patterns. Use this for multi-package repos. |
| `working-directory` | `.` | Directory where `drizzle-kit check` runs. |
| `fail-on` | `collision` | `collision`, `all`, or `none`. |
| `comment-mode` | `sticky` | `sticky` or `off`. |
| `github-token` | empty | Used to read PR files and update the sticky comment. |
| `timeout-seconds` | `60` | Timeout for `drizzle-kit check` (seconds). |

## Outputs

| Output | Meaning |
| --- | --- |
| `status` | `success`, `failure`, or `skipped` |
| `summary` | One-line job summary |
| `report-path` | Absolute path to the generated markdown report |

## Behavior notes

- Default discovery only checks the first root-level `drizzle.config.*` file it finds.
- Multi-config support is explicit by design. Pass config paths through the `config` input.
- The action expects `drizzle-kit` to be available in the checked-out project. It calls `npx --no-install drizzle-kit check`.
- Non-blocking failures still appear in the step summary and comment, but only `collision/history` fails the job by default.
- Package-local `package.json` and common lockfiles are treated as relevant PR changes, so monorepo packages do not get skipped when dependencies move.
- Renamed PR files are matched against both the current path and the previous path reported by GitHub.

## Troubleshooting

### The action says it was skipped

This usually means the PR did not touch the config file, schema files, migration directory, or package manifest paths tracked for that config. In monorepos, double-check that `working-directory` points at the package that owns the Drizzle config.

### `drizzle-kit` could not be found

Install `drizzle-kit` before the action runs, usually with `npm ci`, `pnpm install --frozen-lockfile`, or your team's equivalent. The action calls `npx --no-install drizzle-kit check`, so it expects the dependency to already exist in CI.

### The action checks every config on pull requests

That happens when `github-token` is missing. Without it, the action cannot read the PR file list from GitHub, so it falls back to checking every discovered config.

## Local development

This repository intentionally omits committed GitHub workflow files because GitHub Marketplace requires published action repositories to stay workflow-free.

```bash
npm install
npm run build
npm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow, validation expectations, and PR guidance, [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for community standards, and [SECURITY.md](./SECURITY.md) for vulnerability reporting guidance.
For support paths and maintainer expectations, see [SUPPORT.md](./SUPPORT.md) and [MAINTAINERS.md](./MAINTAINERS.md).

## License

MIT
