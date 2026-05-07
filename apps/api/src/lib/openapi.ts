/**
 * Hand-written OpenAPI 3.1 document. Kept terse — this is a contract surface,
 * not exhaustive prose. Served at /api/docs via swagger-ui-express.
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'DBInterface API',
    version: '3.0.0',
    description: 'REST API for managing a local MySQL instance via the DBInterface UI.',
  },
  servers: [{ url: 'http://localhost:8082', description: 'local' }],
  tags: [
    { name: 'auth' },
    { name: 'databases' },
    { name: 'tables' },
    { name: 'rows' },
    { name: 'health' },
  ],
  components: {
    securitySchemes: {
      sessionAuth: { type: 'apiKey', in: 'cookie', name: 'dbi.sid' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' }, code: { type: 'string' } },
        required: ['error'],
      },
    },
  },
  security: [{ sessionAuth: [] }],
  paths: {
    '/health': {
      get: { tags: ['health'], summary: 'Liveness check', responses: { '200': { description: 'ok' } } },
    },
    '/auth/session': {
      get: { tags: ['auth'], summary: 'Inspect current session', security: [], responses: { '200': { description: 'ok' } } },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Sign in with the MySQL root password',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { password: { type: 'string' } }, required: ['password'] } } },
        },
        responses: { '200': { description: 'ok' }, '401': { description: 'invalid credentials' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['auth'], summary: 'Sign out', responses: { '200': { description: 'ok' } } },
    },
    '/api/databases': {
      get: { tags: ['databases'], summary: 'List databases', responses: { '200': { description: 'ok' } } },
      post: { tags: ['databases'], summary: 'Create database', responses: { '201': { description: 'created' } } },
    },
    '/api/databases/{name}': {
      delete: { tags: ['databases'], summary: 'Drop database', responses: { '204': { description: 'deleted' } } },
    },
    '/api/tables/{database}': {
      get: { tags: ['tables'], summary: 'List tables in a database', responses: { '200': { description: 'ok' } } },
    },
    '/api/tables': {
      post: { tags: ['tables'], summary: 'Create table', responses: { '201': { description: 'created' } } },
    },
    '/api/tables/{database}/{table}': {
      delete: { tags: ['tables'], summary: 'Drop table', responses: { '204': { description: 'deleted' } } },
    },
    '/api/tables/{database}/{table}/schema': {
      get: { tags: ['tables'], summary: 'Describe table columns', responses: { '200': { description: 'ok' } } },
    },
    '/api/rows/{database}/{table}': {
      get: { tags: ['rows'], summary: 'Select rows + schema', responses: { '200': { description: 'ok' } } },
    },
    '/api/rows': {
      post: { tags: ['rows'], summary: 'Insert row', responses: { '201': { description: 'inserted' } } },
      patch: { tags: ['rows'], summary: 'Update row', responses: { '200': { description: 'ok' } } },
      delete: { tags: ['rows'], summary: 'Delete row', responses: { '200': { description: 'ok' } } },
    },
    '/api/rows/search': {
      post: { tags: ['rows'], summary: 'Search rows by column LIKE', responses: { '200': { description: 'ok' } } },
    },
  },
} as const;
