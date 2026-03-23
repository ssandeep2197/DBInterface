'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const dbEl = document.getElementById('db');
const dbName = dbEl ? dbEl.textContent.trim() : '';
const form = document.getElementById('form');
const warnEl = document.getElementById('warn');
const tableNameInput = document.getElementById('tableName');
const createBtn = document.getElementById('create_btn');
const colContainer = document.getElementById('col-container');
const totalColInput = document.getElementById('tcol');
const colCountEl = document.getElementById('i');
const panelOverlay = document.getElementById('panel-overlay');
const createPanel = document.getElementById('create-panel');
const panelCloseBtn = document.getElementById('panel-close');
const resetBtn = document.getElementById('btn-reset');

const TYPE_OPTIONS = ['Number', 'Characters', 'date', 'boolean'];

let colCount = 0;
let allTables = [];

// ── Toast helper ────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 260);
    }, 3200);
}

// ── Ajax helper ─────────────────────────────────────────────────────────────
function doAjax(url, method, data) {
    return new Promise((resolve, reject) => {
        $.ajax(url, { type: method, data }).done(resolve).fail(reject);
    });
}

// ── Panel show/hide ─────────────────────────────────────────────────────────
function openPanel() {
    panelOverlay.classList.add('open');
    createPanel.classList.add('open');
    createPanel.setAttribute('aria-hidden', 'false');
}
function closePanel() {
    panelOverlay.classList.remove('open');
    createPanel.classList.remove('open');
    createPanel.setAttribute('aria-hidden', 'true');
}

// "Add table" button — could appear twice (header btn + empty state btn)
document.querySelectorAll('#add-table').forEach((btn) => {
    btn.addEventListener('click', openPanel);
});
panelCloseBtn.addEventListener('click', closePanel);
panelOverlay.addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

// ── Add / Remove columns ─────────────────────────────────────────────────────
document.getElementById('add').addEventListener('click', () => {
    colCount++;
    updateColCount();

    const row = document.createElement('div');
    row.className = 'col-row';
    row.id = `box${colCount}`;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = `ipt${colCount}`;
    nameInput.id = `ipt${colCount}`;
    nameInput.placeholder = 'Column name';
    nameInput.required = true;
    nameInput.style.textTransform = 'uppercase';

    // Radio button for PK
    const radioWrap = document.createElement('div');
    radioWrap.style.textAlign = 'center';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'radio';
    radio.id = `radio${colCount}`;
    radio.value = colCount;
    const pkLabel = document.createElement('div');
    pkLabel.className = 'pk-label';
    pkLabel.textContent = 'PK';
    radioWrap.appendChild(radio);
    radioWrap.appendChild(pkLabel);

    const typeSelect = document.createElement('select');
    typeSelect.name = `TYPE${colCount}`;
    typeSelect.id = `TYPE${colCount}`;
    typeSelect.required = true;
    TYPE_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        typeSelect.appendChild(o);
    });

    row.appendChild(nameInput);
    row.appendChild(radioWrap);
    row.appendChild(typeSelect);
    colContainer.appendChild(row);
});

document.getElementById('del').addEventListener('click', () => {
    if (colCount > 0) {
        const row = document.getElementById(`box${colCount}`);
        if (row) row.remove();
        colCount--;
        updateColCount();
    }
    if (colCount === 0 && tableNameInput) {
        tableNameInput.value = '';
        if (warnEl) { warnEl.style.display = 'none'; }
    }
});

function updateColCount() {
    if (totalColInput) totalColInput.value = colCount;
    if (colCountEl) colCountEl.textContent = colCount;
}

// Reset
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        colContainer.innerHTML = '';
        colCount = 0;
        updateColCount();
        if (warnEl) warnEl.style.display = 'none';
    });
}

// ── Table name duplicate check ──────────────────────────────────────────────
if (form) {
    form.addEventListener('input', () => {
        const val = tableNameInput.value.trim().toUpperCase();
        const exists = allTables.some((t) => t[`Tables_in_${dbName}`] === val);
        if (exists) {
            if (warnEl) warnEl.style.display = 'block';
            if (createBtn) createBtn.disabled = true;
        } else {
            if (warnEl) warnEl.style.display = 'none';
            if (createBtn) createBtn.disabled = false;
        }
    });
}

// ── Database switcher ───────────────────────────────────────────────────────
function dbSwitch() {
    const selectBox = document.getElementById('db_list');
    const selectedValue = selectBox.options[selectBox.selectedIndex].value;
    window.location.href = `/${selectedValue}/db`;
}

// ── Init ─────────────────────────────────────────────────────────────────────
$(function () {
    // Load all tables for duplicate check
    doAjax('/api/getAllTables', 'get', { checks: 'true' })
        .then((res) => { allTables = res; })
        .catch(() => { allTables = []; });

    // Populate DB switcher
    doAjax('/api/getDatabases/', 'get', {})
        .then((databases) => {
            const current = document.getElementById('db_list').options[0].value;
            databases.forEach((db) => {
                if (db !== current) {
                    const opt = document.createElement('option');
                    opt.innerText = db;
                    opt.value = db;
                    db_list.appendChild(opt);
                }
            });
        })
        .catch(() => { });
});