import { Router } from 'express';
import { z } from 'zod';
import {
  createTableSchema,
  renameColumnSchema,
  renameTableSchema,
  sqlIdentifier,
} from '@dbi/shared';
import { services } from '../services/factory';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

router.use(requireAuth);

router.get(
  '/:database',
  validate(z.object({ database: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    const tables = await services(req).table.list(req.params.database);
    res.json({ database: req.params.database, tables });
  }),
);

router.post(
  '/',
  validate(createTableSchema),
  asyncHandler(async (req, res) => {
    const { database, table, columns } = req.body;
    await services(req).table.create(database, table, columns);
    res.status(201).json({ database, table });
  }),
);

router.delete(
  '/:database/:table',
  validate(z.object({ database: sqlIdentifier, table: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    await services(req).table.drop(req.params.database, req.params.table);
    res.status(204).send();
  }),
);

router.post(
  '/:database/:table/truncate',
  validate(z.object({ database: sqlIdentifier, table: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    await services(req).table.truncate(req.params.database, req.params.table);
    res.json({ ok: true });
  }),
);

router.patch(
  '/rename',
  validate(renameTableSchema),
  asyncHandler(async (req, res) => {
    const { database, oldName, newName } = req.body;
    await services(req).table.rename(database, oldName, newName);
    res.json({ database, table: newName });
  }),
);

router.get(
  '/:database/:table/schema',
  validate(z.object({ database: sqlIdentifier, table: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    const schema = await services(req).table.describe(req.params.database, req.params.table);
    res.json({ schema });
  }),
);

router.patch(
  '/columns/rename',
  validate(renameColumnSchema),
  asyncHandler(async (req, res) => {
    const { database, table, oldName, newName } = req.body;
    await services(req).table.renameColumn(database, table, oldName, newName);
    res.json({ database, table, column: newName });
  }),
);

export { router as tableRoutes };
