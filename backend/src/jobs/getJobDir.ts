import path from "path";

export function getJobDir(jobId: number) {
  return path.join(
          process.env.WORK_DIR || ".",
          "jobs",
          jobId.toString()
        );
}