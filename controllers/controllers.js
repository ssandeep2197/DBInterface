const { get_DataBases, auth, delete_entry, search_data, connection, update_data, db_connect, create, gettable, select, scema, changeColumnName, insert, deletetable, dropalldata, changeName, logout } = require('../db_helpers')
const routes=require("../REST/api");

const login = asyncHandler(async (req, res) => {

});

const auth = asyncHandler(async (req, res) => {

    if (logged) {

    } else {
        let file = __dirname + '/views/auth/login.html';
        logged = false

        await auth('xxx')
            .then((d) => {
            })
            .catch((e) => {
            })

        res.sendFile(file)
    }

});

const databases = asyncHandler(async (req, res) => {
    if (!logged)
    res.redirect('/auth')
else {
    const system_databases = ["information_schema", "sys", "performance_schema", "mysql"];
    let check = req.query.checks;
    get_DataBases()
        .then((data) => {
            if (check)
                res.send(data)
            else
                res.render('databases.hbs', { server: "http://localhost:" + port, databases: data, sys_databases: system_databases });
        })
        .catch((err) => {
            console.log(err);
        })
}
});

const tabless = asyncHandler(async (req, res) => {
 
    let db = req.query.db;
    res.redirect('/db')
});

const getTablesByDb = asyncHandler(async (req, res) => {
    if (!logged) {
        res.redirect('/auth')
        return;
    } else {
        var db_name = req.params.name;
        selected_db = db_name;
        let check = req.query.checks;
        await db_connect(db_name).then((data) => {
            var str = 'Tables_in_' + db_name
            var all_tables = [];
            var url = [];
            data.forEach(element => {
                all_tables.push(element[str]);
                var str1 = '/' + db_name + '/table/' + element;
                url.push(str1)
            });
            urls = url;
            if (check)
                res.send(data)
            else
                res.render('home.hbs', { title: 'hbs', db_name: db_name, all_tables: all_tables })
            return;
        }).catch((err) => {
            res.send(err)
            return;
        })
    }
});


const logout = asyncHandler(async (req, res) => {
    await logout()
    logged = false;
    res.redirect('/auth')
});

 
