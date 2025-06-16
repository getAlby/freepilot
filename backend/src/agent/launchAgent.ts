import { spawn } from "child_process";
import winston from "winston";
import { getJobDir } from "../jobs/getJobDir";
import { PrismaClient } from "@prisma/client";

export async function launchAgent(
  jobLogger: winston.Logger,
  jobId: number,
  repo: string,
  issueContent: string,
  userNwcUrl: string,
  prisma: PrismaClient
) {
  try {
    const jobDir = getJobDir(jobId);

    jobLogger.info("Spawning goose process");
    const prompt = `Follow the following steps in order:
    
    1. *Locally* checkout a new branch to address the issue. Prefix it with feat/ for features or chore/ or fix/ etc based on the type of change. Suffix the branch with -${jobId}
    2. *Locally* address the issue by making the relevant file changes.
    3. *Locally* commit the changes on the current branch with a meaningful description.

    Make sure you follow these rules:
    1. DO NOT try to install, build, write tests or run tests on the changes UNLESS specified in the issue content below.

    The issue content is below:

    ${issueContent}
    `;

    const gooseProcess = spawn(
      process.env.GOOSE_BIN || "goose",
      ["run", "--with-builtin=developer", `-t "${prompt}"`],
      {
        env: {
          ...process.env,
          GOOSE_MODE: "auto",
          GOOSE_MODEL: "anthropic/claude-sonnet-4",
          //GOOSE_MODEL: "deepseek/deepseek-chat-v3-0324:free", // unreliable
          // TODO: switch to PPQ
          GOOSE_PROVIDER: "openrouter",
          ...(process.env.OPENROUTER_API_KEY
            ? { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY }
            : {}),
          GOOSE_NWC_USER_URL: userNwcUrl,
        },
        cwd: `${jobDir}/${repo}`,
        stdio: ["ignore", "pipe", "pipe"], // Pipe stdout/stderr
        timeout: 100 * 60 * 1000, // 100 minutes
      }
    );
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

    // Periodically check for cancellation
    const cancellationCheckInterval = setInterval(async () => {
      try {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
        });
        if (job?.cancelled) {
          jobLogger.info("Job cancellation detected, terminating process");
          clearInterval(cancellationCheckInterval);
          gooseProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!gooseProcess.killed) {
              gooseProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      } catch (error) {
        jobLogger.error("Error checking for cancellation:", error);
      }
    }, 1000); // Check every second

    return new Promise<any>((resolve, reject) => {
      gooseProcess.on("error", (error) => {
        clearInterval(cancellationCheckInterval);
        jobLogger.error("Process exited with error: " + error);
        reject(error);
      });
      gooseProcess.on("close", (code) => {
        clearInterval(cancellationCheckInterval);
        
        // Check if job was cancelled
        prisma.job.findUnique({ where: { id: jobId } }).then(job => {
          if (job?.cancelled) {
            jobLogger.info("Process terminated due to job cancellation");
            reject(new Error("Job was cancelled"));
            return;
          }
          
          if (!code) {
            resolve(gooseProcess);
            return;
          }
          jobLogger.error("Goose process exited with non-success code " + code);
          reject(
            new Error("Goose process exited with non-success code: " + code)
          );
        }).catch(dbError => {
          jobLogger.error("Error checking job status:", dbError);
          if (!code) {
            resolve(gooseProcess);
          } else {
            reject(new Error("Goose process exited with non-success code: " + code));
          }
        });
      });
    });
  } catch (error) {
    jobLogger.error("Error caught while running agent: " + error);
    throw error;
  }
}
