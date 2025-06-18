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
import { cleanupOldRepositories } from "../jobs/cleanupOldRepositories";

interface NewJobBody {
  url: string;
  userNwcUrl: string;
}

interface JobRoutesOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
}

const abortJobControllers = new Map<number, AbortController>();

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
        // Clean up old repository folders to ensure sufficient disk space
        await cleanupOldRepositories(fastify.log, options.prisma);

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

        const abortController = new AbortController();
        abortJobControllers.set(job.id, abortController);

        (async () => {
          try {
            // check user NWC url
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "CHECKING_WALLET",
              },
            });

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
            const jobAfterPayment = await options.prisma.job.findUniqueOrThrow({
              where: { id: job.id },
            });
            if (jobAfterPayment.status === "CANCELLED") {
              jobLogger.info("Job was cancelled before preparing repository");
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

            const { repo, issueContent, owner, issueNumber } =
              await prepareRepository(jobLogger, job.id, url);

            // Check cancellation before repository preparation
            const jobBeforeAgent = await options.prisma.job.findUniqueOrThrow({
              where: { id: job.id },
            });
            if (jobBeforeAgent.status === "CANCELLED") {
              jobLogger.info("Job was cancelled before launching agent");
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

            await launchAgent(
              jobLogger,
              job.id,
              repo,
              issueContent,
              userNwcUrl,
              abortController.signal
            );

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
          } catch (error) {
            jobLogger.error("job failed", {
              error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            });
            await options.prisma.job.updateMany({
              where: {
                id: job.id,
                status: {
                  not: "CANCELLED",
                },
              },
              data: {
                status: "FAILED",
              },
            });
          }
          abortJobControllers.delete(job.id);
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
  fastify.post<{ Params: { id: string } }>(
    "/:id/cancel",
    async (request, reply) => {
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
        if (
          job.status === "COMPLETED" ||
          job.status === "FAILED" ||
          job.status === "CANCELLED"
        ) {
          return reply.code(400).send({
            message: `Cannot cancel job with status: ${job.status}`,
          });
        }

        const abortController = abortJobControllers.get(job.id);
        if (!abortController) {
          return reply
            .code(409)
            .send({ message: "Job abort controller is missing" });
        }
        abortController.abort();

        // Mark job as cancelled in database
        await options.prisma.job.update({
          where: { id: jobId },
          data: {
            status: "CANCELLED",
          },
        });

        return reply.send({
          message: "Job cancelled successfully",
          jobId: jobId,
          status: "CANCELLED",
        });
      } catch (error) {
        fastify.log.error(error, `Failed to cancel job ${jobId}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );
}

export default jobRoutes;
