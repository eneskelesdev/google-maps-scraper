(() => {
    'use strict';
    const form = document.getElementById('scrape-form');
    const submit = document.getElementById('start-search');
    const submitLabel = document.getElementById('submit-label');
    const formError = document.getElementById('error-container');
    const actionError = document.getElementById('action-error');
    const toast = document.getElementById('toast');
    const knownStatuses = new Map();
    let toastTimeout;
    let lastSync = 0;
    let modalTrigger;

    function showToast(message) {
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.hidden = false;
        toastTimeout = setTimeout(() => { toast.hidden = true; }, 6000);
    }

    function setConnection(connected) {
        document.body.classList.toggle('connection-stale', !connected);
        document.getElementById('connection-error').hidden = connected;
        document.getElementById('sync-status').classList.toggle('stale', !connected);
        document.getElementById('sync-label').textContent = connected ? 'Live updates' : 'Reconnecting';
    }

    function updateJobs() {
        lastSync = Date.now();
        setConnection(true);
        document.querySelectorAll('#job-tbody tr').forEach(row => {
            const id = row.querySelector('.job-id')?.textContent.trim();
            const status = row.querySelector('.status-indicator');
            if (!id || !status) return;
            const state = ['working', 'pending', 'ok', 'failed'].find(value => status.classList.contains(`status-${value}`));
            const previous = knownStatuses.get(id);
            const name = row.querySelector('.job-name').textContent;
            if ((previous === 'working' || previous === 'pending') && state === 'ok') showToast(`${name} is complete. Your CSV is ready.`);
            if ((previous === 'working' || previous === 'pending') && state === 'failed') showToast(`${name} failed. Check server logs for details.`);
            knownStatuses.set(id, state);
        });
    }

    document.body.addEventListener('htmx:beforeRequest', event => {
        if (event.detail.elt === form) {
            formError.textContent = '';
            submit.disabled = true;
            submit.setAttribute('aria-busy', 'true');
            submitLabel.textContent = 'Adding to queue…';
        } else if (event.detail.elt.closest?.('.row-actions')) {
            actionError.textContent = '';
        }
    });

    document.body.addEventListener('htmx:afterRequest', event => {
        const { elt, successful, xhr } = event.detail;
        if (elt === form) {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
            submitLabel.textContent = 'Start search';
            if (successful) showToast('Search added to the queue. Follow its progress here.');
            else {
                formError.textContent = xhr.status ? xhr.responseText.trim() : 'Could not reach the server. Check your connection and try again.';
                formError.focus();
            }
        } else if (!successful && elt.id === 'job-tbody') {
            setConnection(false);
        } else if (!successful && elt.closest?.('.row-actions')) {
            actionError.textContent = 'The action could not be completed. Please try again.';
        }
    });

    document.body.addEventListener('htmx:afterSettle', event => {
        if (event.detail.target?.id === 'job-tbody') updateJobs();
        if (event.detail.target?.id === 'map-modal-container') {
            const modal = document.getElementById('map-modal');
            if (modal) {
                modalTrigger = document.activeElement;
                document.body.style.overflow = 'hidden';
                modal.querySelector('.map-modal-close').focus();
            }
        }
    });

    document.addEventListener('keydown', event => {
        const modal = document.getElementById('map-modal');
        if (!modal) return;
        if (event.key === 'Escape') window.closeJobMap?.();
        if (event.key === 'Tab') {
            const elements = [...modal.querySelectorAll('button, a[href], input, [tabindex]')].filter(element => element.tabIndex >= 0 && element.getClientRects().length);
            const first = elements[0];
            const last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    });

    new MutationObserver(() => {
        if (!document.getElementById('map-modal')) {
            document.body.style.overflow = '';
            if (modalTrigger?.isConnected) modalTrigger.focus();
            modalTrigger = null;
        }
    }).observe(document.getElementById('map-modal-container'), { childList: true });

    // A stale connection must not look like confirmed, live scraping activity.
    setInterval(() => { if (!lastSync || Date.now() - lastSync > 15000) setConnection(false); }, 5000);
    window.addEventListener('offline', () => setConnection(false));
})();
