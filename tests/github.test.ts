import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import * as github from "@actions/github";

import { getPullRequestChangedFiles, syncStickyComment } from "../src/github.js";

const require = createRequire(import.meta.url);
const githubCjs = require("@actions/github") as typeof import("@actions/github");

function withGithubContext<T>(payload: Record<string, unknown>, repo: string, fn: () => Promise<T>): Promise<T> {
  const previousPayload = githubCjs.context.payload;
  const previousRepo = process.env.GITHUB_REPOSITORY;
  githubCjs.context.payload = payload as typeof githubCjs.context.payload;
  process.env.GITHUB_REPOSITORY = repo;

  return fn()
    .finally(() => {
      githubCjs.context.payload = previousPayload;
      if (previousRepo === undefined) {
        delete process.env.GITHUB_REPOSITORY;
      } else {
        process.env.GITHUB_REPOSITORY = previousRepo;
      }
    });
}

test("getPullRequestChangedFiles returns null on GitHub API errors", async () => {
  const originalGetOctokit = githubCjs.getOctokit;
  githubCjs.getOctokit = () => ({
    paginate: async () => {
      throw new Error("boom");
    },
    rest: { pulls: { listFiles: () => ({}) } },
  });

  await withGithubContext({ pull_request: { number: 123 } }, "owner/repo", async () => {
    const result = await getPullRequestChangedFiles("token");
    assert.equal(result, null);
  });

  githubCjs.getOctokit = originalGetOctokit;
});

test("syncStickyComment does not throw on API errors", async () => {
  const originalGetOctokit = githubCjs.getOctokit;
  githubCjs.getOctokit = () => ({
    paginate: async () => {
      throw new Error("boom");
    },
    rest: {
      issues: {
        listComments: () => ({}),
        updateComment: async () => ({}),
        createComment: async () => ({}),
      },
    },
  });

  await withGithubContext({ pull_request: { number: 456 } }, "owner/repo", async () => {
    await syncStickyComment({
      githubToken: "token",
      body: "test",
      marker: "marker",
      allowCreate: false,
    });
  });

  githubCjs.getOctokit = originalGetOctokit;
});

test("getPullRequestChangedFiles handles large PR file lists", async () => {
  const originalGetOctokit = githubCjs.getOctokit;
  const files = Array.from({ length: 3001 }, (_, index) => ({
    filename: `src/file-${index}.ts`,
  }));

  githubCjs.getOctokit = () => ({
    paginate: async () => files,
    rest: { pulls: { listFiles: () => ({}) } },
  });

  await withGithubContext({ pull_request: { number: 789 } }, "owner/repo", async () => {
    const result = await getPullRequestChangedFiles("token");
    assert.equal(result?.length, 3001);
    assert.equal(result?.[0], "src/file-0.ts");
  });

  githubCjs.getOctokit = originalGetOctokit;
});
