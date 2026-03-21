# Maintainers

This document describes who maintains `drizzle-migration-guard` and what contributors can expect during review and triage.

## Current maintainer

- GitHub: [@saudademjj](https://github.com/saudademjj)

## Maintainer responsibilities

The maintainer is responsible for:

- reviewing and triaging issues and pull requests
- deciding repository direction and scope
- enforcing the [Code of Conduct](./CODE_OF_CONDUCT.md)
- maintaining release quality for published action behavior
- reviewing security reports and coordinating mitigations when needed

## Decision-making

This repository is currently maintained with a maintainer-led model.

In practice, that means:

- contributions are welcome from anyone
- maintainers make the final decision on scope, API changes, and release readiness
- not every proposal will be merged, even if it is technically valid

The primary review questions are:

1. Does this improve the repository for real users?
2. Is the scope understandable and maintainable?
3. Does it preserve the project's quality bar for tests, docs, and packaged output?

## Review priorities

Pull requests are easier to merge when they are:

- focused on one topic
- backed by tests when behavior changes
- documented when public behavior changes
- explicit about `dist/` updates for runtime changes

Maintainers may ask for:

- smaller scope
- clearer acceptance criteria
- stronger regression coverage
- follow-up issues instead of stacking unrelated work into one PR

## Inactive or delayed review

This is a small maintained repository, so review may sometimes be delayed.

If a pull request has been quiet for a while:

- keep the discussion in the PR thread
- avoid force-pushing away review context unless necessary
- post a concise follow-up with what changed since the last review

## Becoming a regular contributor

Consistently high-signal contributions help a lot. That usually looks like:

- good issue reports
- small, clean pull requests
- thoughtful tests
- docs kept in sync with behavior

There is no formal maintainer application process at this time.
