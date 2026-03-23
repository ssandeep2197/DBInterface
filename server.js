'use strict';

const express = require('express');
const open = require('open');
const routes = require('./REST/api');
const logger = require('./middleware/logger');
const {
  getDatabases,
  auth,
  connectDb,
  getTables,
  getTableData,
  getTableSchema,
  logout,
} = require('./dbController');

require('dotenv').config();

const server = express();

let logged = false;
let selectedDb = '';

const systemDatabases = [
  'information_schema',
  'sys',
  'performance_schema',
  'mysql',
];

const PORT = parseInt(process.env.PORT || process.env.port || '8082', 10);

server.set('view engine', 'hbs');
server.use(express.static(`${__dirname}/views`));
server.set('views', `${__dirname}/views`);
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(logger);
server.use('/api', routes);

// ─── Auth ────────────────────────────────────────────────────────────────────

server.get('/', (_req, res) => res.redirect('/auth'));

server.get('/auth', async (req, res) => {
  if (logged) return res.redirect('/databases');
  // Pre-warm / reset any stale connection
  await auth('__probe__').catch(() => { });
  res.sendFile(`${__dirname}/views/auth/login.html`);
});

server.post('/auth', async (req, res) => {
  if (logged) return res.send('logged');

  const { password = '' } = req.body;
  if (!password || password === 'undefined') {
    logged = false;
    return res.redirect('/auth');
  }

  try {
    await auth(password);
    logged = true;
    res.send('logged');
  } catch {
    logged = false;
    res.send('wrong');
  }
});

// ─── Databases ───────────────────────────────────────────────────────────────

server.get('/databases', async (_req, res) => {
  if (!logged) return res.redirect('/auth');

  try {
    const databases = await getDatabases();
    res.render('databases.hbs', {
      server: `http://localhost:${PORT}`,
      databases,
      systemDatabases,
    });
  } catch (err) {
    res.status(500).send(err.message || 'Failed to load databases');
  }
});

// ─── Tables list for a DB ────────────────────────────────────────────────────

server.get('/:dbName/db', async (req, res) => {
  if (!logged) return res.redirect('/auth');

  const { dbName } = req.params;
  selectedDb = dbName;

  try {
    const data = await connectDb(dbName);
    const allTables = data.map((row) => row[`Tables_in_${dbName}`]);
    res.render('home.hbs', { title: dbName, dbName, allTables });
  } catch (err) {
    res.status(500).send(err.message || 'Failed to connect to database');
  }
});

// ─── Show Table ───────────────────────────────────────────────────────────────

server.get('/table/:tableName', async (req, res) => {
  if (!logged) return res.redirect('/auth');

  const { tableName } = req.params;

  try {
    const { tableSchema, isTableEmptyString } = await fetchTableInfo(tableName);
    res.render('showTable.hbs', {
      tableName,
      isTableEmptyString,
      tableSchema,
      db: selectedDb,
    });
  } catch {
    res.redirect(`/${selectedDb}/db`);
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

server.get('/logout', async (_req, res) => {
  await logout();
  logged = false;
  res.redirect('/auth');
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify a table exists in the active DB, then return its schema and
 * an empty-state string if there are no rows.
 *
 * @param {string} tableName
 * @returns {Promise<{tableSchema: Array, isTableEmptyString: string}>}
 */
async function fetchTableInfo(tableName) {
  // Confirm the table exists
  const tables = await getTables();
  const key = `Tables_in_${selectedDb}`;
  const exists = tables.some((row) => row[key] === tableName);
  if (!exists) throw new Error(`Table "${tableName}" not found`);

  const [tableData, tableSchema] = await Promise.all([
    getTableData(tableName),
    getTableSchema(tableName),
  ]);

  const isTableEmptyString = tableData.length === 0 ? 'table is empty' : '';
  return { tableSchema, isTableEmptyString };
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`MySQL UI running at http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`);
});

module.exports = { server };
