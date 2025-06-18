import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import { getJobDir } from "./getJobDir";
import { extractRepositoryName } from "./extractRepositoryName";
import winston from "winston";

/**
 * Cleanup old repository folders to ensure sufficient disk space
 * Deletes locally cloned repository folders for jobs older than 1 hour
 * that haven't been cleaned up yet
 */
export async function cleanupOldRepositories(
  logger: winston.Logger,
  prisma: PrismaClient
): Promise<void> {
  try {
    logger.info("Starting cleanup of old repository folders");

    // Get jobs older than 1 hour that haven't been cleaned up
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const oldJobs = await prisma.job.findMany({
      where: {
        createdAt: {
          lt: oneHourAgo,
        },
        cleanedUp: false,
      },
    });

    logger.info(`Found ${oldJobs.length} old jobs to clean up`);

    for (const job of oldJobs) {
      try {
        const repositoryName = extractRepositoryName(job.url);
        const jobDir = getJobDir(job.id);
        const repositoryPath = path.join(jobDir, repositoryName);

        // Check if repository folder exists
        try {
          await fs.access(repositoryPath);

          // Delete the repository folder
          await fs.rm(repositoryPath, { recursive: true, force: true });
          logger.info(`Deleted repository folder for job ${job.id}`, {
            repositoryName,
            repositoryPath,
          });
        } catch (error) {
          // Repository folder doesn't exist or is already deleted - that's fine
          logger.debug(`Repository folder doesn't exist for job ${job.id}`, {
            repositoryName,
            repositoryPath,
          });
        }

        // Mark job as cleaned up
        await prisma.job.update({
          where: {
            id: job.id,
          },
          data: {
            cleanedUp: true,
          },
        });

        logger.debug(`Marked job ${job.id} as cleaned up`);
      } catch (error) {
        logger.error(`Failed to cleanup job ${job.id}`, {
          error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
        // Continue with other jobs even if one fails
      }
    }

    logger.info("Completed cleanup of old repository folders");
  } catch (error) {
    logger.error("Error during repository cleanup", {
      error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    throw error;
  }
}
