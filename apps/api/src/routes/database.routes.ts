import { Router } from 'express';
import { z } from 'zod';
import { sqlIdentifier } from '@dbi/shared';
import { services } from '../services/factory';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await services(req).db.list());
  }),
);

router.post(
  '/',
  validate(z.object({ name: sqlIdentifier })),
  asyncHandler(async (req, res) => {
    await services(req).db.create(req.body.name);
    res.status(201).json({ name: req.body.name });
  }),
);

router.delete(
  '/:name',
  validate(z.object({ name: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    await services(req).db.drop(req.params.name);
    res.status(204).send();
  }),
);

export { router as databaseRoutes };
