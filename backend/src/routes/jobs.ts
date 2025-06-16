import "websocket-polyfill";
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { PrismaClient } from "@prisma/client"; // Import Prisma Client and User type
import { launchAgent } from "../agent/launchAgent";
import fs from "fs/promises";
import path from "path";
import { prepareRepository } from "../git/prepareRepository";
import { getJobDir } from "../jobs/getJobDir";
import { createJobLogger } from "../jobs/createJobLogger";
import { publish } from "../git/publish";
import { nwc } from "@getalby/sdk";

interface NewJobBody {
  url: string;
  userNwcUrl: string;
}

// Global map to track running job processes
const jobProcesses = new Map<number, any>();

// Define options structure to include Prisma Client and the LN Backend Cache
interface JobRoutesOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
}

async function jobRoutes(
  fastify: FastifyInstance,
  options: JobRoutesOptions // Use the extended options type
) {
  // Create job
  fastify.post(
    "/",
    async (
      request: FastifyRequest<{ Body: NewJobBody }>,
      reply: FastifyReply
    ) => {
      const { url, userNwcUrl } = request.body;

      if (!url) {
        return reply.code(400).send({ message: "Issue URL is required" });
      }
      if (!userNwcUrl) {
        return reply.code(400).send({ message: "Wallet not connected" });
      }

      if (!process.env.GOOSE_NWC_SERVICE_URL) {
        return reply
          .code(500)
          .send({ message: "Service wallet not configured" });
      }

      try {
        const job = await options.prisma.job.create({
          data: {
            url,
            status: "INITIALIZING",
          },
        });

        const jobDir = getJobDir(job.id);
        await fs.mkdir(jobDir, { recursive: true });

        // https://github.com/getAlby/lnfly/issues/11
        const jobLogger = createJobLogger(jobDir);

        (async () => {
          try {
            // Check if job was cancelled before starting
            const currentJob = await options.prisma.job.findUnique({
              where: { id: job.id },
            });
            if (currentJob?.cancelled) {
              jobLogger.info("Job was cancelled before starting");
              return;
            }

            // check user NWC url
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "CHECKING_WALLET",
              },
            });

            // Check cancellation again
            const jobAfterWalletCheck = await options.prisma.job.findUnique({
              where: { id: job.id },
            });
            if (jobAfterWalletCheck?.cancelled) {
              jobLogger.info("Job was cancelled during wallet check");
              await options.prisma.job.update({
                where: { id: job.id },
                data: { status: "CANCELLED" },
              });
              return;
            }

            const userNwcClient = new nwc.NWCClient({
              nostrWalletConnectUrl: userNwcUrl,
            });
            const serviceNwcClient = new nwc.NWCClient({
              nostrWalletConnectUrl: process.env.GOOSE_NWC_SERVICE_URL,
            });
            // check the user can pay before starting
            const transaction = await serviceNwcClient.makeInvoice({
              amount: 1000,
              description: "Freepilot test payment",
            });
            await userNwcClient.payInvoice({
              invoice: transaction.invoice,
            });

            userNwcClient.close();
            serviceNwcClient.close();

            // Check cancellation before repository preparation
            const jobAfterPayment = await options.prisma.job.findUnique({
              where: { id: job.id },
            });
            if (jobAfterPayment?.cancelled) {
              jobLogger.info("Job was cancelled after payment check");
              await options.prisma.job.update({
                where: { id: job.id },
                data: { status: "CANCELLED" },
              });
              return;
            }

            jobLogger.info("Preparing repository");
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "PREPARING_REPOSITORY",
              },
            });

            // Check cancellation before repository preparation
            const jobBeforeRepo = await options.prisma.job.findUnique({
              where: { id: job.id },
            });
            if (jobBeforeRepo?.cancelled) {
              jobLogger.info("Job was cancelled before repository preparation");
              await options.prisma.job.update({
                where: { id: job.id },
                data: { status: "CANCELLED" },
              });
              return;
            }

            const { repo, issueContent, owner, issueNumber } =
              await prepareRepository(jobLogger, job.id, url);
              
            // Check cancellation before launching agent
            const jobBeforeAgent = await options.prisma.job.findUnique({
              where: { id: job.id },
            });
            if (jobBeforeAgent?.cancelled) {
              jobLogger.info("Job was cancelled before launching agent");
              await options.prisma.job.update({
                where: { id: job.id },
                data: { status: "CANCELLED" },
              });
              return;
            }

            jobLogger.info("Launching agent");
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "AGENT_WORKING",
              },
            });
            
            const agentProcess = await launchAgent(
              jobLogger,
              job.id,
              repo,
              issueContent,
              userNwcUrl,
              options.prisma
            );
            
            // Store the process for potential cancellation
            if (agentProcess) {
              jobProcesses.set(job.id, agentProcess);
              await options.prisma.job.update({
                where: { id: job.id },
                data: { processId: agentProcess.pid },
              });
            }

            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "PUBLISHING",
              },
            });
            const { prUrl } = await publish(
              jobLogger,
              job.id,
              url,
              owner,
              repo,
              issueNumber
            );
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "COMPLETED",
                prUrl,
              },
            });
            jobLogger.info("Job completed! 🎉");
            
            // Clean up process tracking
            jobProcesses.delete(job.id);
          } catch (error) {
            jobLogger.error("job failed", {
              error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            });
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "FAILED",
              },
            });
            // Clean up process tracking
            jobProcesses.delete(job.id);
          }
        })();

        return reply.code(201).send({
          id: job.id,
        });
      } catch (error) {
        fastify.log.error(
          error,
          "Error during signup or backend initialization"
        );
        // If backend init fails, the user record is not saved, which is desired.
        return reply
          .code(500)
          .send({ message: "Internal Server Error during signup" });
      }
    }
  );

  // Get job
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
      return reply.code(400).send({ message: "Invalid App ID format." });
    }

    try {
      // Verify app exists first (optional, but good practice)
      const job = await options.prisma.job.findUnique({
        where: { id: jobId },
      });
      if (!job) {
        return reply.code(404).send({ message: "Issue not found." });
      }

      const jobLogfile = path.join(getJobDir(jobId), "log.txt");

      const logfileContents = await fs.readFile(jobLogfile);

      return reply.send({
        id: job.id,
        url: job.url,
        prUrl: job.prUrl,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        logs: logfileContents.toString(),
      });
    } catch (error) {
      fastify.log.error(error, `Failed to fetch zaps for App ID: ${jobId}`);
      return reply.code(500).send({ message: "Internal Server Error." });
    }
  });

  // Cancel job
  fastify.post<{ Params: { id: string } }>("/:id/cancel", async (request, reply) => {
    const { id } = request.params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
      return reply.code(400).send({ message: "Invalid Job ID format." });
    }

    try {
      // Check if job exists and can be cancelled
      const job = await options.prisma.job.findUnique({
        where: { id: jobId },
      });
      
      if (!job) {
        return reply.code(404).send({ message: "Job not found." });
      }

      // Don't cancel already completed, failed, or cancelled jobs
      if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
        return reply.code(400).send({ 
          message: `Cannot cancel job with status: ${job.status}` 
        });
      }

      // Mark job as cancelled in database
      await options.prisma.job.update({
        where: { id: jobId },
        data: { 
          cancelled: true,
          status: "CANCELLED"
        },
      });

      // If there's an active process, terminate it
      const process = jobProcesses.get(jobId);
      if (process) {
        fastify.log.info(`Terminating process ${process.pid} for job ${jobId}`);
        try {
          // Send SIGTERM first for graceful shutdown
          process.kill('SIGTERM');
          
          // If process doesn't terminate gracefully, force kill after 5 seconds
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGKILL');
            }
          }, 5000);
          
        } catch (killError) {
          fastify.log.error(killError, `Failed to kill process for job ${jobId}`);
        }
        
        // Remove from tracking
        jobProcesses.delete(jobId);
      }

      // Log the cancellation
      try {
        const jobDir = getJobDir(jobId);
        const jobLogger = createJobLogger(jobDir);
        jobLogger.info("Job cancelled by user request");
      } catch (logError) {
        fastify.log.error(logError, `Failed to log cancellation for job ${jobId}`);
      }

      return reply.send({ 
        message: "Job cancelled successfully",
        jobId: jobId,
        status: "CANCELLED"
      });
    } catch (error) {
      fastify.log.error(error, `Failed to cancel job ${jobId}`);
      return reply.code(500).send({ message: "Internal Server Error." });
    }
  });
}

export default jobRoutes;
