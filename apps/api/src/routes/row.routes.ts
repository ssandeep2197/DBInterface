import { Router } from 'express';
import { z } from 'zod';
import {
  deleteRowSchema,
  insertRowSchema,
  searchRowSchema,
  sqlIdentifier,
  updateRowSchema,
} from '@dbi/shared';
import { RowService } from '../services/row.service';
import { TableService } from '../services/table.service';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const rows = new RowService();
const tables = new TableService();

router.use(requireAuth);

router.get(
  '/:database/:table',
  validate(z.object({ database: sqlIdentifier, table: sqlIdentifier }), 'params'),
  asyncHandler(async (req, res) => {
    const { database, table } = req.params;
    const [schema, data] = await Promise.all([
      tables.describe(database, table),
      rows.selectAll(database, table),
    ]);
    res.json({ schema, rows: data });
  }),
);

router.post(
  '/',
  validate(insertRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, values } = req.body;
    const result = await rows.insert(database, table, values);
    res.status(201).json(result);
  }),
);

router.patch(
  '/',
  validate(updateRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, values, where } = req.body;
    const result = await rows.update(database, table, values, where);
    res.json(result);
  }),
);

router.delete(
  '/',
  validate(deleteRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, where } = req.body;
    const result = await rows.delete(database, table, where);
    res.json(result);
  }),
);

router.post(
  '/search',
  validate(searchRowSchema),
  asyncHandler(async (req, res) => {
    const { database, table, column, query } = req.body;
    const result = await rows.search(database, table, column, query);
    res.json({ rows: result });
  }),
);

export { router as rowRoutes };
