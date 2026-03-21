# Security Policy

## Supported versions

Security fixes are best-effort and are most likely to land on the actively maintained code line.

| Version | Supported |
| --- | --- |
| Latest commit on `main` | Yes |
| Latest tagged release | Yes |
| Older releases, tags, or arbitrary SHAs | No guarantee |

If you are reporting a vulnerability, please include the exact ref you tested, such as a tag, commit SHA, or workflow reference.

## Reporting a vulnerability

Please do **not** open a public issue for suspected security vulnerabilities.

Use one of these private channels instead:

1. GitHub security reporting for this repository, if the option is available in the repository Security tab.
2. If private reporting is not available, contact the repository owner through the GitHub profile:
   - <https://github.com/saudademjj>
3. If you cannot reach a private channel immediately, open a minimal public issue that only asks for a private contact path and do not include exploit details, secrets, or reproduction steps.

## What to include in a report

A strong report usually includes:

- a short summary of the vulnerability
- the affected version, tag, or commit SHA
- impact and attack preconditions
- reproduction steps or a minimal proof of concept
- whether the issue affects GitHub Actions execution, local execution, or both
- any relevant workflow snippet, `drizzle.config.*` shape, or command output
- whether secrets, tokens, path handling, comment rendering, or command execution are involved

If the issue depends on a specific GitHub Actions event or permission setup, include that context as well.

## What to expect

The maintainer will try to:

- acknowledge receipt within a reasonable time
- validate whether the report is reproducible
- assess severity and affected scope
- coordinate a fix when the report is confirmed

Response times may vary, but reports made in good faith will be handled respectfully and with care.

## Disclosure policy

Please avoid public disclosure until the issue has been reviewed and a fix or mitigation plan is in place.

When possible, prefer coordinated disclosure:

- report privately first
- allow time for validation and remediation
- share public details after a fix, mitigation, or clear maintainer guidance

## Scope guidance

Examples of security-relevant issues for this repository may include:

- command injection or unsafe shell execution
- unsafe handling of untrusted pull request input
- path traversal or workspace escape bugs
- secret leakage in summaries, logs, markdown reports, or PR comments
- permission misuse in GitHub Actions integration
- vulnerabilities that make CI execution materially less safe than intended

Examples that are usually **not** treated as security issues by themselves:

- requests for broader hardening without a demonstrated exploit path
- documentation mistakes with no security impact
- dependency upgrade requests without a concrete exploit or affected path in this project
- behavior that only affects local development in a non-adversarial setup

## Dependency vulnerabilities

If a report is primarily about an upstream dependency, please still include:

- the affected package and version
- why this repository is exposed in practice
- whether a direct upgrade, mitigation, or temporary pin would reduce risk

## Safe handling expectations

Please do not include:

- real secrets or production credentials
- personal access tokens
- private repository contents you do not have permission to share

Redacted logs and minimized reproductions are preferred whenever possible.
