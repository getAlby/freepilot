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

interface NewJobBody {
  url: string;
}

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
      const { url } = request.body;

      if (!url) {
        return reply.code(400).send({ message: "Issue URL is required" });
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
            jobLogger.info("Preparing repository");
            const { repo, issueContent, owner, issueNumber } =
              await prepareRepository(jobLogger, job.id, url);
            jobLogger.info("Launching agent");
            await launchAgent(jobLogger, job.id, repo, issueContent);
            await publish(jobLogger, job.id, owner, repo, issueNumber);
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "COMPLETED",
              },
            });
          } catch (error) {
            console.error("job failed", error);
            await options.prisma.job.update({
              where: {
                id: job.id,
              },
              data: {
                status: "FAILED",
              },
            });
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
}

export default jobRoutes;
