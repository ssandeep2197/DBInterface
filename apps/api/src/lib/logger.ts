import pino from 'pino';
import { loadEnv, isProd } from '../config/env';

const env = loadEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'dbinterface-api' },
  redact: {
    paths: ['password', '*.password', 'req.headers.cookie', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
  ...(isProd(env)
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service' },
        },
      }),
});
