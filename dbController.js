'use strict';

const mysql = require('mysql2');

let connection = null;
let logged = false;
const systemDatabases = ['information_schema', 'sys', 'performance_schema', 'mysql'];
let connect = null;

/**
 * Authenticate against MySQL with the given password.
 * @param {string} password
 * @returns {Promise<string>}
 */
function auth(password) {
  return new Promise((resolve, reject) => {
    connection = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password,
    });

    connection.promise()
      .query('SELECT 1')
      .then(() => {
        logged = true;
        resolve('success');
      })
      .catch((err) => {
        logged = false;
        connection = null;
        reject(err);
      });
  });
}

/**
 * Disconnect from MySQL and reset state.
 */
function logout() {
  return new Promise((resolve) => {
    if (connection) {
      connection.destroy();
    }
    connection = null;
    connect = null;
    logged = false;
    resolve();
  });
}

/**
 * Switch to the specified database and return its tables.
 * @param {string} db
 * @returns {Promise<Array>}
 */
function connectDb(db) {
  connect = connection;
  return new Promise((resolve, reject) => {
    connect.query(`USE \`${db}\``, (err) => {
      if (err) return reject(err);
      connect.query('SHOW TABLES', (err2, result) => {
        if (err2) return reject(err2);
        resolve(result);
      });
    });
  });
}

/**
 * List all non-system databases.
 * @returns {Promise<string[]>}
 */
function getDatabases() {
  if (!connection || !logged) {
    return Promise.reject(new Error('Not connected'));
  }
  return new Promise((resolve, reject) => {
    connection.query('SHOW DATABASES', (err, result) => {
      if (err) return reject(err);
      const dbs = result
        .map((row) => row.Database)
        .filter((name) => !systemDatabases.includes(name));
      resolve(dbs);
    });
  });
}

/**
 * Create a new database.
 * @param {string} database
 * @returns {Promise<string>}
 */
function createDatabase(database) {
  if (!connection || !logged) {
    return Promise.reject(new Error('Not connected'));
  }
  return new Promise((resolve, reject) => {
    connection.query(`CREATE DATABASE \`${database}\``, (err) => {
      if (err) return reject(err);
      resolve('created database');
    });
  });
}

/**
 * Create a new table in the active database.
 * @param {string} tableName
 * @param {string} sqlString  - comma-separated column definitions
 * @param {boolean} primary   - true if a primary key column is included
 * @param {boolean} sno_found - true if an SNO column is already present
 * @returns {Promise<string>}
 */
function createTable(tableName, sqlString, primary, sno_found) {
  let columnDefs = '';
  if (!primary && !sno_found) {
    columnDefs = 'SNO INTEGER AUTO_INCREMENT PRIMARY KEY,';
  }
  columnDefs += sqlString;

  const sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs})`;

  return new Promise((resolve, reject) => {
    connect.query(sql, (err) => {
      if (err) return reject(err);
      resolve(`Table "${tableName}" created successfully`);
    });
  });
}

/**
 * List all tables in the active database.
 * @returns {Promise<Array>}
 */
function getTables() {
  return new Promise((resolve, reject) => {
    connect.query('SHOW TABLES', (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

/**
 * Describe a table's columns.
 * @param {string} tableName
 * @returns {Promise<Array>}
 */
function getTableSchema(tableName) {
  return new Promise((resolve, reject) => {
    connect.query(`DESCRIBE \`${tableName}\``, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

/**
 * Select all rows from a table.
 * @param {string} tableName
 * @returns {Promise<Array>}
 */
function getTableData(tableName) {
  return new Promise((resolve, reject) => {
    connect.query(`SELECT * FROM \`${tableName}\``, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

/**
 * Drop a table.
 * @param {string} tableName
 * @returns {Promise<string>}
 */
function deleteTable(tableName) {
  return new Promise((resolve, reject) => {
    connect.query(`DROP TABLE \`${tableName}\``, (err) => {
      if (err) return reject(err);
      resolve(`Table "${tableName}" deleted`);
    });
  });
}

/**
 * Delete all rows from a table (truncate-style).
 * @param {string} tableName
 * @returns {Promise<Object>}
 */
function deleteTableData(tableName) {
  return new Promise((resolve, reject) => {
    connect.query(`DELETE FROM \`${tableName}\``, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

/**
 * Rename a column.
 * @param {string} table
 * @param {string} oldCol
 * @param {string} newCol
 * @returns {Promise<string>}
 */
function changeColumnName(table, oldCol, newCol) {
  return new Promise((resolve, reject) => {
    connect.query(
      `ALTER TABLE \`${table}\` RENAME COLUMN \`${oldCol}\` TO \`${newCol}\``,
      (err) => {
        if (err) return reject(err);
        resolve(`Column "${oldCol}" renamed to "${newCol}" in table "${table}"`);
      }
    );
  });
}

/**
 * Drop a table (alias kept for API compatibility).
 * @param {string} tableName
 * @returns {Promise<Object>}
 */
function drop(tableName) {
  return new Promise((resolve, reject) => {
    connect.query(`DROP TABLE \`${tableName}\``, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

/**
 * Rename a table.
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<string>}
 */
function updateTableName(oldName, newName) {
  return new Promise((resolve, reject) => {
    connect.query(
      `ALTER TABLE \`${oldName}\` RENAME TO \`${newName}\``,
      (err) => {
        if (err) return reject(err);
        resolve(`Table renamed to "${newName}"`);
      }
    );
  });
}

/**
 * Insert a row using a raw value string.
 * @param {string} table
 * @param {string} sqlString - comma-separated values
 * @returns {Promise<string>}
 */
function insert(table, sqlString) {
  return new Promise((resolve, reject) => {
    connect.query(`INSERT INTO \`${table}\` VALUES (${sqlString})`, (err) => {
      if (err) return reject(err);
      resolve('Data inserted successfully');
    });
  });
}

/**
 * Delete a row matching a WHERE condition.
 * @param {string} table
 * @param {string} condition - raw SQL condition string
 * @returns {Promise<string>}
 */
function deleteRow(table, condition) {
  return new Promise((resolve, reject) => {
    connect.query(`DELETE FROM \`${table}\` WHERE ${condition}`, (err) => {
      if (err) return reject(err);
      resolve('deleted');
    });
  });
}

/**
 * Update a row.
 * @param {string} table
 * @param {string} updateString - SET clause
 * @param {string} condition    - WHERE clause
 * @returns {Promise<string>}
 */
function updateRowData(table, updateString, condition) {
  return new Promise((resolve, reject) => {
    connect.query(
      `UPDATE \`${table}\` SET ${updateString} WHERE ${condition}`,
      (err) => {
        if (err) return reject(err);
        resolve('deleted');
      }
    );
  });
}

/**
 * Search rows by a LIKE pattern on a given column.
 * @param {string} table
 * @param {string} searchBy - column name
 * @param {string} search   - search term
 * @returns {Promise<Array>}
 */
function searchRowByData(table, searchBy, search) {
  const pattern = `${search}%`;
  return new Promise((resolve, reject) => {
    connect.query(
      `SELECT * FROM \`${table}\` WHERE \`${searchBy}\` LIKE ?`,
      [pattern],
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

module.exports = {
  auth,
  logout,
  connectDb,
  getDatabases,
  createDatabase,
  createTable,
  getTables,
  getTableSchema,
  getTableData,
  deleteTable,
  deleteTableData,
  changeColumnName,
  drop,
  updateTableName,
  insert,
  deleteRow,
  updateRowData,
  searchRowByData,
  mysql,
};