'use strict';

const express = require('express');
const router = express.Router();
const {
    getDatabases,
    deleteRow,
    searchRowByData,
    updateRowData,
    createTable,
    createDatabase,
    getTables,
    getTableData,
    getTableSchema,
    changeColumnName,
    insert,
    deleteTable,
    deleteTableData,
    updateTableName,
} = require('../dbController');

// ── Create Database ──────────────────────────────────────────────────────────
router.post('/createDatabase/:name', async (req, res) => {
    try {
        const { name } = req.params;
        await createDatabase(name);
        res.send('created');
    } catch (err) {
        res.status(500).send(err.sqlMessage || err.message || 'error');
    }
});


router.post('/createTable/:dbName', async (req, res) => {
    try {
        var { dbName } = req.params;
        var { tableName, totalColumns } = req.body;
        var sqlCreateTableString = "";
        var isSnoColumnFound = false;
        var isPrimary = false;

        tableName = tableName.trim().toUpperCase().replace(/[&\/\\#,+()$~%.'": *?<>{}]+/g, "_");

        for (let i = 1; i <= totalColumns; i++) {
            var stringColumnNameEvaluateResult = req.body[`ipt${i}`];
            var stringDataTypeEvaluateResult = req.body[`TYPE${i}`];
            var primary = false;

            if (req.body.radio == i) {
                primary = true;
                isPrimary = true;
            }

            stringColumnNameEvaluateResult = stringColumnNameEvaluateResult.trim().toUpperCase().replace(/[&\/\\#,+()$~%.'": *?<>{}]+/g, '-', "_");

            if (stringColumnNameEvaluateResult == 'SNO') {
                isSnoColumnFound = true
            }

            sqlCreateTableString += stringColumnNameEvaluateResult + " ";

            console.log("stringDataTypeEvaluateResult  ", stringDataTypeEvaluateResult);

            if (stringDataTypeEvaluateResult == "Number") {
                sqlCreateTableString += "Integer";
                if (primary)
                    sqlCreateTableString += " Primary Key "
                if (i != totalColumns)
                    sqlCreateTableString += ",";
            }
            if (stringDataTypeEvaluateResult == "Characters") {
                sqlCreateTableString += "varchar(60)";
                if (primary)
                    sqlCreateTableString += " Primary Key "
                if (i != totalColumns)
                    sqlCreateTableString += ",";
            }
            if (stringDataTypeEvaluateResult == "date") {
                sqlCreateTableString += "timestamp";
                if (primary)
                    sqlCreateTableString += " Primary Key "
                if (i != totalColumns)
                    sqlCreateTableString += ",";
            }
            if (stringDataTypeEvaluateResult == "boolean") {
                sqlCreateTableString += "boolean";
                if (primary)
                    sqlCreateTableString += " Primary Key "
                if (i != totalColumns)
                    sqlCreateTableString += ",";
            }
        }

        await createTable(tableName, sqlCreateTableString, isPrimary, isSnoColumnFound)
            .then((resp) => {
                let url = '/' + dbName + '/db';
                res.redirect(url);
            })
            .catch((e) => {
                console.log("error  : ", e);
                res.send('error occur' + e);
            })

    } catch (e) {
        console.log(`error : ${e}`);
        res.send('error occur' + e);
    }
})

router.post('/:dbName/deleteTable/:tableName', async (req, res) => {
    try {
        var { tableName, dbName } = req.params;

        console.log(`dbName : ${dbName}`)

        let url = '/' + dbName + '/db/'

        deleteTable(tableName).then((resp) => {
            setTimeout(function () {
                res.redirect(url)
            }, 5000);
        }).catch((e) => {
            res.redirect(url);
        })
    } catch (error) {
        res.redirect(url);
    }
})

router.post('/deleteRow', async (req, res) => {
    try {
        var { tableName, isprimaryKey, primarykey, entry_obj, scema } = req.body;

        let condition = "";

        if (isprimaryKey == 'true') {
            condition = primarykey + '=' + "'" + entry_obj['primarykey'] + "'"
        } else if (isprimaryKey == 'false') {
            var n = scema.length, i = 0;
            await scema.forEach(element => {
                condition += element.Field + '=' + "'" + entry_obj[element.Field] + "'"
                if (i != n - 1)
                    condition += ' AND '
                i++;
            });
        }

        deleteRow(tableName, condition)
            .then((mess) => {
                res.send(mess);
            })
            .catch((err) => {
                res.send(err)
            })
    } catch (error) {
        console.log("error @deleteRow : ", error);
        res.send(err)
    }
})

router.post('/updateRow', async (req, res) => {
    try {
        var { tableName, isprimaryKey, primarykey, updatedRow, tableScema, entry_obj } = req.body;

        let sqlUpdateRowString = ""

        tableScema.forEach((element, index) => {
            sqlUpdateRowString += element.Field + '=';
            if (element.Type == 'tinyint(1)') {
                sqlUpdateRowString += updatedRow[index];
            } else {
                sqlUpdateRowString += "'" + updatedRow[index] + "'";
            }
            if (index != tableScema.length - 1)
                sqlUpdateRowString += ',';
        });

        let condition = "";

        if (isprimaryKey == 'true') {
            condition = primarykey + '=' + "'" + entry_obj['primarykey'] + "'"
        } else if (isprimaryKey == 'false') {
            let n = tableScema.length, i = 0;
            await tableScema.forEach(element => {
                condition += element.Field + '=' + "'" + entry_obj[element.Field] + "'"
                if (i != n - 1)
                    condition += ' AND '
                i++;
            });
        }

        await updateRowData(tableName, sqlUpdateRowString, condition)
            .then((resp) => {
                res.send(resp);
            }).catch((err) => {
                console.log("error : ", err);
                res.send(err)
            })

    } catch (error) {
        res.send(error)
    }
})

router.post('/deleteRows/:tableName', async (req, res) => {
    try {
        var { tableName } = req.params;

        deleteTableData(tableName)
            .then((resp) => {
                var url = '/table/' + tableName;
                res.redirect(url);
            }).catch((e) => {
                res.redirect('/');
            })
    } catch (error) {
        res.send(error)
    }
})

router.post('/updateTableName', async (req, res) => {
    try {
        var { tableName, updatedTableName } = req.body;

        updateTableName(tableName, updatedTableName)
            .then((resp) => {
                res.send(resp);
            })
            .catch((e) => {
                res.send('error')
            })

    } catch (error) {
        res.send('error')
    }
})

router.get('/getAllTables', async (req, res) => {
    try {
        getTables()
            .then((resp) => {
                res.send(resp)
            }).catch(er => {
                res.send(er)
            })
    } catch (error) {
        res.send(error)
    }
})

router.get('/getTableSchema', async (req, res) => {
    try {
        var { tableName } = req.query;

        getTableSchema(tableName)
            .then((data) => {
                res.send(data)
            }).catch((err) => {
                res.send(500, err);
            })
    } catch (error) {
        res.send(500, error);
    }
})

router.get('/getTableData', async (req, res) => {
    try {
        var { tableName } = req.query;
        await getTableData(tableName)
            .then((data) => {
                res.send(data)
            }).catch(error => {
                res.send(error)
            })
    } catch (error) {
        res.send(error)
    }
})

router.get('/getDatabases/', async (req, res) => {
    try {
        getDatabases()
            .then((data) => {
                res.send(data)
            })
            .catch((err) => {
                console.log(err);
                res.send([])
            })
    } catch (error) {
        console.log("error :", error);
        res.send(error)
    }
})

router.post('/updateColumn', async (req, res) => {
    try {
        var { tableName, updatedColumnName, columnName } = req.body;

        changeColumnName(tableName, columnName, updatedColumnName)
            .then((resp) => {
                res.send(resp);
            }).catch((error) => {
                console.log(`error ${error}`);
                res.send(error)
            })

    } catch (error) {
        res.send(error)
    }
})

router.post('/addMultipleRows', async (req, res) => {
    try {
        var { tableName, size, data } = req.body;
        let schema = [];

        await getTableSchema(tableName).then((data) => {
            schema = data;
        }).catch((error) => {
            throw error;
        })

        let sqlString = "";

        for (let i = 0; i < size; i++) {
            schema.forEach((schemaRow, index) => {
                const fieldType = schemaRow.Type;
                let fieldData = data[i][schemaRow.Field];
                if (fieldType == 'tinyint(1)') {
                    sqlString += fieldData;
                } else {
                    sqlString += `'${fieldData}'`;
                }
                if (index != schema.length - 1)
                    sqlString += ",";
            })

            await insert(tableName, sqlString).then((data) => {

            })
                .catch((error) => {

                })
        }

        res.send("true");
    } catch (e) {
        console.log("er : ", e);
        res.send("error");
    }
})

router.post('/searchDataQuery', async (req, res) => {
    try {
        var { tableName, searchBy, searchValue } = req.body;

        searchRowByData(tableName, searchBy, searchValue).then((data) => {
            res.send(data)
        }).catch((err) => {
            console.log("er : ", err);

            throw err;
        })
    } catch (error) {
        console.log("er : ", error);
        res.send('Not Found')
    }
})




module.exports = router;