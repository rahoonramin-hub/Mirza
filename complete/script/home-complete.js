// home-complete.js (نسخه اصلاحی)

import { 
    go_users, show_new_record_window,
     onAuth, watchUserData, render_top_box, escapeHtml,
      close_new_record_window , add_record, show_modal_2,
       render_rec, go_settings
    } from './common.js';

let unsubscribeData = null;
let isInitialized = false;

// تابع کمکی برای رندر تراکنش‌های امروز یک کاربر خاص


// تابع مقداردهی اولیه صفحه
async function initApp(userId) {
    if (isInitialized) return;
    isInitialized = true;

    // برپایی شنونده تغییرات داده کاربر
    unsubscribeData = watchUserData(async () => {
        await render_rec();
    });

    // تنظیم دکمه‌ها و جستجو
    const cancelIcon = document.querySelector('.buttons .cancel');
    if (cancelIcon) cancelIcon.onclick = () => close_new_record_window();

    const saveIcon = document.querySelector('.buttons .save');
    if (saveIcon) saveIcon.onclick = () => add_record();

    const plusIcon = document.querySelector('.fa-plus');
    if (plusIcon) plusIcon.onclick = () => show_new_record_window();

    const modal1Prof = document.querySelector('.modal-1 .prof');
    if (modal1Prof) modal1Prof.onclick = () => show_modal_2();


    const searchBox = document.querySelector('.top-box .searchBox');
if (searchBox) {
    searchBox.addEventListener('input', async (e) => {
        const value = e.target.value.trim();
        if (!value) {
            await render_rec(); // تازه‌سازی کل تراکنش‌های امروز
        } else {
            await render_search_recs("home", value);
        }
    });
}

    const userBTN = document.querySelector('.fa-users');
    if (userBTN) userBTN.addEventListener("click", go_users);

    const gearBTN = document.querySelector('.fa-gear');
    if (gearBTN) gearBTN.addEventListener("click", go_settings);

}

// احراز هویت
onAuth(async (isLoggedIn, userId) => {
    if (isLoggedIn) {
        await initApp(userId);
    } else {
        window.location.href = 'login.html';
    }
});

// پاکسازی شنونده هنگام خروج از صفحه
window.addEventListener('beforeunload', () => {
    if (unsubscribeData) unsubscribeData();
});

// برای تاریخ شمسی (اگر در usefull.js تعریف نشده، اینجا تعریف کن)
function getPersianDate(date = new Date()) {
    return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}