import winston from "winston";

export function createJobLogger(jobDir: string) {
  const format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, label, timestamp, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(
        meta
      )}`;
    })
  );

  return winston.createLogger({
    transports: [
      new winston.transports.Console({
        format,
      }),
      new winston.transports.File({
        dirname: jobDir,
        filename: "log.txt",
        format,
      }),
    ],
  });
}
