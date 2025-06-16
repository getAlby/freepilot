import { spawn } from "child_process";
import { getJobDir } from "../jobs/getJobDir";
import winston from "winston";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { GITHUB_BOT_USERNAME } from "./constants";

export async function publish(
  jobLogger: winston.Logger,
  jobId: number,
  issueUrl: string,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const jobDir = getJobDir(jobId);
    const repoDir = jobDir + "/" + repo;
    jobLogger.info("getting branch name");

    let currentBranchName = "";
    const gitGetBranchNameProcess = spawn(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      {
        cwd: repoDir,
      }
    );
    gitGetBranchNameProcess.stdout.on("data", (data) => {
      currentBranchName += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
      gitGetBranchNameProcess.on("error", (error) => {
        jobLogger.error("Process exited with error: " + error);
        reject(error);
      });
      gitGetBranchNameProcess.on("close", (code) => {
        if (!code) {
          resolve();
          return;
        }
        jobLogger.error(
          "git branch name process exited with non-success code " + code
        );
        reject(
          new Error("push branch process exited with non-success code: " + code)
        );
      });
    });

    currentBranchName = currentBranchName.trim();
    jobLogger.info("got branch name", { branchname: currentBranchName });

    jobLogger.info("pushing branch");
    const gitPushProcess = spawn("git", ["push", "-u", "origin", "HEAD"], {
      cwd: repoDir,
    });

    await new Promise<void>((resolve, reject) => {
      gitPushProcess.on("close", (code) => {
        if (!code) {
          resolve();
          return;
        }
        jobLogger.error("push branch exited with non-success code", { code });
        reject(
          new Error("push branch process exited with non-success code: " + code)
        );
      });
    });

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    jobLogger.info("getting upstream repository data");
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    });

    jobLogger.info("getting branch logs");
    let branchLogs = "";
    const gitBranchLogsProcess = spawn(
      "git",
      ["--no-pager", "log", `${repoData.default_branch}..HEAD`],
      {
        cwd: repoDir,
      }
    );

    gitBranchLogsProcess.stdout.on("data", (data) => {
      branchLogs += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
      gitBranchLogsProcess.on("error", (error) => {
        jobLogger.error("Process exited with error: " + error);
        reject(error);
      });
      gitBranchLogsProcess.on("close", (code) => {
        if (!code) {
          resolve();
          return;
        }
        jobLogger.error(
          "git logs process exited with non-success code " + code
        );
        reject(
          new Error("git logs process exited with non-success code: " + code)
        );
      });
    });

    branchLogs = `Fixes ${issueUrl}\n\n${branchLogs}`;

    const body = `${branchLogs}\n\nView job on Freepilot: https://freepilot.albylabs.com/jobs/${jobId}`;

    const pullRequestParams: RestEndpointMethodTypes["pulls"]["create"]["parameters"] =
      {
        owner,
        repo,
        head: `${GITHUB_BOT_USERNAME}:${currentBranchName}`,
        base: repoData.default_branch,
        body,
        title: `[Freepilot] ${currentBranchName
          .substring(0, currentBranchName.lastIndexOf("-")) // remove job number
          .replace("/", ": ")
          .replaceAll("-", " ")}`,
        maintainer_can_modify: true,
      };
    jobLogger.info("creating pull request", { pullRequestParams });

    try {
      const prResult = await octokit.pulls.create(pullRequestParams);
      jobLogger.info("successfully created pull request");

      return { prUrl: prResult.data.html_url };
    } catch (error) {
      console.error(
        "failed to create pull request",
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      jobLogger.error("failed to create pull request");
      throw error;
    }
  } catch (error) {
    jobLogger.error("Error caught while publishing: " + error);
    throw error;
  }
}
