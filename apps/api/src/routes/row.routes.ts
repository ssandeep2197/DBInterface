import { Router } from 'express';
import { z } from 'zod';
import {
  deleteRowSchema,
  insertRowSchema,
  searchRowSchema,
  sqlIdentifier,
  updateRowSchema,
} from '@dbi/shared';
import { services } from '../services/factory';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

router.use(requireAuth);

router.get(
  '/:database/:table',
  validate(z.object({ database: sqlIdentifier, table: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    const { database, table } = req.params;
    const s = services(req);
    const [schema, data] = await Promise.all([
      s.table.describe(database, table),
      s.row.selectAll(database, table),
    ]);
    res.json({ schema, rows: data });
  }),
);

router.post(
  '/',
  validate(insertRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, values } = req.body;
    const result = await services(req).row.insert(database, table, values);
    res.status(201).json(result);
  }),
);

router.patch(
  '/',
  validate(updateRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, values, where } = req.body;
    const result = await services(req).row.update(database, table, values, where);
    res.json(result);
  }),
);

router.delete(
  '/',
  validate(deleteRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, where } = req.body;
    const result = await services(req).row.delete(database, table, where);
    res.json(result);
  }),
);

router.post(
  '/search',
  validate(searchRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, column, query } = req.body;
    const result = await services(req).row.search(database, table, column, query);
    res.json({ rows: result });
  }),
);

export { router as rowRoutes };
