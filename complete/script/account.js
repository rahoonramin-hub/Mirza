// account.js (نسخه اصلاحی)

import {
     onAuth, watchUserData,
      render_top_box, escapeHtml,
       show_new_record_window, go_users,
        go_home, close_new_record_window,
        add_record, show_modal_2 , go_settings
        } from './common.js';
import {render_search_account_transactions} from './func.js';


let unsubscribeData = null;
let currentDisplayUserId = null;

function getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('userId');
}

export async function renderAccountTransactions(appData) {
    const userId = currentDisplayUserId || user.user_id || user.id;
    console.log(userId);
    if (!userId) return;

    const user = appData.customers.find(u => u.id == userId);
    if (!user) {
        alert('کاربر یافت نشد');
        window.location.href = 'users-page.html';
        return;
    }

    // نمایش پروفایل و نام در top-box
    const profImg = document.querySelector('.top-box .prof-wraper img');
    if (profImg) profImg.src = user.prof || 'prof/img.JPG';

    const nameElem = document.querySelector('.top-box .name-and-info .name');
    if (nameElem) nameElem.textContent = user.name;

    // رندر تراکنش‌ها
    const container = document.querySelector('.record-father');
    if (!container) return;
    container.innerHTML = '';

    let total_currencies = {};
    user.cash.forEach(trans => {
        const amt = Number(trans.amount);
        total_currencies[trans.currency] = (total_currencies[trans.currency] || 0) + amt;

        const recordDiv = document.createElement('div');
        recordDiv.className = 'record';
        recordDiv.innerHTML = `
            <div class="prof-wraper">
                <img class="prof" src="${user.prof || 'prof/img.JPG'}">
            </div>
            <div class="name-and-description">
                <p class="name">${escapeHtml(user.name)}</p>
                <p class="description">${escapeHtml(trans.description || '')}</p>
            </div>
            <div class="price-content">
                <p class="amount">${trans.amount}</p>
                <p class="total-currency ${trans.currency}">${trans.currency}</p>
                <p class="state">${trans.state === 'برد' ? 'برداشت' : 'رسید'}</p>
            </div>
        `;

        recordDiv.addEventListener('contextmenu', async (event) => {
            event.preventDefault();
            await right_click(event.clientX, event.clientY, user, trans, recordDiv);
        });

        let lastTap = 0;
        recordDiv.addEventListener('touchend', async (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                clearTimeout(tapTimeout);
                const touch = e.changedTouches[0];
                await right_click(touch.clientX, touch.clientY, user, trans, recordDiv);
            } else {
                tapTimeout = setTimeout(async () => {
                    await show_edit_modal(user, trans);
                }, 300);
            }
            lastTap = now;
        });

        container.appendChild(recordDiv);
    });

    if (user.cash.length === 0) {
        container.innerHTML = '<div class="no-transaction">هیچ تراکنشی ثبت نشده است</div>';
    }

    render_top_box(total_currencies);
}

onAuth(async (isLoggedIn, userId) => {
    if (isLoggedIn) {
        currentDisplayUserId = getUserIdFromUrl();
        if (!currentDisplayUserId) {
            alert('شناسه صصصصصصعتبر');
            window.location.href = 'users-page.html';
            return;
        }

        // برپایی شنونده تغییرات داده کاربر جاری (که وارد شده)
        unsubscribeData = watchUserData((appData) => {
            renderAccountTransactions(appData);
        });

        // تنظیم دکمه‌ها و جستجو
        const userBTN = document.querySelector('.fa-users');
        if (userBTN) userBTN.addEventListener("click", go_users);

        const homeBTN = document.querySelector('.fa-house');
        if (homeBTN) homeBTN.addEventListener("click", go_home);

        const gearBTN = document.querySelector('.fa-gear');
        if (gearBTN) gearBTN.addEventListener("click", go_settings);
    

        const cancelIcon = document.querySelector('.buttons .cancel');
        if (cancelIcon) cancelIcon.onclick = () => close_new_record_window();
    
        const saveIcon = document.querySelector('.buttons .save');
        if (saveIcon) saveIcon.onclick = () => add_record();
    
        const plusIcon = document.querySelector('.fa-plus');
        if (plusIcon) plusIcon.onclick = () => show_new_record_window();
    
        const modal1Prof = document.querySelector('.modal-1 .prof');
        if (modal1Prof) modal1Prof.onclick = () => show_modal_2();

        // تنظیم جستجو
        const searchBox = document.querySelector('.top-box .searchBox');
        if (searchBox) {
            searchBox.addEventListener('input', async (e) => {
                const value = e.target.value;
                await render_search_account_transactions(currentDisplayUserId, value);
            });
        }
    } else {
        window.location.href = 'login.html';
    }
});

window.addEventListener('beforeunload', () => {
    if (unsubscribeData) unsubscribeData();
});