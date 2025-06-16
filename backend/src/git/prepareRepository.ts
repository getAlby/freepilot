import { Octokit } from "@octokit/rest";
import { getJobDir } from "../jobs/getJobDir";
import { spawn } from "child_process";
import winston from "winston";
import { GITHUB_BOT_USERNAME } from "./constants";

export async function prepareRepository(
  jobLogger: winston.Logger,
  jobId: number,
  issueUrl: string
) {
  try {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const issueIndex = issueUrl.indexOf("/issues");
    const repoUrl = issueUrl.substring(0, issueIndex);
    const parts = repoUrl.split("/");
    const repo = parts[parts.length - 1];
    const owner = parts[parts.length - 2];
    const issueNumber = parseInt(
      issueUrl.substring(issueIndex + "/issues/".length)
    );

    jobLogger.info("extracted repository from issue URL", {
      repo,
      owner,
      repoUrl,
      issueNumber,
    });
    jobLogger.info("forking repository", { repo, owner });

    try {
      await octokit.repos.createFork({
        repo,
        owner,
      });
    } catch (error) {
      jobLogger.error("Failed to fork repo", {
        error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
    }

    jobLogger.info("getting upstream repository data");
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    });

    jobLogger.info("ensuring fork is up to date");
    try {
      const result = await octokit.repos.mergeUpstream({
        branch: repoData.default_branch,
        owner: GITHUB_BOT_USERNAME,
        repo,
      });
      jobLogger.info("Synced fork", { message: result.data.message });
    } catch (error) {
      jobLogger.error("Failed to update fork", {
        error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      throw error;
    }

    jobLogger.info("cloning forked repository", { repo, owner });

    // clone the repo
    const jobDir = getJobDir(jobId);
    const gitCloneProcess = spawn(
      "git",
      ["clone", `git@github.com:${GITHUB_BOT_USERNAME}/${repo}.git`],
      {
        cwd: jobDir,
        //stdio: ["ignore", "pipe", "pipe"], // Pipe stdout/stderr
      }
    );

    await new Promise<void>((resolve, reject) => {
      gitCloneProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        jobLogger.info("clone process exited with non-success code", { code });
        reject(
          new Error("clone process exited with non-success code: " + code)
        );
      });
    });

    const issue = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    // TODO: make sure the clone is up to date with upstream

    const issueBody = issue.data.body;
    if (!issueBody) {
      jobLogger.warn(
        "The issue has no description. Add a description for better results."
      );
    }

    return {
      owner,
      repo,
      issueContent: issue.data.title + "\n\n" + issueBody,
      issueNumber,
    };
  } catch (error) {
    jobLogger.error("Error caught while preparing repository: " + error);
    throw error;
  }
}
