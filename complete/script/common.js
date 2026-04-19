// common.js - نسخه Firebase با پشتیبانی از ساختار merchants/customers
import { auth, db } from './firebase-config.js';
import { 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, addDoc, query, writeBatch, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

let currentOwnerUid = null;   // UID مالک (خریدار برنامه)
let customersUnsubscribe = null; // برای قطع شنود مشتریان
let appDataCache = null;      // کش محلی برای سازگاری با کد قدیم

const record_window = document.querySelector('.new-record-window');

// ========== احراز هویت ==========
export function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
    return signOut(auth);
}

export function onAuth(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentOwnerUid = user.uid;
            // اطمینان از وجود سند مالک در Firestore
            const ownerRef = doc(db, "merchants", currentOwnerUid);
            const ownerSnap = await getDoc(ownerRef);
            if (!ownerSnap.exists()) {
                await setDoc(ownerRef, {
                    ownerName: user.email || "مالک",
                    email: user.email,
                    createdAt: new Date().toISOString()
                });
                console.log("سند مالک جدید ایجاد شد.");
            }
            callback(true, currentOwnerUid);
        } else {
            currentOwnerUid = null;
            appDataCache = null;
            if (customersUnsubscribe) {
                customersUnsubscribe();
                customersUnsubscribe = null;
            }
            callback(false, null);
        }
    });
}

// محاسبه مجموع ارزها از روی آرایه تراکنش‌ها
export function calculateTotals(cash) {
    const totals = {};
    cash.forEach(t => {
        const amt = Number(t.amount);
        const cur = t.currency;
        totals[cur] = (totals[cur] || 0) + amt;
        if (totals[cur] === 0) delete totals[cur];
    });
    return totals;
}

// ========== توابع مدیریت مشتریان (سازگار با نسخه قبلی) ==========

/**
 * بارگذاری لیست تمام مشتریان (همان loadData قبلی)
 * خروجی: { customers: [...] } برای سازگاری با کد قدیم
 */
export async function loadData() {
    if (!currentOwnerUid) {
        console.warn("کاربر وارد نشده است");
        return { customers: [] };
    }
    if (appDataCache) return appDataCache;

    const customersRef = collection(db, "merchants", currentOwnerUid, "customers");
    const snapshot = await getDocs(query(customersRef));
    const customers = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        customers.push({
            id: doc.id,
            name: data.name,
            prof: data.prof,
            cash: data.cash || [],
            currencies_total: data.currencies_total || {},
            description: data.description || "",
            phone_num: data.phone_num || "",
            telegram_id: data.telegram_id || "",
            bookAddress: data.bookAddress || ""
        });
    });
    const result = { customers };
    appDataCache = result;
    return result;
}

/**
 * ذخیره تغییرات کلی (برای سازگاری با کد قدیم)
 * انتظار دارد appData شامل customers باشد. 
 * توجه: با ساختار جدید، عملیات bulk انجام می‌دهد (حذف مشتریان قدیم و بازنویسی)
 * اما توصیه می‌شود از توابع اختصاصی add/update/delete استفاده شود.
 */
export async function saveData(appData) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است");
    const customers = appData.customers;
    if (!Array.isArray(customers)) {
        throw new Error("داده نامعتبر: customers باید آرایه باشد");
    }

    const batch = writeBatch(db);
    const customersRef = collection(db, "merchants", currentOwnerUid, "customers");

    // دریافت تمام مشتریان فعلی برای حذف آنهایی که در لیست جدید نیستند
    const existingSnapshot = await getDocs(query(customersRef));
    const existingIds = new Set();
    existingSnapshot.forEach(doc => existingIds.add(doc.id));

    const newIds = new Set();

    // اضافه/به‌روزرسانی مشتریان جدید
    customers.forEach(customer => {
        const customerId = String(customer.id || customer.user_id); // پشتیبانی از هر دو نام
        if (!customerId) {
            // اگر شناسه نداشت، به عنوان جدید اضافه کن
            const newRef = doc(customersRef);
            newIds.add(newRef.id);
            batch.set(newRef, {
                name: customer.name,
                prof: customer.prof,
                cash: customer.cash || [],
                currencies_total: customer.currencies_total || {},
                description: customer.description || "",
                phone_num: customer.phone_num || "",
                telegram_id: customer.telegram_id || "",
                bookAddress: customer.bookAddress || ""
            });
        } else {
            newIds.add(customerId);
            const customerRef = doc(db, "merchants", currentOwnerUid, "customers", customerId);
            batch.set(customerRef, {
                name: customer.name,
                prof: customer.prof,
                cash: customer.cash || [],
                currencies_total: customer.currencies_total || {},
                description: customer.description || "",
                phone_num: customer.phone_num || "",
                telegram_id: customer.telegram_id || "",
                bookAddress: customer.bookAddress || ""
            }, { merge: true });
        }
    });

    // حذف مشتریانی که در لیست جدید نیستند
    existingIds.forEach(id => {
        if (!newIds.has(id)) {
            const ref = doc(db, "merchants", currentOwnerUid, "customers", id);
            batch.delete(ref);
        }
    });

    await batch.commit();
    appDataCache = appData; // به‌روزرسانی کش
}

/**
 * شنود لحظه‌ای تغییرات مشتریان (معادل watchUserData)
 * خروجی را به صورت { customers: [...] } برمی‌گرداند
 */
export function watchUserData(callback) {
    if (!currentOwnerUid) {
        console.warn("شنود ممکن نیست: کاربر وارد نشده است.");
        callback({ customers: [] });
        return () => {};
    }

    // قطع شنود قبلی در صورت وجود
    if (customersUnsubscribe) {
        customersUnsubscribe();
    }

    const customersRef = collection(db, "merchants", currentOwnerUid, "customers");
    const q = query(customersRef);
    
    customersUnsubscribe = onSnapshot(q, (snapshot) => {
        const customers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            customers.push({
                id: doc.id,
                user_id: doc.id, // برای سازگاری با کد قدیم
                name: data.name,
                prof: data.prof,
                cash: data.cash || [],
                currencies_total: data.currencies_total || {},
                description: data.description || "",
                phone_num: data.phone_num || "",
                telegram_id: data.telegram_id || "",
                bookAddress: data.bookAddress || ""
            });
        });
        const result = { customers };
        appDataCache = result;
        callback(result);
    }, (error) => {
        console.error("خطا در شنود مشتریان:", error);
        if (appDataCache) {
            callback(appDataCache);
        } else {
            callback({ customers: [] });
        }
    });

    return customersUnsubscribe;
}

// ========== توابع تراکنش‌ها (سازگار با کد قدیم) ==========

/**
 * نمایش تراکنش‌های امروز در صفحه اصلی
 */
export async function render_rec() {
    document.querySelector('.cash-balance').innerHTML = '';
    let total_currencies = {};
    const date = getPersianDate();
    
    if (!currentOwnerUid) {
        console.warn("کاربر وارد نشده است");
        return;
    }

    const container = document.querySelector('.record-father');
    if (!container) return;
    container.innerHTML = '';

    const customersRef = collection(db, "merchants", currentOwnerUid, "customers");
    const snapshot = await getDocs(query(customersRef));
    let hasAny = false;

    snapshot.forEach(doc => {
        const user = {
            id: doc.id,
            user_id: doc.id,
            name: doc.data().name,
            prof: doc.data().prof,
            cash: doc.data().cash || []
        };

        const todayTrans = user.cash.filter(t => t.trans_date === date);

        todayTrans.forEach(trans => {
            // به‌روزرسانی مجموع کل
            const amt = Number(trans.amount);
            if (total_currencies[trans.currency]) {
                total_currencies[trans.currency] += amt;
            } else {
                total_currencies[trans.currency] = amt;
            }
            hasAny = true;

            const newRec = document.createElement('div');
            newRec.className = 'record';
            newRec.dataset.customerId = user.id;
            // ذخیره تراکنش به صورت رشته‌ای برای شناسایی بعدی
            newRec.dataset.transaction = JSON.stringify(trans);

            newRec.innerHTML = `
                <div class="prof-wraper">
                    <img class="prof" src="${user.prof || './prof/img.JPG'}">
                </div>
                <div class="name-and-description">
                    <p class="name">${escapeHtml(user.name)}</p>
                    <p class="description">${escapeHtml(trans.description || '')}</p>
                </div>
                <div class="price-content">
                    <p class="amount">${trans.amount}</p>
                    <p class="currency ${trans.currency}">${trans.currency}</p>
                    <p class="state ${trans.state}" data-state="${trans.state}">${trans.state === 'برد' ? 'برداشت' : 'رسید'}</p>
                </div>
            `;

            // راست کلیک (دسکتاپ)
            newRec.addEventListener('contextmenu', async (event) => {
                event.preventDefault();
                await right_click(event.clientX, event.clientY, user, trans, newRec);
            });

            // دابل تپ (موبایل)
            let lastTap = 0;
            let tapTimeout;
            newRec.addEventListener('touchend', async (e) => {
                const now = Date.now();
                if (now - lastTap < 300) {
                    clearTimeout(tapTimeout);
                    const touch = e.changedTouches[0];
                    await right_click(touch.clientX, touch.clientY, user, trans, newRec);
                } else {
                    tapTimeout = setTimeout(async () => {
                        await show_edit_modal(user, trans);
                    }, 300);
                }
                lastTap = now;
            });

            container.appendChild(newRec);
        });
    });

    if (!hasAny) {
        container.innerHTML = '<p class="alert" style="color:white; text-align:center;">هیچ تراکنشی برای امروز ثبت نشده است</p>';
    }
    render_top_box(total_currencies);
}

/**
 * افزودن تراکنش جدید (از مودال ۱)
 */
export async function add_record() {
    const customerId = sessionStorage.getItem('currentUserId'); // در اینجا شناسه مشتری است
    if (!customerId) {
        alert('ابتدا یک مشتری انتخاب کنید.');
        return;
    }
    if (!currentOwnerUid) {
        alert('کاربر وارد نشده است');
        return;
    }

    let description = record_window.querySelector('.description').value;
    let amount = record_window.querySelector('.amount').value;
    let currency = record_window.querySelector('.currency').value;
    const stateElement = document.querySelector('input[name="transaction-type"]:checked');
    const state = stateElement ? stateElement.value : '';

    if (!description || !amount || !currency || !state) {
        alert('لطفاً همه فیلدها را پر کنید.');
        return;
    }

    const finalAmount = state === 'payment' ? -Number(amount) : Number(amount);
    const transaction = {
        amount: finalAmount,
        state: state === 'payment' ? 'برد' : 'رسید',
        currency: currency,
        description: description,
        trans_date: getPersianDate()
    };

    try {
        await addTransaction(customerId, transaction);
        close_new_record_window();
        // به‌روزرسانی UI توسط شنود خودکار انجام می‌شود
    } catch (error) {
        console.error("خطا در افزودن تراکنش:", error);
        alert("خطا در ثبت تراکنش. لطفاً دوباره تلاش کنید.");
    }
}

// ========== توابع کمکی نمایش‌دهنده ==========

/**
 * نمایش جمع کل ارزها در باکس بالای صفحه
 */
export function render_top_box(currencies, hasTrans = null) {
    const father = document.querySelector('.cash-balance');
    if (!father) return;
    father.innerHTML = '';

    if (!currencies || Object.keys(currencies).length === 0) {
        const cash = document.createElement('div');
        if (hasTrans && Array.isArray(hasTrans) && hasTrans.length > 0) {
            cash.textContent = 'تصفیه است';
        } else {
            cash.textContent = 'چیزی ثبت نشده';
        }
        cash.style.color = '#aaa';
        cash.style.padding = '10px';
        father.appendChild(cash);
        return;
    }

    Object.entries(currencies).forEach(([currency, amount]) => {
        const cash = document.createElement('div');
        cash.className = 'cash';
        cash.innerHTML = `
            <p class="total-currency ${currency}">${currency}</p>
            <p class="amount">${amount}</p>
        `;
        if (amount < 0) {
            cash.style.border = '1px solid #ff6666';
            cash.style.backgroundColor = '#332222';
        }
        father.appendChild(cash);
    });
}

/**
 * ساخت تراکنش (فقط برای محاسبات محلی - استفاده داخلی)
 */
function createTransaction(amount, state, currency, description, user) {
    let finalAmount = Number(amount);
    if (state === 'payment') {
        finalAmount = -finalAmount;
    }
    // توجه: به‌روزرسانی currencies_total در تابع addTransaction انجام می‌شود
    return {
        amount: finalAmount,
        state: state === 'payment' ? 'برد' : 'رسید',
        currency: currency,
        description: description,
        trans_date: getPersianDate()
    };
}

// ========== توابع مودال‌ها ==========

export function show_new_record_window() {
    document.querySelector(".modal-1").style.display = 'flex';
}

export async function show_modal_2() {
    
    const modal_edit = document.querySelector('.modal-edit-trans');
    if (modal_edit) modal_edit.style.display = 'none';
    document.querySelector('.modal-1').style.display = 'none';
    document.querySelector('.modal-2').style.display = 'flex';
    await renderUsers_onModal();
}

export function close_new_record_window() {
    document.querySelector(".modal-1").style.display = 'none';
    if (record_window) {
        record_window.querySelector('.description').value = '';
        record_window.querySelector('.amount').value = '';
        record_window.querySelector('.currency').value = '';
        const profImg = record_window.querySelector('.prof');
        if (profImg) profImg.src = './prof/img.JPG';
    }
}

function close_modal_2() {
    document.querySelector('.modal-2').style.display = 'none';
}

/**
 * بارگذاری اطلاعات مشتری انتخاب‌شده در مودال ۱ یا ویرایش
 */
async function loadUserAccount_onModal() {
    const customerId = sessionStorage.getItem('currentUserId');
    if (!customerId) {
        alert('شناسه مشتری نامعتبر است');
        window.location.href = 'home-complete.html';
        return;
    }
    if (!currentOwnerUid) {
        alert('کاربر وارد نشده است');
        return;
    }

    const customerRef = doc(db, "merchants", currentOwnerUid, "customers", customerId);
    const snap = await getDoc(customerRef);
    if (!snap.exists()) {
        alert('مشتری یافت نشد');
        window.location.href = 'home-complete.html';
        return;
    }
    const user = { id: snap.id, ...snap.data() };

    if (document.querySelector('.modal-edit-trans')) {
        const profImg = document.querySelector('.edit-record-window .prof-wraper img');
        if (profImg) profImg.src = user.prof || './prof/img.JPG';
        const nameElem = document.querySelector('.edit-record-window .record-info .name');
        if (nameElem) nameElem.textContent = user.name;
        document.querySelector('.modal-edit-trans').style.display = 'flex';
        close_modal_2();
       
    } else {
        const profImg = document.querySelector('.new-record-window .prof-wraper img');
        if (profImg) profImg.src = user.prof || './prof/img.JPG';
        const nameElem = document.querySelector('.new-record-window .record-info .name');
        if (nameElem) nameElem.textContent = user.name;
        show_new_record_window();
        close_modal_2();
        
    }
}

/**
 * نمایش لیست مشتریان در مودال ۲
 */
async function renderUsers_onModal() {
    if (!currentOwnerUid) return;
    const container = document.querySelector('.acounts-section');
    if (!container) return;
    container.innerHTML = '';

    const customersRef = collection(db, "merchants", currentOwnerUid, "customers");
    const snapshot = await getDocs(query(customersRef));

    snapshot.forEach(doc => {
        const user = { id: doc.id, ...doc.data() };
        const userEl = document.createElement('div');
        userEl.className = 'user-preview-modal';
        userEl.dataset.userId = user.id;

        userEl.innerHTML = `
            <img class="prof" src="${user.prof || './prof/img.JPG'}">
            <p class="name">${escapeHtml(user.name)}</p>
        `;

        userEl.addEventListener('click', async () => {
            sessionStorage.setItem('currentUserId', user.id);
            await loadUserAccount_onModal();
            document.querySelector('.modal-2').style.display = 'none';
        });

        container.appendChild(userEl);
    });
}

// ========== توابع جدید Firebase برای عملیات CRUD ==========

/**
 * افزودن تراکنش جدید به مشتری (همراه به‌روزرسانی currencies_total)
 */
async function addTransaction(customerId, transaction) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است.");
    const customerRef = doc(db, "merchants", currentOwnerUid, "customers", customerId);
    const customerSnap = await getDoc(customerRef);
    if (!customerSnap.exists()) throw new Error("مشتری یافت نشد.");

    const data = customerSnap.data();
    const cash = data.cash || [];
    const totals = data.currencies_total || {};

    cash.push(transaction);
    const amt = Number(transaction.amount);
    const cur = transaction.currency;
    totals[cur] = (totals[cur] || 0) + amt;
    if (totals[cur] === 0) delete totals[cur];

    await updateDoc(customerRef, { cash, currencies_total: totals });
}

/**
 * ویرایش تراکنش (با پشتیبانی از انتقال بین مشتریان)
 */
export async function updateTransaction(sourceCustomerId, oldTransaction, newTransaction, targetCustomerId = null) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است.");
    const isSame = !targetCustomerId || targetCustomerId === sourceCustomerId;

    if (isSame) {
        const customerRef = doc(db, "merchants", currentOwnerUid, "customers", sourceCustomerId);
        const snap = await getDoc(customerRef);
        if (!snap.exists()) throw new Error("مشتری مبدأ یافت نشد.");
        const data = snap.data();
        let cash = data.cash || [];
        let totals = data.currencies_total || {};

        // حذف اثر تراکنش قدیمی
        const oldAmt = Number(oldTransaction.amount);
        totals[oldTransaction.currency] = (totals[oldTransaction.currency] || 0) - oldAmt;
        if (totals[oldTransaction.currency] === 0) delete totals[oldTransaction.currency];

        cash = cash.filter(t => 
            !(t.amount === oldTransaction.amount && 
              t.currency === oldTransaction.currency && 
              t.trans_date === oldTransaction.trans_date && 
              t.description === oldTransaction.description && 
              t.state === oldTransaction.state)
        );

        cash.push(newTransaction);
        const newAmt = Number(newTransaction.amount);
        totals[newTransaction.currency] = (totals[newTransaction.currency] || 0) + newAmt;
        if (totals[newTransaction.currency] === 0) delete totals[newTransaction.currency];

        await updateDoc(customerRef, { cash, currencies_total: totals });
    } else {
        const sourceRef = doc(db, "merchants", currentOwnerUid, "customers", sourceCustomerId);
        const targetRef = doc(db, "merchants", currentOwnerUid, "customers", targetCustomerId);
        const batch = writeBatch(db);

        const [sourceSnap, targetSnap] = await Promise.all([getDoc(sourceRef), getDoc(targetRef)]);
        if (!sourceSnap.exists() || !targetSnap.exists()) throw new Error("یکی از مشتریان یافت نشد.");
        const sourceData = sourceSnap.data();
        const targetData = targetSnap.data();

        let sourceCash = sourceData.cash || [];
        let sourceTotals = sourceData.currencies_total || {};
        const oldAmt = Number(oldTransaction.amount);
        sourceTotals[oldTransaction.currency] = (sourceTotals[oldTransaction.currency] || 0) - oldAmt;
        if (sourceTotals[oldTransaction.currency] === 0) delete sourceTotals[oldTransaction.currency];
        sourceCash = sourceCash.filter(t => 
            !(t.amount === oldTransaction.amount && 
              t.currency === oldTransaction.currency && 
              t.trans_date === oldTransaction.trans_date && 
              t.description === oldTransaction.description && 
              t.state === oldTransaction.state)
        );
        batch.update(sourceRef, { cash: sourceCash, currencies_total: sourceTotals });

        let targetCash = targetData.cash || [];
        let targetTotals = targetData.currencies_total || {};
        targetCash.push(newTransaction);
        const newAmt = Number(newTransaction.amount);
        targetTotals[newTransaction.currency] = (targetTotals[newTransaction.currency] || 0) + newAmt;
        if (targetTotals[newTransaction.currency] === 0) delete targetTotals[newTransaction.currency];
        batch.update(targetRef, { cash: targetCash, currencies_total: targetTotals });

        await batch.commit();
    }
}

/**
 * حذف تراکنش از مشتری
 */
export async function deleteTransaction(customerId, transaction) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است.");
    const customerRef = doc(db, "merchants", currentOwnerUid, "customers", customerId);
    const snap = await getDoc(customerRef);
    if (!snap.exists()) throw new Error("مشتری یافت نشد.");
    const data = snap.data();
    let cash = data.cash || [];
    let totals = data.currencies_total || {};

    const amt = Number(transaction.amount);
    totals[transaction.currency] = (totals[transaction.currency] || 0) - amt;
    if (totals[transaction.currency] === 0) delete totals[transaction.currency];

    cash = cash.filter(t => 
        !(t.amount === transaction.amount && 
          t.currency === transaction.currency && 
          t.trans_date === transaction.trans_date && 
          t.description === transaction.description && 
          t.state === transaction.state)
    );

    await updateDoc(customerRef, { cash, currencies_total: totals });
}

// ========== توابع جانبی ==========

export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

export function sumByCurrency(user, targetCurrency) {
    return user.cash
        .filter(t => t.currency === targetCurrency)
        .reduce((sum, t) => sum + t.amount, 0);
}

export function go_settings() {
    window.location.href = 'settings.html';
}

export function go_users() {
    window.location.href = `users-page.html`;
}

export function go_home() {
    window.location.href = `home-complete.html`;
}

// تابع دریافت تاریخ شمسی (باید مطابق پروژه شما باشد)
function getPersianDate() {
    // پیاده‌سازی تاریخ شمسی - جایگزین با کد واقعی پروژه
    const date = new Date();
    // فرض می‌کنیم تابع global دارید
    if (typeof window.getPersianDate === 'function') {
        return window.getPersianDate();
    }
    // نمونه ساده (باید با کتابخانه واقعی جایگزین شود)
    return date.toLocaleDateString('fa-IR');
}

// تابع کمکی: با زدن Enter به فیلد بعدی برود
function setupEnterToNextField(formContainerSelector) {
    const container = document.querySelector(formContainerSelector);
    if (!container) return;
    
    const inputs = Array.from(container.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea, select'));
    inputs.forEach((input, index) => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const nextInput = inputs[index + 1];
                if (nextInput) {
                    nextInput.focus();
                } else {
                    const saveBtn = container.querySelector('.save');
                    if (saveBtn) saveBtn.click();
                    else input.blur();
                }
            }
        });
    });
}

// ========== راه‌اندازی اولیه ==========
document.addEventListener('DOMContentLoaded', async () => {
    const modalSearchBox = document.querySelector('.modal-2 .searchBox');
    if (modalSearchBox) {
        modalSearchBox.addEventListener('input', async (e) => {
            await render_search_users_modal(e.target.value);
        });
    }

    // بستن مودال‌ها با کلید Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal1 = document.querySelector('.modal-1');
            if (modal1 && modal1.style.display === 'flex') {
                if (typeof close_new_record_window === 'function') close_new_record_window();
                modal1.style.display = 'none';
            }
            
            const modal2 = document.querySelector('.modal-2');
            if (modal2 && modal2.style.display === 'flex') {
                modal2.style.display = 'none';
            }
            
            const editModal = document.querySelector('.modal-edit-trans');
            if (editModal) editModal.remove();
            
            const contextMenu = document.querySelector('.context-menu, .user-context-menu');
            if (contextMenu) contextMenu.remove();
            
            const searchBox = document.querySelector('.top-box .searchBox');
            if (searchBox && searchBox.value.trim() !== '') {
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input'));
                searchBox.blur();
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.blur();
            }
        }
    });

    setupEnterToNextField('.new-record-window');
    setupEnterToNextField('.new-user-window');
    setupEnterToNextField('.edit-record-window');
});




// توجه: توابع right_click و show_edit_modal باید در فایل‌های دیگر تعریف شده باشند
// یا می‌توانید آن‌ها را از فایل اصلی کپی کنید.