import type {
  ColumnDefinition,
  ColumnSchema,
  CreateDatabaseRequest,
  CreateTableRequest,
  DatabasesResponse,
  DeleteRowRequest,
  InsertRowRequest,
  RenameColumnRequest,
  RenameTableRequest,
  SearchRowRequest,
  SessionInfo,
  TablesResponse,
  UpdateRowRequest,
} from '@dbi/shared';
import { api } from './client';

export const auth = {
  session: () => api.get<SessionInfo>('/auth/session'),
  login: (password: string) => api.post<SessionInfo>('/auth/login', { password }),
  logout: () => api.post<SessionInfo>('/auth/logout'),
};

export const databases = {
  list: () => api.get<DatabasesResponse>('/api/databases'),
  create: (req: CreateDatabaseRequest) => api.post<{ name: string }>('/api/databases', req),
  drop: (name: string) => api.del<void>(`/api/databases/${encodeURIComponent(name)}`),
};

export const tables = {
  list: (database: string) => api.get<TablesResponse>(`/api/tables/${encodeURIComponent(database)}`),
  create: (req: CreateTableRequest) => api.post<{ table: string }>('/api/tables', req),
  drop: (database: string, table: string) =>
    api.del<void>(`/api/tables/${encodeURIComponent(database)}/${encodeURIComponent(table)}`),
  truncate: (database: string, table: string) =>
    api.post<void>(`/api/tables/${encodeURIComponent(database)}/${encodeURIComponent(table)}/truncate`),
  rename: (req: RenameTableRequest) => api.patch<void>('/api/tables/rename', req),
  schema: (database: string, table: string) =>
    api.get<{ schema: ColumnSchema[] }>(
      `/api/tables/${encodeURIComponent(database)}/${encodeURIComponent(table)}/schema`,
    ),
  renameColumn: (req: RenameColumnRequest) => api.patch<void>('/api/tables/columns/rename', req),
};

export interface RowsResponse {
  schema: ColumnSchema[];
  rows: Record<string, unknown>[];
}

export const rows = {
  list: (database: string, table: string) =>
    api.get<RowsResponse>(`/api/rows/${encodeURIComponent(database)}/${encodeURIComponent(table)}`),
  insert: (req: InsertRowRequest) => api.post<{ insertId: number }>('/api/rows', req),
  update: (req: UpdateRowRequest) => api.patch<{ affectedRows: number }>('/api/rows', req),
  delete: (req: DeleteRowRequest) => api.del<{ affectedRows: number }>('/api/rows', req),
  search: (req: SearchRowRequest) => api.post<{ rows: Record<string, unknown>[] }>('/api/rows/search', req),
};

export type { ColumnDefinition };
