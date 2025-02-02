import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ timestamp, level, message }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(), // optional color in dev
    logFormat
  ),
  transports: [
    // Console transport ensures Docker sees logs on stdout
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),

    // Optional: file transport if you also want to persist logs on the container’s filesystem
    // new winston.transports.File({ filename: 'app.log' }),
  ],
});

logger.info("✅ Winston logger active, logging to console!");

export default logger;
