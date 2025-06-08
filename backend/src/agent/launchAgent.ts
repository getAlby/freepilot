import { spawn } from "child_process";
import winston from "winston";
import { getJobDir } from "../jobs/getJobDir";

export async function launchAgent(
  jobLogger: winston.Logger,
  jobId: number,
  repo: string,
  issueContent: string
) {
  try {
    const jobDir = getJobDir(jobId);

    jobLogger.info("Spawning goose process");
    const prompt = `Follow the following steps in order:
    
    1. *Locally* checkout a new branch to address the issue. Prefix it with feat/ for features or chore/ or fix/ etc based on the type of change. Suffix the branch with -${jobId}
    2. *Locally* address the issue by making the relevant file changes. Don't show me the code and don't try to run the app.
    3. *Locally* commit the changes on the current branch with a meaningful description.

    The issue content is below:

    ${issueContent}
    `;

    const gooseProcess = spawn(
      "goose",
      ["run", "--with-builtin=developer", `-t "${prompt}"`],
      {
        env: {
          ...process.env,
          GOOSE_MODE: "auto",
        },
        cwd: `${jobDir}/${repo}`,
        stdio: ["ignore", "pipe", "pipe"], // Pipe stdout/stderr
        timeout: 10 * 60 * 1000, // 10 minutes
      }
    );
    console.log("Spawned process", { spawnargs: gooseProcess.spawnargs });
    jobLogger.info(
      "Spawned process: " + JSON.stringify(gooseProcess.spawnargs)
    );
    gooseProcess.stdout.on("data", (data) => {
      // Remove ANSI escape codes using a regular expression
      const cleanOutput = data.toString().replace(/\x1B\[[0-?9;]*[mG]/g, "");
      jobLogger.info(cleanOutput);
    });
    gooseProcess.stderr.on("data", (data) => {
      jobLogger.error(data.toString());
    });

    await new Promise<void>((resolve, reject) => {
      gooseProcess.on("error", (error) => {
        jobLogger.error("Process exited with error: " + error);
        reject(error);
      });
      gooseProcess.on("close", (code) => {
        if (!code) {
          resolve();
          return;
        }
        jobLogger.error("Goose process exited with non-success code " + code);
        reject(
          new Error("Goose process exited with non-success code: " + code)
        );
      });
    });
  } catch (error) {
    jobLogger.error("Error caught while running agent: " + error);
  }
}
