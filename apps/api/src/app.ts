import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { loadEnv, isProd } from './config/env';
import { logger } from './lib/logger';
import { requestId } from './middleware/request-id';
import { errorHandler, notFound } from './middleware/error-handler';
import { authRoutes } from './routes/auth.routes';
import { databaseRoutes } from './routes/database.routes';
import { tableRoutes } from './routes/table.routes';
import { rowRoutes } from './routes/row.routes';
import { healthRoutes } from './routes/health.routes';
import { openApiSpec } from './lib/openapi';

export function createApp(): Express {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ requestId: (req as unknown as { id: string }).id }),
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    session({
      name: 'dbi.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: env.CROSS_SITE_COOKIES ? 'none' : 'lax',
        secure: env.CROSS_SITE_COOKIES || isProd(env),
        maxAge: env.SESSION_MAX_AGE_MS,
      },
    }),
  );
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use('/health', healthRoutes);
  app.use('/auth', authRoutes);
  app.use('/api/databases', databaseRoutes);
  app.use('/api/tables', tableRoutes);
  app.use('/api/rows', rowRoutes);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
