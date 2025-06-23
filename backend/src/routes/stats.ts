/**
 * Stats API Route - Provides fun statistics about Freepilot bot performance
 *
 * Returns:
 * - Total number of completed jobs
 * - Total amount earned in sats
 * - Total number of tokens processed
 * - Number of merged pull requests
 *
 * Features caching for 1 hour to avoid expensive calculations on every request.
 */
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { PrismaClient } from "@prisma/client";
import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";
import { getJobDir } from "../jobs/getJobDir";

interface StatsRoutesOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
}

interface CachedStats {
  totalCompletedJobs: number;
  totalEarningsInSats: number;
  totalTokensProcessed: number;
  totalMergedPRs: number;
  lastUpdated: Date;
}

// Cache stats for 1 hour
let cachedStats: CachedStats | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

async function calculateStats(prisma: PrismaClient): Promise<CachedStats> {
  // 1. Get completed jobs from database
  const completedJobs = await prisma.job.findMany({
    where: {
      status: "COMPLETED",
    },
    select: {
      id: true,
      prUrl: true,
    },
  });

  let totalEarningsInSats = 0;
  let totalTokensProcessed = 0;

  // 2. Read logs from each completed job to sum tokens and price
  for (const job of completedJobs) {
    try {
      const jobDir = getJobDir(job.id);
      const logFilePath = path.join(jobDir, "log.txt");

      const logContent = await fs.readFile(logFilePath, "utf-8");

      // Parse logs for token count and pricing information
      // Look for patterns like "tokens": <number> and "sats": <number> or similar
      const tokenMatches = logContent.match(/(\d+) (input|output)/gi);
      const satMatches = logContent.match(/(\d+) (sats)/gi);

      // Sum up any token counts found
      if (tokenMatches) {
        for (const match of tokenMatches) {
          const tokenCount = parseInt(match.match(/(\d+)/)?.[1] || "0");
          if (!isNaN(tokenCount)) {
            totalTokensProcessed += tokenCount;
          }
        }
      }

      // Sum up any sats/costs found
      if (satMatches) {
        for (const match of satMatches) {
          const satCount = parseInt(match.match(/(\d+)/)?.[1] || "0");
          if (!isNaN(satCount)) {
            totalEarningsInSats += satCount;
          }
        }
      }
    } catch (error) {
      // Skip jobs where log files can't be read
      console.warn(`Could not read log file for job ${job.id}:`, error);
    }
  }

  // 3. Use Octokit to fetch merged pull requests
  let totalMergedPRs = 0;

  // Only fetch GitHub stats if token is available
  if (process.env.GITHUB_TOKEN) {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Extract GitHub repository information from PR URLs
    const repoStats = new Map<string, Set<number>>();

    for (const job of completedJobs) {
      if (job.prUrl) {
        try {
          // Parse GitHub PR URL to extract owner, repo, and PR number
          const prUrlMatch = job.prUrl.match(
            /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
          );
          if (prUrlMatch) {
            const [, owner, repo, prNumber] = prUrlMatch;
            const repoKey = `${owner}/${repo}`;

            if (!repoStats.has(repoKey)) {
              repoStats.set(repoKey, new Set());
            }
            repoStats.get(repoKey)!.add(parseInt(prNumber));
          }
        } catch (error) {
          console.warn(`Could not parse PR URL for job ${job.id}:`, error);
        }
      }
    }

    // Check merge status for each PR
    for (const [repoKey, prNumbers] of repoStats) {
      const [owner, repo] = repoKey.split("/");

      for (const prNumber of prNumbers) {
        try {
          const { data: pullRequest } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
          });

          if (pullRequest.merged) {
            totalMergedPRs++;
          }
        } catch (error) {
          // Skip PRs that can't be fetched or don't exist
          console.warn(`Could not fetch PR ${prNumber} for ${repoKey}:`, error);
        }
      }
    }
  } else {
    console.warn("GITHUB_TOKEN not provided, skipping merged PR stats");
  }

  return {
    totalCompletedJobs: completedJobs.length,
    totalEarningsInSats,
    totalTokensProcessed,
    totalMergedPRs,
    lastUpdated: new Date(),
  };
}

async function statsRoutes(
  fastify: FastifyInstance,
  options: StatsRoutesOptions
) {
  // Get stats endpoint with caching
  fastify.get("/", async (request, reply) => {
    try {
      // Check if we have cached stats and they're still fresh
      if (
        cachedStats &&
        Date.now() - cachedStats.lastUpdated.getTime() < CACHE_DURATION
      ) {
        return reply.send({
          success: true,
          data: cachedStats,
          cached: true,
        });
      }

      // Calculate fresh stats
      const stats = await calculateStats(options.prisma);
      cachedStats = stats;

      return reply.send({
        success: true,
        data: stats,
        cached: false,
      });
    } catch (error) {
      fastify.log.error(error, "Failed to fetch stats");
      return reply.code(500).send({
        success: false,
        message: "Internal Server Error while fetching stats",
      });
    }
  });
}

export default statsRoutes;
