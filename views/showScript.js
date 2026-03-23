'use strict';

// ── DOM Refs ─────────────────────────────────────────────────────────────────
const titleEl = document.getElementById('title');
const dbList = document.getElementById('db_list');
const table1 = document.getElementById('table1');
const updatebox = document.getElementById('updatebox');
const editBox = document.getElementById('box');
const searchInput = document.getElementById('search_data');
const selectEl = document.getElementById('select');
const searchBtn = document.getElementById('search-icon');
const clearBtn = document.getElementById('cross-icon');
const foundWarn = document.getElementById('found');
const alertEl = document.getElementById('alert-box');
const alertText = document.getElementById('alert-msg-text');
const alertClose = document.getElementById('alert-close-btn');
const delForm = document.getElementById('del-form');
const cnlForm = document.getElementById('cnl-form');

const serverUrl = localStorage.getItem('server_url') || '';
const prevTableName = titleEl.value;
let currentName = prevTableName;
let scema = [];    // schema array
let sc = [];    // alias for show3()
let selectedEntry = null;
let entryObj = null;
let isPrimaryKey = false;
let primaryKey = '';
let inputCount = 0;
let selectOldCol = '';

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 260); }, 3200);
}

// ── Alert bar ─────────────────────────────────────────────────────────────────
function showAlert(msg, type = 'error') {
    alertText.textContent = msg;
    alertEl.style.display = 'block';
}
function dismissAlert() {
    alertEl.style.display = 'none';
}
alertClose.addEventListener('click', dismissAlert);

// ── Confirm dialog ────────────────────────────────────────────────────────────
function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-message').textContent = message;
        overlay.classList.add('open');
        const yes = document.getElementById('confirm-yes');
        const no = document.getElementById('confirm-no');
        const cleanup = () => { overlay.classList.remove('open'); yes.onclick = null; no.onclick = null; };
        yes.onclick = () => { cleanup(); resolve(true); };
        no.onclick = () => { cleanup(); resolve(false); };
    });
}

// ── Ajax helper ───────────────────────────────────────────────────────────────
function doAjax(url, method, data) {
    return new Promise((resolve, reject) => {
        $.ajax(url, { type: method, data }).done(resolve).fail(reject);
    });
}

// ── Validate insert input ─────────────────────────────────────────────────────
function validateInput(el) {
    if (!el.value.trim()) {
        el.classList.add('err');
    } else {
        el.classList.remove('err');
    }
}

// ── Toggle boolean field ──────────────────────────────────────────────────────
function unChecked(_e, el) {
    el.value = el.value === 'true' ? 'false' : 'true';
}

// ── Hover column header ───────────────────────────────────────────────────────
function hoverCol() {
    document.getElementById('col-edit').style.display = 'inline-flex';
}

// ── Click column header ───────────────────────────────────────────────────────
function colums(id) {
    selectOldCol = id;
    document.getElementById('col-edit').style.display = 'inline-flex';
}

// ── Insert new row ────────────────────────────────────────────────────────────
document.getElementById('insert').onclick = function () {
    const headers = document.getElementsByClassName('theader');
    const tr = document.createElement('tr');
    for (let i = 0; i < headers.length; i++) {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        let type = scema[i].Type;
        if (type === 'timestamp') { type = 'datetime-local'; }
        else if (type === 'int') { type = 'number'; }
        else if (type === 'tinyint(1)') {
            type = 'checkbox';
            inp.setAttribute('onClick', 'unChecked(event,this)');
            inp.value = 'false';
        } else { type = 'text'; }
        inp.placeholder = `Enter ${headers[i].innerText}`;
        inp.className = 'insert-input insert_input';
        inp.setAttribute('type', type);
        inputCount++;
        inp.id = `ipt${inputCount}`;
        inp.setAttribute('oninput', `validateInput(this)`);
        inp.required = true;
        td.style.padding = '4px';
        td.appendChild(inp);
        tr.appendChild(td);
    }
    table1.appendChild(tr);
    tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ── Save inserted rows ────────────────────────────────────────────────────────
document.getElementById('add_data').onclick = async function () {
    const n = inputCount / scema.length;
    const rows = [];
    let hasErr = false;
    let base = 1;
    for (let j = 0; j < n; j++) {
        const obj = {};
        for (let k = 0; k < scema.length; k++) {
            const el = document.getElementById(`ipt${base + k}`);
            if (!el) continue;
            const val = el.value.trim();
            if (!val) { el.classList.add('err'); hasErr = true; }
            else { el.classList.remove('err'); obj[scema[k].Field] = val; }
        }
        base += scema.length;
        rows.push(obj);
    }
    if (hasErr) return;

    try {
        const res = await doAjax('/api/addMultipleRows', 'post', {
            tableName: currentName, data: rows, size: n,
        });
        if (res === 'true') {
            showToast('Rows added successfully!', 'success');
            setTimeout(() => window.location.reload(), 800);
        } else {
            showAlert('Primary key conflict — some rows were not inserted.');
        }
    } catch { showAlert('Failed to save rows. Please try again.'); }
};

// ── DB switcher ───────────────────────────────────────────────────────────────
function dbSwitch() {
    const val = dbList.options[dbList.selectedIndex].value;
    window.location.href = `${serverUrl}/${val}/db`;
}

// ── Load & render table data ──────────────────────────────────────────────────
async function show3() {
    table1.style.display = 'block';
    table1.innerHTML = '';
    foundWarn.style.display = 'none';

    try {
        const schema = await doAjax('/api/getTableSchema', 'get', { tableName: currentName });
        scema = schema;
        sc = schema;

        // Reset search column selector
        selectEl.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '1'; defaultOpt.textContent = 'Column…'; defaultOpt.selected = true;
        selectEl.appendChild(defaultOpt);

        // Build header rows
        const trType = document.createElement('tr');
        trType.classList.add('type-row');
        trType.id = 'data_type';
        const trHead = document.createElement('tr');

        schema.forEach((col) => {
            const opt = document.createElement('option');
            opt.value = col.Field; opt.textContent = col.Field;
            selectEl.appendChild(opt);

            const thType = document.createElement('th');
            thType.textContent = col.Type;
            trType.appendChild(thType);

            const th = document.createElement('th');
            th.className = 'theader';
            th.textContent = col.Field;
            if (col.Key === 'PRI') {
                isPrimaryKey = true; primaryKey = col.Field;
                th.classList.add('pk');
            }
            trHead.appendChild(th);
        });

        table1.appendChild(trType);
        table1.appendChild(trHead);
    } catch {
        window.location.href = `${serverUrl}/auth/`;
        return;
    }

    try {
        const rows = await doAjax('/api/getTableData', 'get', { tableName: currentName });
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            const subdata = JSON.stringify(row);
            tr.setAttribute('onclick', `editRow(${subdata})`);
            sc.forEach((col) => {
                const td = document.createElement('td');
                td.textContent = col.Type === 'timestamp' ? fmtDateTime(row[col.Field]) : row[col.Field];
                tr.appendChild(td);
            });
            table1.appendChild(tr);
        });
    } catch {
        window.location.href = `${serverUrl}/auth/`;
    }
}

function fmtDateTime(obj) {
    if (!obj) return '';
    const d = new Date(obj);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${d.toLocaleTimeString()}`;
}

// ── Row Edit Modal ────────────────────────────────────────────────────────────
function editRow(arg) {
    selectedEntry = arg;
    entryObj = isPrimaryKey ? { primarykey: arg[primaryKey] } : arg;
    updatebox.classList.add('open');
    editBox.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'row-header';
    header.textContent = 'Field values';
    editBox.appendChild(header);

    scema.forEach((col, i) => {
        const row = document.createElement('div');
        row.className = 'data-row';

        const name = document.createElement('div');
        name.className = 'field-name';
        name.textContent = col.Field;

        const sep = document.createElement('div');
        sep.className = 'field-sep';
        sep.textContent = ':';

        const inp = document.createElement('input');
        inp.className = 'field-value';
        inp.id = `upd_ipt${i + 1}`;

        let type = col.Type;
        if (type === 'timestamp') {
            inp.type = 'datetime-local';
            inp.value = fmtDateTime(arg[col.Field]);
        } else if (type === 'int') {
            inp.type = 'number';
            inp.value = arg[col.Field];
        } else if (type === 'tinyint(1)') {
            inp.type = 'checkbox';
            inp.setAttribute('onClick', 'unChecked(event,this)');
            inp.checked = arg[col.Field] == 1;
            inp.value = arg[col.Field] == 1 ? 'true' : 'false';
        } else {
            inp.type = 'text';
            inp.value = arg[col.Field];
        }

        row.appendChild(name);
        row.appendChild(sep);
        row.appendChild(inp);
        editBox.appendChild(row);
    });
}

function cancelEdit() {
    updatebox.classList.remove('open');
}

// ── Update row ────────────────────────────────────────────────────────────────
async function update() {
    const updatedRow = scema.map((_, i) => document.getElementById(`upd_ipt${i + 1}`).value);

    try {
        const res = await doAjax(`${serverUrl}/api/updateRow`, 'post', {
            tableName: currentName, isprimaryKey: isPrimaryKey, primarykey: primaryKey,
            updatedRow, tableScema: scema, entry_obj: entryObj,
        });
        updatebox.classList.remove('open');
        if (res === 'deleted') {
            showToast('Row updated successfully!', 'success');
            show3();
        } else {
            showAlert(res.sqlMessage || 'Update failed. Please try again.');
        }
    } catch { showAlert('Network error. Please try again.'); }
}

// ── Delete row ────────────────────────────────────────────────────────────────
async function delete_entry() {
    const ok = await showConfirm('Are you sure you want to delete this row?');
    if (!ok) return;
    try {
        const res = await doAjax(`${serverUrl}/api/deleteRow`, 'post', {
            tableName: currentName, isprimaryKey: isPrimaryKey, primarykey: primaryKey,
            entry_obj: entryObj, scema,
        });
        updatebox.classList.remove('open');
        if (res === 'deleted') {
            showToast('Row deleted.', 'success');
            show3();
        } else {
            showAlert(res.sqlMessage || 'Delete failed.');
        }
    } catch { showAlert('Network error.'); }
}

// ── Copy JSON ─────────────────────────────────────────────────────────────────
function copyEntry() {
    navigator.clipboard.writeText(JSON.stringify(selectedEntry))
        .then(() => showToast('Copied to clipboard!', 'success'));
}

// ── Rename table ──────────────────────────────────────────────────────────────
titleEl.addEventListener('mouseover', () => {
    document.getElementById('change-btn').style.display = 'inline-flex';
});
window.addEventListener('click', (e) => {
    if (!e.target.closest('.table-heading')) {
        document.getElementById('change-btn').style.display = 'none';
    }
});
document.getElementById('change-btn').addEventListener('click', async () => {
    const newName = titleEl.value.trim();
    if (!newName || newName === currentName) {
        showAlert('Enter a different table name.'); return;
    }
    try {
        const tables = await doAjax('/api/getAllTables', 'get', {});
        const exists = tables.some((t) => Object.values(t)[0] === newName);
        if (exists) { showAlert('A table with that name already exists.'); return; }
        const res = await doAjax('/api/updateTableName', 'POST', { tableName: currentName, updatedTableName: newName });
        if (res !== 'error') {
            showToast('Table renamed!', 'success');
            currentName = newName;
            setTimeout(() => window.location.href = `${serverUrl}/table/${newName}/`, 1000);
        } else {
            showAlert('Rename failed. Please try again.');
        }
    } catch { showAlert('Network error.'); }
});

// ── Rename column ─────────────────────────────────────────────────────────────
document.getElementById('col-edit').addEventListener('click', async (e) => {
    e.stopPropagation();
    const newCol = document.getElementById(selectOldCol)?.value.trim();
    if (!newCol || newCol === selectOldCol) {
        showAlert('Enter a different column name.'); return;
    }
    try {
        const schema = await doAjax('/api/getTableSchema', 'get', { tableName: currentName });
        if (schema.some((c) => c.Field === newCol)) {
            showAlert('Column name already exists.'); return;
        }
        const res = await doAjax('/api/updateColumn', 'POST', {
            tableName: currentName, columnName: selectOldCol, updatedColumnName: newCol,
        });
        if (res !== 'error') {
            showToast('Column renamed!', 'success');
            setTimeout(() => window.location.href = `${serverUrl}/table/${currentName}/`, 1000);
        } else {
            showAlert('Column rename failed.');
        }
    } catch { showAlert('Network error.'); }
});

// ── Search ────────────────────────────────────────────────────────────────────
searchBtn.addEventListener('click', () => {
    const col = selectEl.value;
    const search = searchInput.value.trim();
    if (col === '1') {
        selectEl.style.borderColor = 'var(--danger)';
        return;
    }
    selectEl.style.borderColor = '';
    doAjax('/api/searchDataQuery', 'POST', {
        tableName: currentName, searchBy: col, searchValue: search,
    }).then((res) => {
        if (res === 'Not Found') {
            foundWarn.style.display = 'block';
        } else {
            foundWarn.style.display = 'none';
            renderRows(res);
        }
        searchBtn.style.display = 'none';
        clearBtn.style.display = 'inline-flex';
    }).catch(() => showAlert('Search failed.'));
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    selectEl.value = '1';
    foundWarn.style.display = 'none';
    clearBtn.style.display = 'none';
    searchBtn.style.display = 'inline-flex';
    show3();
});

searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'inline-flex' : 'none';
    searchBtn.style.display = 'inline-flex';
});

selectEl.addEventListener('change', () => {
    const col = scema.find((c) => c.Field === selectEl.value);
    if (!col) return;
    if (col.Type.includes('int')) searchInput.type = 'number';
    else if (col.Type === 'timestamp') searchInput.type = 'date';
    else searchInput.type = 'text';
    searchInput.value = '';
});

function renderRows(data) {
    // Rebuild table preserving the existing header rows
    const headerRows = Array.from(table1.querySelectorAll('tr')).slice(0, 2);
    table1.innerHTML = '';
    headerRows.forEach((r) => table1.appendChild(r));
    if (!data.length) { foundWarn.style.display = 'block'; return; }
    data.forEach((row) => {
        const tr = document.createElement('tr');
        const subdata = JSON.stringify(row);
        tr.setAttribute('onclick', `editRow(${subdata})`);
        sc.forEach((col) => {
            const td = document.createElement('td');
            td.textContent = row[col.Field];
            tr.appendChild(td);
        });
        table1.appendChild(tr);
    });
}

// ── Form confirmations ────────────────────────────────────────────────────────
delForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await showConfirm('This will delete ALL data in the table. Are you sure?');
    if (ok) {
        showToast('Table data cleared.', 'success');
        setTimeout(() => delForm.submit(), 500);
    }
});

cnlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await showConfirm(`Delete table "${currentName}"? This cannot be undone.`);
    if (ok) {
        showToast(`Table "${currentName}" deleted.`, 'success');
        setTimeout(() => cnlForm.submit(), 500);
    }
});

// ── Export PDF ────────────────────────────────────────────────────────────────
document.getElementById('btnexport').addEventListener('click', () => {
    html2canvas(table1, {
        onrendered(canvas) {
            pdfMake.createPdf({ content: [{ image: canvas.toDataURL(), width: 500 }] })
                .download(currentName);
        },
    });
});

// ── Draggable modal ───────────────────────────────────────────────────────────
const dragHandle = document.getElementById('drag');
const modalEl = document.querySelector('.wrapper');

dragHandle.addEventListener('mousedown', () => {
    dragHandle.classList.add('active');
    dragHandle.addEventListener('mousemove', onDrag);
});
document.addEventListener('mouseup', () => {
    dragHandle.classList.remove('active');
    dragHandle.removeEventListener('mousemove', onDrag);
});
function onDrag({ movementX, movementY }) {
    const s = window.getComputedStyle(modalEl);
    const pos = modalEl.getBoundingClientRect();
    modalEl.style.position = 'fixed';
    modalEl.style.margin = '0';
    modalEl.style.left = `${pos.left + movementX}px`;
    modalEl.style.top = `${pos.top + movementY}px`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
$(function () {
    show3();

    // Size column header inputs to text width
    const cols = document.getElementsByClassName('table-entry');
    for (const col of cols) {
        col.style.width = `${col.value.length * 11 + 20}px`;
    }

    // Populate DB switcher
    doAjax('/api/getDatabases/', 'get', {}).then((dbs) => {
        const current = dbList.options[0].value;
        dbs.forEach((db) => {
            if (db !== current) {
                const opt = document.createElement('option');
                opt.value = db; opt.textContent = db;
                dbList.appendChild(opt);
            }
        });
    }).catch(() => { });
});