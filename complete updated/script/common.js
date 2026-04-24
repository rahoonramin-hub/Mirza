// common.js - نسخه جدید با پشتیبانی آفلاین
import { auth, db } from './firebase-config.js';
import { 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, addDoc, query, writeBatch, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {getPersianDate} from './usefull.js';

let currentOwnerUid = null;
let customersUnsubscribe = null;
let appDataCache = null;
const record_window = document.querySelector('.new-record-window');

// ارجاع به ماژول‌های آفلاین (در ابتدا undefined)
let offlineDB = null;
let syncManager = null;
let offlineModulesLoaded = false;
let offlineModulesLoading = false;

const pendingSyncStatusCallbacks = [];

function isVisibleElement(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function getSequentialFields(container) {
    if (!container) return [];

    const selector = [
        'input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"])',
        'textarea',
        'select'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)).filter((field) => {
        return !field.disabled && !field.readOnly && isVisibleElement(field);
    });
}

function focusField(field) {
    if (!field || typeof field.focus !== 'function') return;
    field.focus();
    if (typeof field.select === 'function' && field.tagName === 'INPUT') {
        field.select();
    }
}

function focusFirstField(container) {
    const firstField = getSequentialFields(container)[0];
    if (firstField) {
        focusField(firstField);
        return true;
    }
    return false;
}

function getPrimaryAction(container) {
    if (!container) return null;

    const candidates = [
        '.save',
        '#loginBtn',
        '#export-generate',
        '.btn:not(.btn-outline)'
    ];

    for (const selector of candidates) {
        const button = container.querySelector(selector);
        if (button && !button.disabled && isVisibleElement(button)) {
            return button;
        }
    }

    return null;
}

function handleEnterAsNextField(event, container) {
    const target = event.target;
    if (!target || !container) return false;

    if (target.tagName === 'TEXTAREA' && !event.ctrlKey && !event.metaKey) {
        return false;
    }

    if (target.matches('button, [type="button"], [type="submit"], [type="radio"], [type="checkbox"], [type="file"]')) {
        return false;
    }

    const fields = getSequentialFields(container);
    const currentIndex = fields.indexOf(target);
    if (currentIndex === -1) return false;

    event.preventDefault();

    const nextField = fields[currentIndex + 1];
    if (nextField) {
        focusField(nextField);
    } else {
        const actionButton = getPrimaryAction(container);
        if (actionButton) actionButton.click();
        else target.blur();
    }

    return true;
}

function triggerAccessibleClick(event) {
    const target = event.target.closest('[data-keyboard-clickable="true"]');
    if (!target) return false;

    if (event.key !== 'Enter' && event.key !== ' ') return false;

    event.preventDefault();
    target.click();
    return true;
}

function closeTopInteractiveLayer() {
    const exportModal = document.querySelector('.modal-export-advanced');
    if (exportModal && isVisibleElement(exportModal)) {
        exportModal.querySelector('#export-cancel')?.click();
        return true;
    }

    const modal2 = document.querySelector('.modal-2');
    if (modal2 && isVisibleElement(modal2)) {
        modal2.querySelector('.modal-2-cancel')?.click();
        return true;
    }

    const editModal = document.querySelector('.modal-edit-trans');
    if (editModal && isVisibleElement(editModal)) {
        editModal.querySelector('.cancel')?.click();
        return true;
    }

    const modal1 = document.querySelector('.modal-1');
    if (modal1 && isVisibleElement(modal1)) {
        modal1.querySelector('.cancel')?.click();
        return true;
    }

    return false;
}

export function enhanceInteractiveAccessibility(root = document) {
    if (!root) return;

    const clickableSelector = [
        'i[onclick]',
        '.user-preview',
        '.user-preview-modal',
        '.record',
        '.modal-2-cancel',
        '.prof[onclick]'
    ].join(', ');

    root.querySelectorAll(clickableSelector).forEach((element) => {
        if (element.matches('button, input, select, textarea, a[href]')) return;

        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('data-keyboard-clickable', 'true');
    });
}

let keyboardUXInitialized = false;

function initializeKeyboardUX() {
    if (keyboardUXInitialized) return;
    keyboardUXInitialized = true;

    enhanceInteractiveAccessibility(document);

    document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented) return;

        if (!event.altKey && !event.ctrlKey && !event.metaKey) {
            if (triggerAccessibleClick(event)) {
                return;
            }

            if (event.key === 'Escape' && closeTopInteractiveLayer()) {
                return;
            }
        }

        if (event.key !== 'Enter' || event.altKey || event.metaKey) return;

        const container = event.target.closest(
            '.new-record-window, .new-user-window, .edit-record-window, .login-container, .modal-export-advanced__panel, .feedback-form'
        );

        if (!container) return;
        handleEnterAsNextField(event, container);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeKeyboardUX, { once: true });
} else {
    initializeKeyboardUX();
}

/**
 * بارگذاری پویای ماژول‌های آفلاین
 */
async function loadOfflineModules() {
    if (offlineModulesLoaded) return true;
    if (offlineModulesLoading) {
        // منتظر بمانیم تا بارگذاری در حال انجام تمام شود
        while (offlineModulesLoading) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return offlineModulesLoaded;
    }
    
    offlineModulesLoading = true;
    try {
        const offlineModule = await import('./offline-db.js');
        const syncModule = await import('./sync-manager.js');
        offlineDB = offlineModule.offlineDB;
        syncManager = syncModule.syncManager;
        offlineModulesLoaded = true;
        console.log('✅ ماژول‌های آفلاین با موفقیت بارگذاری شدند.');
        return true;
    } catch (error) {
        console.warn('⚠️ ماژول‌های آفلاین بارگذاری نشدند. برنامه در حالت آنلاین-فقط اجرا می‌شود.', error);
        offlineModulesLoaded = false;
        return false;
    } finally {
        offlineModulesLoading = false;
    }
}



// ========== وضعیت شبکه ==========
window.addEventListener('online', () => {
    isOnline = true;
    console.log('[Network] آنلاین');
    if (currentOwnerUid) {
        syncManager.syncWithFirestore(currentOwnerUid);
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('[Network] آفلاین');
});

// ========== احراز هویت (با پشتیبانی آفلاین) ==========
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
            
            // ۱. تلاش برای بارگذاری ماژول‌های آفلاین (اگر هنوز بارگذاری نشده‌اند)
            await loadOfflineModules();
            
            // ۲. اطمینان از وجود سند مالک در Firestore (با مدیریت خطا)
            try {
                const ownerRef = doc(db, "merchants", currentOwnerUid);
                const ownerSnap = await getDoc(ownerRef);
                if (!ownerSnap.exists()) {
                    await setDoc(ownerRef, {
                        ownerName: user.email || "مالک",
                        email: user.email,
                        createdAt: new Date().toISOString()
                    });
                    console.log("📄 سند مالک جدید در Firestore ایجاد شد.");
                }
            } catch (error) {
                console.warn("⚠️ خطا در بررسی/ایجاد سند مالک در Firestore:", error.message);
                // در حالت آفلاین این خطا قابل چشم‌پوشی است.
            }
            
            // ۳. راه‌اندازی همگام‌ساز (اگر ماژول‌ها بارگذاری شده باشند)
            if (syncManager) {
                syncManager.startMonitoring(currentOwnerUid);
            }
            
            // ۴. تعیین وضعیت شبکه و بارگذاری اولیه داده‌ها
            const isOnline = navigator.onLine;
            
            if (syncManager) {
                // ارسال وضعیت اولیه به UI (اگر syncManager وجود دارد)
                syncManager.notifyStatus({
                    state: isOnline ? 'online' : 'offline',
                    message: isOnline ? 'آنلاین' : 'آفلاین'
                });
            }
            
            // ۵. اگر آنلاین هستیم، داده‌ها را از Firestore دریافت کرده و کش را به‌روز کنیم
            if (isOnline) {
                try {
                    if (syncManager) {
                        // اگر همگام‌ساز فعال است، از متد pull آن استفاده کن
                        await syncManager.pullLatestFromFirestore(currentOwnerUid);
                        console.log("🔄 داده‌ها از Firestore بارگذاری و در کش IndexedDB ذخیره شدند.");
                    } else {
                        // در غیر این صورت، مستقیماً از Firestore بخوان (حالت آنلاین-فقط)
                        const customersRef = collection(db, "merchants", currentOwnerUid, "customers");
                        const snapshot = await getDocs(query(customersRef));
                        const customers = [];
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            customers.push({
                                id: doc.id,
                                user_id: doc.id,
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
                        appDataCache = { customers };
                    }
                } catch (error) {
                    console.warn("⚠️ خطا در بارگذاری اولیه از Firestore:", error.message);
                    // اگر خطا رخ داد (مثلاً قطعی ناگهانی)، سعی می‌کنیم از کش IndexedDB استفاده کنیم
                    if (offlineDB) {
                        try {
                            const cached = await offlineDB.getCachedCustomers(currentOwnerUid);
                            if (cached.length > 0) {
                                appDataCache = { customers: cached };
                                console.log("💾 داده‌ها از کش IndexedDB بارگذاری شدند.");
                            }
                        } catch (cacheError) {
                            console.error("خطا در خواندن کش:", cacheError);
                        }
                    }
                }
            } else {
                // آفلاین: فقط از کش IndexedDB استفاده کن
                console.log("📴 کاربر آفلاین است. استفاده از داده‌های کش شده...");
                if (offlineDB) {
                    try {
                        const cached = await offlineDB.getCachedCustomers(currentOwnerUid);
                        if (cached.length > 0) {
                            appDataCache = { customers: cached };
                        } else {
                            appDataCache = { customers: [] };
                            console.warn("هیچ داده کش‌شده‌ای یافت نشد.");
                        }
                    } catch (error) {
                        console.error("خطا در خواندن کش آفلاین:", error);
                        appDataCache = { customers: [] };
                    }
                } else {
                    appDataCache = { customers: [] };
                }
            }
            
            // ۶. فراخوانی callback برای اطلاع‌رسانی به صفحه
            callback(true, currentOwnerUid);
            
        } else {
            // ۷. کاربر خارج شده است - پاکسازی
            if (currentOwnerUid) {
                if (offlineDB) {
                    try {
                        await offlineDB.clearOwnerData(currentOwnerUid);
                        console.log("🧹 داده‌های آفلاین کاربر پاکسازی شد.");
                    } catch (error) {
                        console.error("خطا در پاکسازی داده‌های آفلاین:", error);
                    }
                }
                if (syncManager) {
                    syncManager.stopMonitoring();
                }
            }
            
            // بازنشانی متغیرهای سراسری
            currentOwnerUid = null;
            appDataCache = null;
            if (customersUnsubscribe) {
                customersUnsubscribe();
                customersUnsubscribe = null;
            }
            
            // ۸. اطلاع‌رسانی خروج به صفحه
            callback(false, null);
        }
    });
}

// ========== لود داده‌ها (نسخه آفلاین-اول) ==========
export async function loadData() {
    if (!currentOwnerUid) {
        console.warn("کاربر وارد نشده است");
        return { customers: [] };
    }

    // اگر آفلاین هستیم یا کش موجود است، از کش بخوان
    const cachedCustomers = await offlineDB.getCachedCustomers(currentOwnerUid);
    
    if (!navigator.onLine) {
        // حالت آفلاین: فقط از کش استفاده کن
        console.log('[Offline] استفاده از داده‌های کش شده');
        const result = { customers: cachedCustomers };
        appDataCache = result;
        return result;
    }
    
    // حالت آنلاین: تلاش برای دریافت از Firestore
    try {
        const customers = await syncManager.pullLatestFromFirestore(currentOwnerUid);
        const result = { customers };
        appDataCache = result;
        
        // راه‌اندازی شنود لحظه‌ای (اگر قبلاً نبود)
        if (!customersUnsubscribe) {
            setupRealtimeListener();
        }
        
        return result;
    } catch (error) {
        console.error('[Firestore] خطا در دریافت داده، استفاده از کش:', error);
        const result = { customers: cachedCustomers };
        appDataCache = result;
        return result;
    }
}

// تنظیم شنود لحظه‌ای Firestore (برای به‌روزرسانی خودکار کش)
function setupRealtimeListener() {
    if (!currentOwnerUid) return;
    
    const customersRef = collection(db, "merchants", currentOwnerUid, "customers");
    const q = query(customersRef);
    
    customersUnsubscribe = onSnapshot(q, async (snapshot) => {
        const customers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            customers.push({
                id: doc.id,
                user_id: doc.id,
                name: data.name,
                prof: data.prof,
                cash: data.cash || [],
                currencies_total: data.currencies_total || {},
                description: data.description || "",
                phone_num: data.phone_num || "",
                telegram_id: data.telegram_id || "",
                bookAddress: data.bookAddress || "",
                _lastModified: data._lastModified || new Date().toISOString()
            });
        });
        
        // به‌روزرسانی کش
        await offlineDB.cacheCustomers(currentOwnerUid, customers);
        await offlineDB.setLastSyncTime(currentOwnerUid, new Date().toISOString());
        
        // به‌روزرسانی کش حافظه
        appDataCache = { customers };
        
        // فراخوانی callbackهای watchUserData (اگر وجود داشته باشد)
        if (window._dataChangeCallbacks) {
            window._dataChangeCallbacks.forEach(cb => cb(appDataCache));
        }
    }, (error) => {
        console.error('[Firestore] خطا در شنود:', error);
    });
}

// ========== ذخیره تغییرات (نسخه آفلاین-اول) ==========
export async function saveData(appData) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است");
    const customers = appData.customers;
    if (!Array.isArray(customers)) {
        throw new Error("داده نامعتبر: customers باید آرایه باشد");
    }

    // به‌روزرسانی کش حافظه
    appDataCache = appData;

    // بارگذاری ماژول‌های آفلاین در صورت نیاز
    await loadOfflineModules();

    for (const customer of customers) {
        // استخراج شناسه معتبر (پشتیبانی از id و user_id)
        const customerId = customer.id || customer.user_id;
        if (!customerId) {
            console.error('مشتری بدون شناسه معتبر یافت شد:', customer);
            continue;
        }

        // اطمینان از وجود فیلد id در خود آبجکت (برای سازگاری)
        const normalizedCustomer = {
            ...customer,
            id: customerId,
            _lastModified: new Date().toISOString()
        };

        if (syncManager) {
            await syncManager.applyLocalChange(
                currentOwnerUid,
                'update', // می‌توان بعداً تشخیص create یا update را اضافه کرد
                customerId,
                normalizedCustomer
            );
        } else {
            // اگر syncManager در دسترس نیست (مثلاً آفلاین و ماژول بارگذاری نشده)
            // مستقیماً در کش ذخیره کن
            if (offlineDB) {
                await offlineDB.updateCustomerInCache(currentOwnerUid, customerId, normalizedCustomer);
            }
        }
    }
}

// ========== توابع مدیریت مشتریان (با پشتیبانی آفلاین) ==========

export async function addTransaction(customerId, transaction) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است.");
    
    // ابتدا مشتری را از کش یا Firestore دریافت کن
    const appData = await loadData();
    const customer = appData.customers.find(c => c.id === customerId);
    if (!customer) throw new Error("مشتری یافت نشد.");
    
    // به‌روزرسانی تراکنش‌ها
    const cash = [...(customer.cash || []), transaction];
    const totals = { ...(customer.currencies_total || {}) };
    const amt = Number(transaction.amount);
    const cur = transaction.currency;
    totals[cur] = (totals[cur] || 0) + amt;
    if (totals[cur] === 0) delete totals[cur];
    
    const updatedCustomer = {
        ...customer,
        cash,
        currencies_total: totals,
        _lastModified: new Date().toISOString()
    };
    
    // اعمال تغییر محلی (کش + صف در صورت آفلاین)
    await syncManager.applyLocalChange(currentOwnerUid, 'update', customerId, updatedCustomer);
    
    // به‌روزرسانی کش حافظه
    if (appDataCache) {
        const index = appDataCache.customers.findIndex(c => c.id === customerId);
        if (index !== -1) appDataCache.customers[index] = updatedCustomer;
    }
}

export async function updateTransaction(sourceCustomerId, oldTransaction, newTransaction, targetCustomerId = null) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است.");
    
    const appData = await loadData();
    const isSame = !targetCustomerId || targetCustomerId === sourceCustomerId;
    
    if (isSame) {
        const customer = appData.customers.find(c => c.id === sourceCustomerId);
        if (!customer) throw new Error("مشتری مبدأ یافت نشد.");
        
        // حذف تراکنش قدیمی
        let cash = customer.cash.filter(t => 
            !(t.amount === oldTransaction.amount && 
              t.currency === oldTransaction.currency && 
              t.trans_date === oldTransaction.trans_date && 
              t.description === oldTransaction.description && 
              t.state === oldTransaction.state)
        );
        
        // افزودن تراکنش جدید
        cash.push(newTransaction);
        
        // محاسبه مجدد totals
        const totals = {};
        cash.forEach(t => {
            const amt = Number(t.amount);
            totals[t.currency] = (totals[t.currency] || 0) + amt;
        });
        
        const updatedCustomer = {
            ...customer,
            cash,
            currencies_total: totals,
            _lastModified: new Date().toISOString()
        };
        
        await syncManager.applyLocalChange(currentOwnerUid, 'update', sourceCustomerId, updatedCustomer);
        
    } else {
        // انتقال بین دو مشتری
        const sourceCustomer = appData.customers.find(c => c.id === sourceCustomerId);
        const targetCustomer = appData.customers.find(c => c.id === targetCustomerId);
        if (!sourceCustomer || !targetCustomer) throw new Error("مشتری یافت نشد.");
        
        // حذف از مبدأ
        const sourceCash = sourceCustomer.cash.filter(t => 
            !(t.amount === oldTransaction.amount && 
              t.currency === oldTransaction.currency && 
              t.trans_date === oldTransaction.trans_date && 
              t.description === oldTransaction.description && 
              t.state === oldTransaction.state)
        );
        const sourceTotals = {};
        sourceCash.forEach(t => {
            const amt = Number(t.amount);
            sourceTotals[t.currency] = (sourceTotals[t.currency] || 0) + amt;
        });
        
        // افزودن به مقصد
        const targetCash = [...targetCustomer.cash, newTransaction];
        const targetTotals = { ...targetCustomer.currencies_total };
        const newAmt = Number(newTransaction.amount);
        targetTotals[newTransaction.currency] = (targetTotals[newTransaction.currency] || 0) + newAmt;
        
        const updatedSource = { ...sourceCustomer, cash: sourceCash, currencies_total: sourceTotals, _lastModified: new Date().toISOString() };
        const updatedTarget = { ...targetCustomer, cash: targetCash, currencies_total: targetTotals, _lastModified: new Date().toISOString() };
        
        await syncManager.applyLocalChange(currentOwnerUid, 'update', sourceCustomerId, updatedSource);
        await syncManager.applyLocalChange(currentOwnerUid, 'update', targetCustomerId, updatedTarget);
    }
}

export async function deleteTransaction(customerId, transaction) {
    if (!currentOwnerUid) throw new Error("کاربر وارد نشده است.");
    
    const appData = await loadData();
    const customer = appData.customers.find(c => c.id === customerId);
    if (!customer) throw new Error("مشتری یافت نشد.");
    
    const cash = customer.cash.filter(t => 
        !(t.amount === transaction.amount && 
          t.currency === transaction.currency && 
          t.trans_date === transaction.trans_date && 
          t.description === transaction.description && 
          t.state === transaction.state)
    );
    
    const totals = {};
    cash.forEach(t => {
        const amt = Number(t.amount);
        totals[t.currency] = (totals[t.currency] || 0) + amt;
    });
    
    const updatedCustomer = {
        ...customer,
        cash,
        currencies_total: totals,
        _lastModified: new Date().toISOString()
    };
    
    await syncManager.applyLocalChange(currentOwnerUid, 'update', customerId, updatedCustomer);
}

// ========== watchUserData (نسخه بهبودیافته) ==========
export function watchUserData(callback) {
    if (!currentOwnerUid) {
        console.warn("شنود ممکن نیست: کاربر وارد نشده است.");
        callback({ customers: [] });
        return () => {};
    }

    // ثبت callback برای به‌روزرسانی‌های آتی
    if (!window._dataChangeCallbacks) {
        window._dataChangeCallbacks = [];
    }
    window._dataChangeCallbacks.push(callback);
    
    // اگر کش حافظه موجود است، فوراً فراخوانی کن
    if (appDataCache) {
        callback(appDataCache);
    } else {
        // در غیر این صورت داده‌ها را لود کن
        loadData().then(data => callback(data));
    }
    
    // راه‌اندازی شنود Firestore اگر قبلاً نبود
    if (!customersUnsubscribe && navigator.onLine) {
        setupRealtimeListener();
    }
    
    // برگرداندن تابع لغو اشتراک
    return () => {
        const index = window._dataChangeCallbacks.indexOf(callback);
        if (index > -1) window._dataChangeCallbacks.splice(index, 1);
        if (window._dataChangeCallbacks.length === 0 && customersUnsubscribe) {
            customersUnsubscribe();
            customersUnsubscribe = null;
        }
    };
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
//جلوگیری از هک
export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

//جمع کل ارز
export function sumByCurrency(user, targetCurrency) {
    return user.cash
        .filter(t => t.currency === targetCurrency)
        .reduce((sum, t) => sum + t.amount, 0);
}

//انتقالات

export function go_settings() {
    window.location.href = 'settings.html';
}

export function go_users() {
    window.location.href = `users-page.html`;
}

export function go_home() {
    window.location.href = `home-complete.html`;
}


// ========== توابع مودال‌ها ==========

export function show_new_record_window() {
    document.querySelector(".modal-1").style.display = 'flex';
    enhanceInteractiveAccessibility(document.querySelector('.modal-1'));
    setTimeout(() => {
        focusFirstField(document.querySelector('.new-record-window'));
    }, 0);
}

export async function show_modal_2() {
    
    const modal_edit = document.querySelector('.modal-edit-trans');
    if (modal_edit) modal_edit.style.display = 'none';
    document.querySelector('.modal-1').style.display = 'none';
    document.querySelector('.modal-2').style.display = 'flex';
    await renderUsers_onModal();
    enhanceInteractiveAccessibility(document.querySelector('.modal-2'));
    setTimeout(() => {
        const searchInput = document.querySelector('.modal-2 .searchBox');
        if (searchInput) focusField(searchInput);
    }, 0);
}

export function close_new_record_window() {
    document.querySelector(".modal-1").style.display = 'none';
    if (record_window) {
        record_window.querySelector('.description').value = '';
        record_window.querySelector('.amount').value = '';
        record_window.querySelector('.currency').value = '';
        record_window.querySelectorAll('input[name="transaction-type"]').forEach((input) => {
            input.checked = false;
        });
        record_window.querySelectorAll('input[name="send-channel"]').forEach((input) => {
            input.checked = false;
        });
        const profImg = record_window.querySelector('.prof');
        if (profImg) profImg.src = './prof/img.JPG';
        const nameElem = record_window.querySelector('.record-info .name');
        if (nameElem) nameElem.textContent = 'حساب را انتخاب کنید';
        updateRecordSendOptions(null);
    }
}

function updateRecordSendOptions(user) {
    if (!record_window) return;

    const sendOptions = record_window.querySelector('.send-options');
    const telegramOption = record_window.querySelector('.send-telegram');
    const whatsappOption = record_window.querySelector('.send-whatsapp');
    const telegramInput = record_window.querySelector('input[name="send-channel"][value="telegram"]');
    const whatsappInput = record_window.querySelector('input[name="send-channel"][value="whatsapp"]');
    if (!sendOptions || !telegramOption || !whatsappOption || !telegramInput || !whatsappInput) return;

    const hasTelegram = Boolean((user?.telegram_id || '').trim());
    const hasWhatsApp = Boolean((user?.phone_num || '').replace(/\D/g, ''));

    telegramOption.classList.toggle('hidden', !hasTelegram);
    whatsappOption.classList.toggle('hidden', !hasWhatsApp);
    sendOptions.classList.toggle('hidden', !hasTelegram && !hasWhatsApp);

    if (!hasTelegram) telegramInput.checked = false;
    if (!hasWhatsApp) whatsappInput.checked = false;
}

export function close_modal_2() {
    document.querySelector('.modal-2').style.display = 'none';

    const editModal = document.querySelector('.modal-edit-trans');
    if (editModal && editModal.style.display === 'none') {
        editModal.style.display = 'flex';
        setTimeout(() => {
            focusFirstField(editModal.querySelector('.edit-record-window'));
        }, 0);
        return;
    }

    const modal1 = document.querySelector('.modal-1');
    if (modal1 && modal1.style.display === 'none' && !(editModal && isVisibleElement(editModal))) {
        modal1.style.display = 'flex';
        setTimeout(() => {
            focusFirstField(modal1.querySelector('.new-record-window, .new-user-window'));
        }, 0);
    }
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
        updateRecordSendOptions(user);
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

    enhanceInteractiveAccessibility(container);
}

// تابع کمکی: با زدن Enter به فیلد بعدی برود
function setupEnterToNextField(formContainerSelector) {
    const container = document.querySelector(formContainerSelector);
    if (!container) return;

    container.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        handleEnterAsNextField(event, container);
    });
}

/**
 * نمایش تراکنش‌های امروز در صفحه اصلی
 */
export async function render_rec() {
    const loader = document.querySelector(".loader");  
    if (loader && loader.style.display !== "inline-block") {
        loader.style.display = "inline-block";
    }
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
    });

    if (!hasAny) {
        container.innerHTML = '<p class="alert" style="color:white; text-align:center;">هیچ تراکنشی برای امروز ثبت نشده است</p>';
    }
    render_top_box(total_currencies);
    enhanceInteractiveAccessibility(container);
}

//اضافه کردن تراکنش
export async function add_record() {
    const loader = document.querySelector(".loader");
    if (record_window && record_window.style.display !== 'none') {
        record_window.style.display = 'none';
    }
    if (loader && loader.style.display !== "inline-block") {
        loader.style.display = "inline-block";
    }
    const customerId = sessionStorage.getItem('currentUserId');
    if (!customerId) {
        alert('ابتدا یک مشتری انتخاب کنید.');
        return;
    }
    if (!currentOwnerUid) {
        alert('کاربر وارد نشده است');
        return;
    }

    const description = record_window.querySelector('.description').value;
    const amount = record_window.querySelector('.amount').value;
    const currency = record_window.querySelector('.currency').value;
    const stateElement = document.querySelector('input[name="transaction-type"]:checked');
    const sendChannelElement = record_window.querySelector('input[name="send-channel"]:checked');
    const state = stateElement ? stateElement.value : '';
    let messageWindow = null;

    if (!description || !amount || !currency || !state) {
        alert('لطفاً همه فیلدها را پر کنید.');
        return;
    }

    if (sendChannelElement) {
        messageWindow = window.open('', '_blank');
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
        await addTransaction(customerId, transaction);  // ← استفاده از تابع جدید آفلاین-اول
        const appData = await loadData();
        const selectedUser = appData.customers.find((customer) => (customer.id || customer.user_id) == customerId);
        if (selectedUser && sendChannelElement) {
            const messagingModule = await import('./usefull.js');
            if (sendChannelElement.value === 'telegram') {
                messagingModule.sendToTelegram(selectedUser, transaction, messageWindow);
            } else if (sendChannelElement.value === 'whatsapp') {
                messagingModule.sendToWhatsApp(selectedUser, transaction, messageWindow);
            }
        }
        close_new_record_window();
        // UI توسط watchUserData به‌روز می‌شود
    } catch (error) {
        console.error("خطا در افزودن تراکنش:", error);
        alert("خطا در ثبت تراکنش. لطفاً دوباره تلاش کنید.");
    }
    record_window.style.display = 'grid';
}
//on and off
export function onSyncStatusChange(callback) {
    if (typeof callback !== 'function') return;
    
    if (syncManager) {
        // اگر syncManager از قبل آماده است، مستقیم ثبت کن
        syncManager.addStatusListener(callback);
    } else {
        // در غیر این صورت، callback را در صف ذخیره کن
        pendingSyncStatusCallbacks.push(callback);
        console.log('⏳ syncManager هنوز آماده نیست، callback در صف ذخیره شد.');
        
        // تلاش برای بارگذاری ماژول‌ها (اگر قبلاً شروع نشده)
        loadOfflineModules().then(() => {
            // پس از بارگذاری، تمام callback‌های در انتظار را ثبت کن
            if (syncManager) {
                pendingSyncStatusCallbacks.forEach(cb => {
                    syncManager.addStatusListener(cb);
                });
                pendingSyncStatusCallbacks.length = 0; // خالی کردن صف
            }
        });
    }
}
