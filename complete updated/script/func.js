import { loadData, escapeHtml, saveData, render_rec, render_top_box } from './common.js';
import { renderUsers } from './users-page.js';
import { getPersianDate, showUserContextMenu } from './usefull.js';
import { right_click, show_edit_modal } from './edits.js'; // <-- ایمپورت توابع لازم

// ------------------------------------------------------
// 1. جستجو در صفحه خانه (تراکنش‌های امروز همه کاربران)
// ------------------------------------------------------
export async function render_search_recs(page, value) {
    const searchTerm = value.toString().trim().toLowerCase();
    
    if (!searchTerm) {
        await render_rec();
        document.querySelector('.loader').style.display = 'none';
        return;
    }

    document.querySelector('.cash-balance').innerHTML = '';
    let total_currencies = {};
    const date = getPersianDate();
    const appData = await loadData();
    const container = document.querySelector('.record-father');
    if (!container) return;
    container.innerHTML = '';
    
    let hasAny = false;

    for (const user of appData.customers) {
        console.log(await loadData());
        console.log(date);
        const matchedTransactions = user.cash.filter(trans => {
            if (trans.trans_date !== date) return false;
            
            const searchableText = [
                user.name,
                trans.description || '',
                trans.amount.toString(),
                trans.currency,
                trans.state === 'برد' ? 'برداشت' : 'رسید'
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
        
        matchedTransactions.forEach(trans => {
            if (total_currencies[trans.currency]) {
                total_currencies[trans.currency] += Number(trans.amount);
            } else {
                total_currencies[trans.currency] = Number(trans.amount);
            }
            hasAny = true;
            
            const newRec = document.createElement('div');
            newRec.className = 'record';
            newRec.dataset.userId = user.id;
            newRec.dataset.transIndex = user.cash.indexOf(trans);
            newRec.innerHTML = `
                <div class="prof-wraper">
                    <img class="prof" src="${user.prof || 'img.JPG'}">
                </div>
                <div class="name-and-description">
                    <p class="name">${escapeHtml(user.name)}</p>
                    <p class="description">${escapeHtml(trans.description || '')}</p>
                </div>
                <div class="price-content">
                    <p class="amount">${trans.amount}</p>
                    <p class="currency ${trans.currency}">${trans.currency}</p>
                    <p class="state">${trans.state === 'برد' ? 'برداشت' : 'رسید'}</p>
                </div>
            `;
            
            newRec.addEventListener('contextmenu', async (event) => {
                event.preventDefault();
                await right_click(event.clientX, event.clientY, user, trans, newRec);
            });

            let lastTap = 0;
            let tapTimeout;
            newRec.addEventListener('pointerup', async (e) => {
                e.preventDefault();
                if (e.pointerType !== 'touch') return;
                const now = Date.now();
                if (now - lastTap < 300) {
                    clearTimeout(tapTimeout);
                    await right_click(e.clientX, e.clientY, user, trans, newRec);
                } else {
                    tapTimeout = setTimeout(async () => {
                        await right_click(e.clientX, e.clientY, user, trans, newRec);
                    }, 300);
                }
                lastTap = now;
            });
            
            container.appendChild(newRec);
        });
    }
    
    if (!hasAny) {
        container.innerHTML = '<p class="alert" style="color:white; text-align:center;">نتیجه‌ای برای جستجوی شما یافت نشد</p>';
    }
    render_top_box(total_currencies);
}

// ------------------------------------------------------
// 2. جستجو در صفحه حساب کاربری (تراکنش‌های یک کاربر خاص)
// ------------------------------------------------------
export async function render_search_account_transactions(userId, searchValue) {
    document.querySelector('.cash-balance').innerHTML = '';
    const searchTerm = searchValue.toString().trim().toLowerCase();
    const appData = await loadData();
    const user = appData.customers.find(u => u.user_id == userId);
    let total_currencies = {};
    
    if (!user) {
        console.error('کاربر یافت نشد');
        return;
    }
    
    const container = document.querySelector('.record-father');
    if (!container) return;
    
    if (!searchTerm) {
        await render_search_recs("account", searchValue);
        return;
    }
    
    const matchedTransactions = user.cash.filter(trans => {
        const searchableText = [
            user.name,
            trans.description || '',
            trans.amount.toString(),
            trans.currency,
            trans.state === 'برد' ? 'برداشت' : 'رسید'
        ].join(' ').toLowerCase();
        return searchableText.includes(searchTerm);
    });
    
    container.innerHTML = '';
    if (matchedTransactions.length === 0) {
        container.innerHTML = '<div class="no-transaction">نتیجه‌ای برای جستجوی شما یافت نشد</div>';
        document.querySelector('.cash-balance').innerHTML = '';
        return;
    }
    
    matchedTransactions.forEach(trans => {
        if (total_currencies[trans.currency] !== undefined || total_currencies[trans.currency]) {
            total_currencies[trans.currency] += Number(trans.amount);
        } else {
            total_currencies[trans.currency] = Number(trans.amount);
        }
        console.log(total_currencies[trans.currency]);
        const recordDiv = document.createElement('div');
        recordDiv.className = 'record';
        recordDiv.innerHTML = `
            <div class="prof-wraper">
                <img class="prof" src="${user.prof || 'isha.jpg'}" alt="prof">
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
        let tapTimeout;
        recordDiv.addEventListener('pointerup', async (e) => {
            e.preventDefault();
            if (e.pointerType !== 'touch') return;
            const now = Date.now();
            if (now - lastTap < 300) {
                clearTimeout(tapTimeout);
                await right_click(e.clientX, e.clientY, user, trans, recordDiv);
            } else {
                tapTimeout = setTimeout(async () => {
                    await right_click(e.clientX, e.clientY, user, trans, recordDiv);
                }, 300);
            }
            lastTap = now;
        });
        container.appendChild(recordDiv);
    });
    
    document.querySelector('.cash-balance').innerHTML = '';
    render_top_box(total_currencies);
}

// ------------------------------------------------------
// 3. جستجو در صفحه لیست کاربران (users-page.html)
// ------------------------------------------------------
export async function render_search_users(searchValue) {
    const searchTerm = searchValue.toString().trim().toLowerCase();
    const appData = await loadData();
    const container = document.querySelector('.user-preview-father');
    if (!container) return;
    
    if (!searchTerm) {
        await renderUsers();
        return;
    }
    
    const filteredUsers = appData.customers.filter(user => {
        const searchableText = [
            user.name,
            user.description || '',
            user.phone_num || '',
            user.telegram_id || ''
        ].join(' ').toLowerCase();
        return searchableText.includes(searchTerm);
    });
    
    container.innerHTML = '';
    if (filteredUsers.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:white;">کاربری یافت نشد</div>';
        document.querySelector('.cash-balance').innerHTML = '';
        return;
    }
    
    let total_currencies = {};
    
    filteredUsers.forEach(user => {
        user.cash.forEach(trans => {
            let curr = trans.currency;
            let amount = trans.amount;
            if (total_currencies[curr]) {
                total_currencies[curr] += Number(amount);
            } else {
                total_currencies[curr] = Number(amount);
            }
        });
        
        const userEl = document.createElement('div');
        userEl.className = 'user-preview';
        userEl.dataset.userId = user.id;
        userEl.innerHTML = `
            <img class="prof" src="${user.prof || './prof/img.JPG'}">
            <div class="name-and-bookAddress">
                <p class="name">${escapeHtml(user.name)}</p>
                <p class="bookAddress">${escapeHtml(user.bookAddress || '')}</p>
            </div>
        `;
        
        let totalFather = document.createElement('div');
        totalFather.className = 'currencies-and-totals-5';
        if (Object.keys(user.cash).length === 0) {
            totalFather.textContent = 'چیزی ثبت نشده است';
        } else {
            let user_total = {};
            user.cash.forEach(trans => {
                let curr = trans.currency;
                let amount = trans.amount;
                if (user_total[curr]) {
                    user_total[curr] += Number(amount);
                } else {
                    user_total[curr] = Number(amount);
                }
            });
            Object.entries(user_total).forEach(([curr, amount]) => {
                console.log(curr, amount);
                let total = document.createElement('div');
                total.className = 'currency-and-total';
                total.innerHTML = `
                    <p class="total-currency ${curr}">${curr}</p>
                    <p class="total">${amount}</p>
                `;
                totalFather.appendChild(total);
            });
        }
        
        userEl.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showUserContextMenu(event.clientX, event.clientY, user, userEl);
        });

        let lastTap = 0;
        let tapTimeout;
        userEl.addEventListener('pointerup', async (e) => {
            if (e.pointerType !== 'touch') return;
            const now = Date.now();
            if (now - lastTap < 300) {
                clearTimeout(tapTimeout);
                showUserContextMenu(e.clientX, e.clientY, user, userEl);
            } else {
                tapTimeout = setTimeout(() => {
                    window.location.href = `account.html?userId=${user.id}`;
                }, 300);
            }
            lastTap = now;
        });
        
        container.appendChild(userEl);
        userEl.appendChild(totalFather);
    });
    
    document.querySelector('.cash-balance').innerHTML = '';
    render_top_box(total_currencies, filteredUsers);
}

// ------------------------------------------------------
// 4. جستجو در مودال 2 (انتخاب کاربر برای تراکنش جدید)
// ------------------------------------------------------
async function render_search_users_modal(searchValue) {
    const searchTerm = searchValue.toString().trim().toLowerCase();
    const appData = await loadData();
    const container = document.querySelector('.acounts-section');
    if (!container) return;
    
    let filteredUsers = appData.customers;
    if (searchTerm) {
        filteredUsers = appData.customers.filter(user => {
            const searchableText = [
                user.name,
                user.description || '',
                user.phone_num || '',
                user.telegram_id || ''
            ].join(' ').toLowerCase();
            return searchableText.includes(searchTerm);
        });
    }
    
    container.innerHTML = '';
    if (filteredUsers.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:white; padding:20px;">کاربری یافت نشد</div>';
        return;
    }
    
    filteredUsers.forEach(user => {
        const userEl = document.createElement('div');
        userEl.className = 'user-preview-modal';
        userEl.dataset.userId = user.id;
        userEl.innerHTML = `
            <img class="prof" src="${user.prof || 'isha.jpg'}">
            <p class="name">${escapeHtml(user.name)}</p>
        `;
        userEl.addEventListener('click', async () => {
            sessionStorage.setItem('currentUserId', user.id);
            document.querySelector('.modal-2').style.display = 'none';
            await loadUserAccount_onModal(); // تابع در common.js
        });
        container.appendChild(userEl);
    });
}
