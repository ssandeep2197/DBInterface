'use strict';

// Store server URL for SPA-style navigation
const serverUrl = document.getElementById('server_url').innerText.trim();
window.localStorage.clear();
localStorage.setItem('server_url', serverUrl);

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

// ── Create Database Modal ───────────────────────────────────────────────────
const modal = document.getElementById('create-db-modal');
const nameInput = document.getElementById('new-db-name');
const errorMsg = document.getElementById('create-db-error');

function openModal() {
    modal.classList.add('open');
    nameInput.value = '';
    errorMsg.style.display = 'none';
    setTimeout(() => nameInput.focus(), 60);
}
function closeModal() { modal.classList.remove('open'); }

document.getElementById('create-db-btn').addEventListener('click', openModal);
const altBtn = document.getElementById('create-db-btn-2');
if (altBtn) altBtn.addEventListener('click', openModal);

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

document.getElementById('modal-create-btn').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
        errorMsg.textContent = 'Please enter a database name.';
        errorMsg.style.display = 'block';
        return;
    }
    if (!/^[\w]+$/.test(name)) {
        errorMsg.textContent = 'Only letters, numbers, and underscores are allowed.';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`/api/createDatabase/${encodeURIComponent(name)}`, { method: 'POST' });
        const text = await res.text();
        if (res.ok && text !== 'error') {
            closeModal();
            showToast(`Database "${name}" created!`, 'success');
            setTimeout(() => window.location.reload(), 900);
        } else {
            errorMsg.textContent = text || 'Failed to create database. It may already exist.';
            errorMsg.style.display = 'block';
        }
    } catch {
        errorMsg.textContent = 'Network error — please try again.';
        errorMsg.style.display = 'block';
    }
});