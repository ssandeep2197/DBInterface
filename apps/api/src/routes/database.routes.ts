import { Router } from 'express';
import { z } from 'zod';
import { sqlIdentifier } from '@dbi/shared';
import { DatabaseService } from '../services/database.service';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const service = new DatabaseService();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await service.list());
  }),
);

router.post(
  '/',
  validate(z.object({ name: sqlIdentifier })),
  asyncHandler(async (req, res) => {
    await service.create(req.body.name);
    res.status(201).json({ name: req.body.name });
  }),
);

router.delete(
  '/:name',
  validate(z.object({ name: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    await service.drop(req.params.name);
    res.status(204).send();
  }),
);

export { router as databaseRoutes };
