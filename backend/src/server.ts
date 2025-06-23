import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { PrismaClient } from "@prisma/client"; // Import Prisma Client
import jobRoutes from "./routes/jobs";
import statsRoutes from "./routes/stats";

const prisma = new PrismaClient(); // Instantiate Prisma Client

const fastify = Fastify({
  logger: true,
});

// Register fastify-static to serve the React app build
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../../frontend/dist"), // Path to the built React app
  prefix: "/", // Serve from the root
});

// Register user routes
fastify.register(jobRoutes, {
  prefix: "/api/jobs",
  prisma,
}); // Pass prisma and cache

// Register stats routes
fastify.register(statsRoutes, {
  prefix: "/api/stats",
  prisma,
});

// Fallback route to serve index.html for client-side routing
fastify.setNotFoundHandler((request, reply) => {
  // Check if the request is not for an API endpoint
  if (!request.raw.url?.startsWith("/api")) {
    reply.sendFile("index.html");
  } else {
    reply.code(404).send({ message: "Not Found" });
  }
});

// Run the server
const start = async () => {
  try {
    await fastify.listen({ port: parseInt(process.env.PORT || "3001"), host: "0.0.0.0" });
    fastify.log.info(
      `Server listening on ${fastify.server.address()?.toString()}`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
