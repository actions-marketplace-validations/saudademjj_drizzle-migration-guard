import * as core from "@actions/core";
import * as github from "@actions/github";

import { normalizeFileList } from "./utils.js";

function getPullRequestNumber(): number | null {
  const pullRequest = github.context.payload.pull_request;
  return pullRequest?.number ?? null;
}

export function hasPullRequestContext(): boolean {
  return getPullRequestNumber() !== null;
}

export async function getPullRequestChangedFiles(githubToken: string): Promise<string[] | null> {
  const pullRequestNumber = getPullRequestNumber();
  if (!pullRequestNumber || !githubToken) {
    return null;
  }

  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(githubToken);
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullRequestNumber,
    per_page: 100,
  });

  return normalizeFileList(files.map((file) => file.filename));
}

export async function syncStickyComment(options: {
  githubToken: string;
  body: string;
  marker: string;
  allowCreate: boolean;
}): Promise<void> {
  const pullRequestNumber = getPullRequestNumber();
  if (!pullRequestNumber) {
    return;
  }

  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(options.githubToken);
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullRequestNumber,
    per_page: 100,
  });

  const existing = comments.find((comment) => comment.body?.includes(options.marker));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: options.body,
    });
    core.info(`Updated sticky PR comment ${existing.id}.`);
    return;
  }

  if (!options.allowCreate) {
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullRequestNumber,
    body: options.body,
  });
  core.info("Created sticky PR comment.");
}

