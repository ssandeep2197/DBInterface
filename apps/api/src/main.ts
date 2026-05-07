import 'dotenv/config';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { logger } from './lib/logger';
import { closePool } from './db/pool';

async function main() {
  const env = loadEnv();
  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    logger.info(`api listening on http://localhost:${env.API_PORT}`);
    logger.info(`api docs at http://localhost:${env.API_PORT}/api/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => undefined);
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start api');
  process.exit(1);
});
