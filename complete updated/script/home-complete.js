// home-complete.js (نسخه اصلاحی)

import { 
    go_users, show_new_record_window,
    onAuth, watchUserData, render_top_box, escapeHtml,
    close_new_record_window , add_record, show_modal_2,
    render_rec, go_settings, onSyncStatusChange, close_modal_2
} from './common.js';

import { render_search_recs } from './func.js';  // <-- ایمپورت تابع جستجو

import { getPersianDate } from './usefull.js';

const loader = document.querySelector(".loader");

let unsubscribeData = null;
let isInitialized = false;

async function initApp(userId) {
    if (isInitialized) return;
    isInitialized = true;

    if (loader) {
        loader.style.display = "inline-block";
    }
    
    unsubscribeData = watchUserData(async () => {
        await render_rec();
        if (loader) {
            loader.style.display = "none";
        }
    });

    const cancelIcon = document.querySelector('.buttons .cancel');
    if (cancelIcon) cancelIcon.onclick = () => close_new_record_window();

    const saveIcon = document.querySelector('.buttons .save');
    if (saveIcon) saveIcon.onclick = () => add_record();

    const plusIcon = document.querySelector('.fa-plus');
    if (plusIcon) plusIcon.onclick = () => show_new_record_window();

    const modal1Prof = document.querySelector('.modal-1 .prof');
    if (modal1Prof) modal1Prof.onclick = () => show_modal_2();

    const modal2_cancel = document.querySelector('.modal-2-cancel');
    if (modal2_cancel) modal2_cancel.onclick = () => close_modal_2();

    const searchBox = document.querySelector('.top-box .searchBox');
    
    if (searchBox) {
        searchBox.addEventListener('input', async (e) => {
            const value = e.target.value.trim();
            if (!value) {
                await render_rec();
                loader.style.display = "none";
            } else {
                await render_search_recs("home", value);  // <-- حالا معتبر است
            }
        });
    }

    const userBTN = document.querySelector('.fa-users');
    if (userBTN) userBTN.addEventListener("click", go_users);

    const gearBTN = document.querySelector('.fa-gear');
    if (gearBTN) gearBTN.addEventListener("click", go_settings);
}

onAuth(async (isLoggedIn, userId) => {
    if (isLoggedIn) {
        onSyncStatusChange(updateSyncStatusUI);
        await initApp(userId);
    } else {
        window.location.href = 'login.html';
    }
});

function updateSyncStatusUI(status) {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        statusEl.textContent = status.message;
        statusEl.className = `sync-status ${status.state}`;
    }
}

window.addEventListener('beforeunload', () => {
    if (unsubscribeData) unsubscribeData();
});



onSyncStatusChange(status => {
    const el = document.getElementById('sync-status');
    if (el) {
        el.textContent = status.message;
        el.className = `sync-status ${status.state}`;
    }
});