import { z } from 'zod';
import { sqlIdentifier } from './identifiers';

const columnTypeEnum = z.enum(['INT', 'VARCHAR', 'TEXT', 'BOOLEAN', 'DATETIME', 'DATE', 'DECIMAL']);

export const loginRequestSchema = z.object({
  password: z.string().min(1, 'password required').max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const createDatabaseSchema = z.object({
  name: sqlIdentifier,
});
export type CreateDatabaseRequest = z.infer<typeof createDatabaseSchema>;

export const columnDefinitionSchema = z.object({
  name: sqlIdentifier,
  type: columnTypeEnum,
  primaryKey: z.boolean().default(false),
  nullable: z.boolean().default(true),
  length: z.number().int().positive().max(65535).optional(),
});
export type ColumnDefinition = z.infer<typeof columnDefinitionSchema>;

export const createTableSchema = z.object({
  database: sqlIdentifier,
  table: sqlIdentifier,
  columns: z.array(columnDefinitionSchema).min(1, 'at least one column required'),
});
export type CreateTableRequest = z.infer<typeof createTableSchema>;

export const renameTableSchema = z.object({
  database: sqlIdentifier,
  oldName: sqlIdentifier,
  newName: sqlIdentifier,
});
export type RenameTableRequest = z.infer<typeof renameTableSchema>;

export const renameColumnSchema = z.object({
  database: sqlIdentifier,
  table: sqlIdentifier,
  oldName: sqlIdentifier,
  newName: sqlIdentifier,
});
export type RenameColumnRequest = z.infer<typeof renameColumnSchema>;

export const insertRowSchema = z.object({
  database: sqlIdentifier,
  table: sqlIdentifier,
  values: z.record(z.string(), z.unknown()),
});
export type InsertRowRequest = z.infer<typeof insertRowSchema>;

export const updateRowSchema = z.object({
  database: sqlIdentifier,
  table: sqlIdentifier,
  values: z.record(z.string(), z.unknown()),
  where: z.record(z.string(), z.unknown()).refine((w) => Object.keys(w).length > 0, {
    message: 'where clause required',
  }),
});
export type UpdateRowRequest = z.infer<typeof updateRowSchema>;

export const deleteRowSchema = z.object({
  database: sqlIdentifier,
  table: sqlIdentifier,
  where: z.record(z.string(), z.unknown()).refine((w) => Object.keys(w).length > 0, {
    message: 'where clause required',
  }),
});
export type DeleteRowRequest = z.infer<typeof deleteRowSchema>;

export const searchRowSchema = z.object({
  database: sqlIdentifier,
  table: sqlIdentifier,
  column: sqlIdentifier,
  query: z.string().max(255),
});
export type SearchRowRequest = z.infer<typeof searchRowSchema>;
