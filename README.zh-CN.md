<p align="center">
  <img src="https://raw.githubusercontent.com/saudademjj/drizzle-migration-guard/main/docs/logo.svg" alt="drizzle-migration-guard logo" width="96" height="96" />
</p>

<h1 align="center">drizzle-migration-guard</h1>

<p align="center">
  面向 Pull Request 的 Drizzle migration 冲突解释层。
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/saudademjj/drizzle-migration-guard/main/docs/hero.svg" alt="drizzle-migration-guard hero" width="1100" />
</p>

`drizzle-migration-guard` 不是替代 Drizzle，而是把 `drizzle-kit check` 包装成更适合团队协作和代码评审的反馈层。

## 功能概览

| 能力 | 原始 `drizzle-kit check` | `drizzle-migration-guard` |
| --- | --- | --- |
| PR 感知执行 | 需要人工判断 | 只在相关文件变更时执行 |
| 冲突诊断 | 原始 CLI 输出 | 归类为可操作的失败类型 |
| GitHub Actions summary | 默认没有 | 自动输出可读 markdown 摘要 |
| PR sticky comment | 默认没有 | 自动写入修复导向评论 |
| Monorepo 支持 | 需要手写脚本 | 支持 `working-directory` 和显式 `config` |
| 阻断策略 | 通常要靠外部脚本 | 内置 `fail-on` 控制 |
| 修复指引 | 需要人工总结 | 直接给出下一步修复建议 |

## 这个项目解决什么问题

Drizzle 自带 `drizzle-kit check`，但默认输出更偏底层工具日志。对 PR 审查来说，大家往往还需要自己判断：

- 哪个 config 触发了失败
- 是 migration history collision，还是 config/dependency 问题
- 下一步该 pull、rebase、generate，还是先修配置

这个 action 的目标就是把这些判断前置成更清晰的 PR 反馈。

## 快速开始

建议在工作流里使用最新主版本标签，这样可以自动获得兼容的补丁更新。

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

## Monorepo 示例

当你的 Drizzle config 不在仓库根目录时：

- 用 `working-directory` 指定执行 `drizzle-kit check` 的包目录
- 用 `config` 指定该目录下的具体 config 文件

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

| 输入 | 默认值 | 说明 |
| --- | --- | --- |
| `config` | 空 | 支持逗号或换行分隔的 config 路径或 glob，适合 monorepo |
| `working-directory` | `.` | `drizzle-kit check` 实际执行目录 |
| `fail-on` | `collision` | 可选 `collision`、`all`、`none` |
| `comment-mode` | `sticky` | 可选 `sticky` 或 `off` |
| `github-token` | 空 | 用于读取 PR 文件和维护 sticky comment |
| `timeout-seconds` | `60` | `drizzle-kit check` 超时时间（秒） |

## Outputs

| 输出 | 含义 |
| --- | --- |
| `status` | `success`、`failure` 或 `skipped` |
| `summary` | 一行摘要 |
| `report-path` | 生成的 markdown report 绝对路径 |

## 行为说明

- 默认 discovery 只会检查当前目录下第一个根级 `drizzle.config.*`
- 多 config 支持是显式设计，建议通过 `config` 输入传入
- action 依赖项目里已经安装好的 `drizzle-kit`，实际调用是 `npx --no-install drizzle-kit check`
- 默认只有 `collision/history` 会阻断 PR
- 包内 `package.json` 和常见 lockfile 也会被视为相关变更，避免 monorepo 被误跳过
- rename 的 PR 文件会同时匹配当前路径和 GitHub 提供的旧路径

## 常见问题

### 为什么 action 显示 skipped

通常表示这次 PR 没有改到当前 config 相关的 config 文件、schema、migration 目录或包级 manifest 文件。  
如果是 monorepo，请先确认 `working-directory` 是否指向拥有该 Drizzle config 的包。

### 为什么提示找不到 `drizzle-kit`

需要在 action 执行前先安装依赖，例如 `npm ci`。  
这个 action 不会主动安装 `drizzle-kit`，而是直接调用 `npx --no-install drizzle-kit check`。

### 为什么 PR 上所有 config 都被检查了

通常是因为没有传 `github-token`。  
没有 token 时，action 无法读取 PR 文件列表，只能回退到“检查所有发现到的 config”。

## 本地开发

这个仓库不会提交 GitHub workflow 文件，因为 GitHub Marketplace 发布的 action 仓库需要保持 workflow-free。

```bash
npm install
npm run build
npm test
```

更多仓库协作文档：

- [贡献指南](./CONTRIBUTING.md)
- [行为准则](./CODE_OF_CONDUCT.md)
- [支持说明](./SUPPORT.md)
- [安全策略](./SECURITY.md)
- [维护者说明](./MAINTAINERS.md)

## License

MIT
