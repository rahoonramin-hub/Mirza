// edits.js
import { loadData, saveData, show_modal_2 } from './common.js';
import { shareTransaction, sendToTelegram, copyTransactionText, duplicateTransaction, showAdvancedExport  } from './usefull.js';

// تابع نمایش مودال ویرایش تراکنش
export async function show_edit_modal(user, trans) {
    const oldModal = document.querySelector('.modal-edit-trans');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-edit-trans';
    modal.innerHTML = `
        <div class="edit-record-window">
            <div class="record-info">
                <div class="prof-wraper">
                    <img class="prof" src="${user.prof || 'img.JPG'}">
                </div>
                <p class="name">${user.name}</p>
                <input class="description" type="text" placeholder="شرح" value="${trans.description || ''}">
                <input class="amount" type="text" placeholder="مبلغ" value="${trans.amount}">
                <input class="currency" type="text" placeholder="واحد" value="${trans.currency}">
                <div class="transaction-div">
                    <label class="radio-box">
                        <span>برد</span>
                        <input type="radio" name="transaction-type" value="payment" ${trans.state === 'برد' ? 'checked' : ''}>
                    </label>
                    <label class="radio-box">
                        <span>رسید</span>
                        <input type="radio" name="transaction-type" value="receipt" ${trans.state === 'رسید' ? 'checked' : ''}>
                    </label>
                </div>
            </div>
            <div class="buttons">
                <button class="cancel">لغو</button>
                <button class="save">ثبت</button>
            </div>
        </div>
    `;

    modal.querySelector('.cancel').onclick = () => modal.remove();

    modal.querySelector('.save').onclick = async () => {
        modal.style.display = "none";
        await edit_trans(user, trans);
        modal.remove();

    };

    modal.querySelector('.prof').onclick = async () => {
        sessionStorage.setItem('currentUserId', user.id);
        await show_modal_2();
    };

    document.body.appendChild(modal);
}

// تابع ویرایش تراکنش
async function edit_trans(originalUser, originalTransaction) {
    const editWindow = document.querySelector('.modal-edit-trans');
    if (!editWindow) return;

    const description = editWindow.querySelector('.description').value;
    const rawAmount = parseFloat(editWindow.querySelector('.amount').value);
    const currency = editWindow.querySelector('.currency').value;
    const stateElement = editWindow.querySelector('input[name="transaction-type"]:checked');
    const targetUserId = sessionStorage.getItem('currentUserId');

    if (!description || isNaN(rawAmount) || !currency || !stateElement) {
        alert('لطفاً همه فیلدها را به درستی پر کنید');
        return;
    }

    const state = stateElement.value === 'payment' ? 'برد' : 'رسید';
    const newAmount = (state === 'برد') ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    const newTransaction = {
        amount: newAmount,
        state: state,
        currency: currency,
        description: description,
        trans_date: originalTransaction.trans_date
    };

    let appData = await loadData();
    if (!appData) return;

    const sourceUser = appData.customers.find(u => u.id == originalUser.id);
    if (!sourceUser) {
        alert('کاربر مبدأ یافت نشد');
        return;
    }

    let targetUser = sourceUser;
    let isUserChanged = false;

    if (targetUserId && Number(targetUserId) !== sourceUser.id) {
        const foundUser = appData.customers.find(u => u.id == Number(targetUserId));
        if (foundUser) {
            targetUser = foundUser;
            isUserChanged = true;
        }
    }

    if (isUserChanged) {
        await change_user(sourceUser, targetUser, originalTransaction, newTransaction);
    } else {
        
        // جایگزینی تراکنش
        const transIndex = sourceUser.cash.findIndex(t =>
            t.amount === originalTransaction.amount &&
            t.description === originalTransaction.description &&
            t.currency === originalTransaction.currency &&
            t.trans_date === originalTransaction.trans_date &&
            t.state === originalTransaction.state
        );
        if (transIndex !== -1) {
            sourceUser.cash[transIndex] = newTransaction;
        }

        
        await saveData(appData);
    }

    sessionStorage.removeItem('currentUserId');
}

// تابع تغییر کاربر تراکنش
async function change_user(sourceUser, targetUser, oldTransaction, newTransaction) {
    const sourceCurrency = oldTransaction.currency;
    const oldEffect = -oldTransaction.amount;

    if (sourceUser.currencies_total[sourceCurrency] !== undefined) {
        sourceUser.currencies_total[sourceCurrency] += oldEffect;
        if (sourceUser.currencies_total[sourceCurrency] === 0) {
            delete sourceUser.currencies_total[sourceCurrency];
        }
    }

    const transIndex = sourceUser.cash.findIndex(t =>
        t.amount === oldTransaction.amount &&
        t.description === oldTransaction.description &&
        t.currency === oldTransaction.currency &&
        t.trans_date === oldTransaction.trans_date &&
        t.state === oldTransaction.state
    );
    if (transIndex !== -1) {
        sourceUser.cash.splice(transIndex, 1);
    }

    targetUser.cash.push(newTransaction);

    const targetCurrency = newTransaction.currency;
    const newAmount = newTransaction.amount;

    if (targetUser.currencies_total[targetCurrency] !== undefined) {
        targetUser.currencies_total[targetCurrency] += newAmount;
        if (targetUser.currencies_total[targetCurrency] === 0) {
            delete targetUser.currencies_total[targetCurrency];
        }
    } else {
        targetUser.currencies_total[targetCurrency] = newAmount;
    }

    const appData = await loadData();
    const sourceIndex = appData.customers.findIndex(u => u.id == sourceUser.id);
    const targetIndex = appData.customers.findIndex(u => u.id == targetUser.id);
    if (sourceIndex !== -1) appData.customers[sourceIndex] = sourceUser;
    if (targetIndex !== -1) appData.customers[targetIndex] = targetUser;
    await saveData(appData);
}

// تابع حذف تراکنش
export async function delete_trans(user, trans, element) {
    if (!confirm(`آیا از حذف این تراکنش (${Math.abs(trans.amount)} ${trans.currency}) مطمئن هستید؟`)) {
        return;
    }

    const appData = await loadData();
    if (!appData) return;

    const currentUser = appData.customers.find(u => u.id == user.id);
    if (!currentUser) return;

    const cashIndex = currentUser.cash.findIndex(item =>
        item.amount === trans.amount &&
        item.currency === trans.currency &&
        item.trans_date === trans.trans_date &&
        item.description === trans.description
    );

    if (cashIndex === -1) {
        console.log('تراکنش یافت نشد');
        return;
    }
    
    currentUser.cash.splice(cashIndex, 1);
    await saveData(appData);

    if (element && element.remove) {
        element.remove();
    }

    const container = document.querySelector('.record-father');
    if (container && container.children.length === 0) {
        container.innerHTML = '<p class="alert" style="color:white; text-align:center;">هیچ تراکنشی ثبت نشده است</p>';
    }
    location.reload();
}

// تابع نمایش جزئیات تراکنش
function showTransactionDetails(user, transaction) {
    const details = `
        📋 جزئیات تراکنش
        ────────────────
        👤 کاربر: ${user.name}
        📝 شرح: ${transaction.description || 'بدون شرح'}
        💰 مبلغ: ${transaction.amount} ${transaction.currency}
        🔄 نوع: ${transaction.state === 'برد' ? 'برداشت' : 'رسید'}
        📅 تاریخ: ${transaction.trans_date}
    `;
    alert(details);
}

// تابع راست کلیک (export می‌شود تا در سایر ماژول‌ها استفاده شود)
export async function right_click(x, y, user, trans, element) {
    console.log(`کلیک راست در موقعیت: ${x} , ${y}`);

    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background-color: #17212b;
        border: 1px solid #2ea6ff;
        border-radius: 8px;
        padding: 5px;
        z-index: 1000;
        min-width: 120px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;

    const deleteOption = createOption('delete-option', async () => {
        await delete_trans(user, trans, element);
        menu.remove();
    }, '#ffa8a8', '🗑 حذف تراکنش');

    const editOption = createOption('edit-option', async () => {
        await show_edit_modal(user, trans);
        menu.remove();
    }, '#a8ebff', '✏ ویرایش تراکنش');

    const detailOption = createOption('detail-option', () => {
        showTransactionDetails(user, trans);
        menu.remove();
    }, '#b2ffa8', 'ℹ جزئیات');

    const goTouserOption = createOption('goUser-option', () => {
        window.location.href = `account.html?userId=${user.id}`;
        menu.remove();
    }, '#ffa8f6', '👤 حساب مشتری');

    // توابعی که در usefull.js تعریف شده‌اند باید global باشند یا import شوند
    const shareOption = createOption('share-option', () => {
        if (typeof shareTransaction === 'function') shareTransaction(user, trans);
        else alert('تابع اشتراک‌گذاری در دسترس نیست');
        menu.remove();
    }, '#b2ffa8', '📤 اشتراک‌گذاری');

    const telegramOption = createOption('telegram-option', () => {
        if (typeof sendToTelegram === 'function') sendToTelegram(user, trans);
        else alert('تابع ارسال به تلگرام در دسترس نیست');
        menu.remove();
    }, '#87CEEB', '📱 ارسال به تلگرام');

    const copyOption = createOption('copy-option', () => {
        if (typeof copyTransactionText === 'function') copyTransactionText(user, trans);
        else navigator.clipboard?.writeText(`${user.name} - ${trans.amount} ${trans.currency}`);
        menu.remove();
    }, '#FFD966', '📋 کپی متن');

    const duplicateOption = createOption('duplicate-option', async () => {
        if (typeof duplicateTransaction === 'function') await duplicateTransaction(user, trans);
        else alert('تابع ثبت مشابه در دسترس نیست');
        menu.remove();
    }, '#C0C0C0', '🔄 ثبت مشابه');

    const exportOption = createOption('export-option', () => {
        if (typeof showAdvancedExport === 'function') showAdvancedExport(user.id);
        else alert('تابع خروجی پیشرفته در دسترس نیست');
        menu.remove();
    }, '#a8ebff', '📊 خروجی پیشرفته');

    menu.appendChild(shareOption);
    menu.appendChild(telegramOption);
    menu.appendChild(copyOption);
    menu.appendChild(duplicateOption);
    menu.appendChild(exportOption);
    menu.appendChild(goTouserOption);
    menu.appendChild(editOption);
    menu.appendChild(deleteOption);
    menu.appendChild(detailOption);
    document.body.appendChild(menu);

    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 0);
}

// تابع کمکی ساخت گزینه‌های منو
function createOption(className, onClick, color, text) {
    const option = document.createElement('div');
    option.className = className;
    option.style.cssText = `
        padding: 8px 12px;
        margin: 2px 0;
        cursor: pointer;
        color: ${color};
        border-radius: 6px;
        transition: background-color 0.2s;
        font-size: 14px;
    `;
    option.textContent = text;

    option.onmouseenter = () => {
        option.style.backgroundColor = '#2ea6ff20';
    };
    option.onmouseleave = () => {
        option.style.backgroundColor = 'transparent';
    };

    option.onclick = (event) => {
        event.stopPropagation();
        onClick();
    };

    return option;
}

// اتصال توابع به window برای دسترسی از onclick های HTML
window.right_click = right_click;
window.show_edit_modal = show_edit_modal;
window.delete_trans = delete_trans;