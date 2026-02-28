import winston from 'winston';
import {env} from '#core/env.mjs';

const isDev = env.NODE_ENV === 'development';

const devFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({format: 'HH:mm:ss'}),
    winston.format.printf(
        ({timestamp, level, message}) => `${timestamp} ${level}: ${message}`,
    ),
);

const prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
);

export const logger = winston.createLogger({
    level: isDev ? 'debug' : 'info',
    format: isDev ? devFormat : prodFormat,
    transports: [new winston.transports.Console()],
});
