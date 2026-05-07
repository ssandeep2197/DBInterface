export type ColumnType = 'INT' | 'VARCHAR' | 'TEXT' | 'BOOLEAN' | 'DATETIME' | 'DATE' | 'DECIMAL';

export interface ColumnSchema {
  Field: string;
  Type: string;
  Null: 'YES' | 'NO';
  Key: 'PRI' | 'UNI' | 'MUL' | '';
  Default: string | null;
  Extra: string;
}

export interface DatabasesResponse {
  user: string[];
  system: string[];
}

export interface TablesResponse {
  database: string;
  tables: string[];
}

export interface TableDataResponse {
  schema: ColumnSchema[];
  rows: Record<string, unknown>[];
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface SessionInfo {
  authenticated: boolean;
  user?: string;
}
