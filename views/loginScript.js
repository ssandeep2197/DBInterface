'use strict';

const form = document.getElementById('form');
const passEl = document.getElementById('pass');
const warnEl = document.getElementById('warn');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    warnEl.classList.remove('visible');

    $.ajax('/auth', {
        type: 'post',
        data: { password: passEl.value },
    })
        .done((response) => {
            if (response === 'logged') {
                $('#form').off('submit');
                form.submit();
            } else {
                passEl.style.boxShadow = '0 0 0 2px var(--danger)';
                warnEl.classList.add('visible');
                passEl.focus();
            }
        })
        .fail(() => {
            warnEl.textContent = 'Connection error — please try again.';
            warnEl.classList.add('visible');
        });
});

// Clear error on new input
passEl.addEventListener('input', () => {
    passEl.style.boxShadow = '';
    warnEl.classList.remove('visible');
});
