// sync-manager.js
import { db } from './firebase-config.js';
import {
    collection, doc, getDoc, setDoc, deleteDoc,
    getDocs, query
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { offlineDB } from './offline-db.js';

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
        this.listeners = [];
        this.currentOwnerUid = null;
    }

    startMonitoring(ownerUid) {
        this.currentOwnerUid = ownerUid;

        const isOnlineNow = navigator.onLine;
        this.notifyStatus({
            state: isOnlineNow ? 'online' : 'offline',
            message: isOnlineNow ? 'آنلاین' : 'آفلاین'
        });

        window.addEventListener('online', () => {
            console.log('[Sync] رویداد online');
            this.notifyStatus({ state: 'online', message: 'آنلاین' });
            this.syncWithFirestore(this.currentOwnerUid);
        });

        window.addEventListener('offline', () => {
            console.log('[Sync] رویداد offline');
            this.notifyStatus({ state: 'offline', message: 'آفلاین' });
        });

        this.syncInterval = setInterval(async () => {
            if (navigator.onLine && this.currentOwnerUid) {
                const pending = await offlineDB.getPendingChanges(this.currentOwnerUid);
                if (pending.length > 0) {
                    await this.syncWithFirestore(this.currentOwnerUid);
                }
            }
        }, 30000);
    }

    stopMonitoring() {
        this.currentOwnerUid = null;
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    addStatusListener(callback) {
        this.listeners.push(callback);
    }

    notifyStatus(status) {
        this.listeners.forEach(cb => cb(status));
    }

    isOversizedProfileData(value) {
        return typeof value === 'string'
            && value.startsWith('data:image/')
            && value.length > 900000;
    }

    async syncWithFirestore(ownerUid) {
        if (!ownerUid || this.isSyncing) return;
        if (!navigator.onLine) {
            this.notifyStatus({ state: 'offline', message: 'آفلاین' });
            return;
        }

        this.isSyncing = true;
        this.notifyStatus({ state: 'syncing', message: 'در حال همگام‌سازی...' });

        try {
            const pendingChanges = await offlineDB.getPendingChanges(ownerUid);
            if (pendingChanges.length === 0) {
                await this.pullLatestFromFirestore(ownerUid);
                this.notifyStatus({ state: 'online', message: 'آنلاین' });
                return;
            }

            const latestDeletes = new Map();
            for (const change of pendingChanges) {
                if (change.operation === 'delete') {
                    latestDeletes.set(change.customerId, change.localId);
                }
            }

            for (const change of pendingChanges) {
                try {
                    if (
                        change.operation !== 'delete'
                        && latestDeletes.has(change.customerId)
                        && latestDeletes.get(change.customerId) > change.localId
                    ) {
                        await offlineDB.markChangeSynced(change.localId);
                        continue;
                    }

                    await this.applyChangeToFirestore(ownerUid, change);
                    await offlineDB.markChangeSynced(change.localId);
                } catch (error) {
                    console.error(`[Sync] خطا در اعمال تغییر ${change.localId}:`, error);
                    await offlineDB.pendingChanges.update(change.localId, {
                        retryCount: (change.retryCount || 0) + 1
                    });
                }
            }

            await this.pullLatestFromFirestore(ownerUid);
            await offlineDB.cleanupSyncedChanges();
            this.notifyStatus({ state: 'online', message: 'آنلاین' });
        } catch (error) {
            console.error('[Sync] خطای کلی:', error);
            this.notifyStatus({ state: 'error', message: 'خطا در همگام‌سازی' });
        } finally {
            this.isSyncing = false;
        }
    }

    async pullLatestFromFirestore(ownerUid) {
        const customersRef = collection(db, "merchants", ownerUid, "customers");
        const snapshot = await getDocs(query(customersRef));
        const customers = [];
        snapshot.forEach(item => {
            const data = item.data();
            customers.push({
                id: item.id,
                user_id: item.id,
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

        await offlineDB.cacheCustomers(ownerUid, customers);
        await offlineDB.setLastSyncTime(ownerUid, new Date().toISOString());
        return customers;
    }

    async applyChangeToFirestore(ownerUid, change) {
        const { operation, customerId, data } = change;
        const customerRef = doc(db, "merchants", ownerUid, "customers", customerId);

        switch (operation) {
            case 'create':
            case 'update': {
                if (this.isOversizedProfileData(data?.prof)) {
                    throw new Error('Profile image is still stored as base64 and exceeds Firestore limits');
                }

                const currentSnap = await getDoc(customerRef);
                const serverData = currentSnap.exists() ? currentSnap.data() : null;

                const localModified = data?._lastModified || change.timestamp;
                const serverModified = serverData?._lastModified;

                let finalData;
                if (serverData && serverModified && localModified < serverModified) {
                    finalData = serverData;
                } else {
                    finalData = { ...data, _lastModified: new Date().toISOString() };
                    delete finalData.id;
                    delete finalData.user_id;
                    delete finalData.ownerUid;
                }

                await setDoc(customerRef, finalData, { merge: true });
                break;
            }
            case 'delete':
                if ((await getDoc(customerRef)).exists()) {
                    await deleteDoc(customerRef);
                }
                break;
        }
    }

    async applyLocalChange(ownerUid, operation, customerId, customerData) {
        if (!ownerUid) throw new Error('ownerUid نامعتبر');
        if (!customerId) throw new Error('customerId نامعتبر');

        if (operation === 'delete') {
            await offlineDB.deleteCustomerFromCache(customerId);
            await offlineDB.removePendingChangesForCustomer(ownerUid, customerId);
        } else {
            await offlineDB.updateCustomerInCache(ownerUid, customerId, customerData);
        }

        if (navigator.onLine) {
            try {
                await this.applyChangeToFirestore(ownerUid, {
                    operation,
                    customerId,
                    data: customerData,
                    timestamp: new Date().toISOString()
                });
                await this.pullLatestFromFirestore(ownerUid);
            } catch (error) {
                console.error('[Sync] خطا در اعمال مستقیم، ذخیره در صف:', error);
                if (operation === 'delete') {
                    await offlineDB.replacePendingChangesForCustomer(ownerUid, customerId, operation, null);
                } else {
                    await offlineDB.addPendingChange(ownerUid, operation, customerId, customerData);
                }
                this.notifyStatus({ state: 'offline', message: 'تغییر ذخیره شد، منتظر اتصال' });
            }
        } else {
            if (operation === 'delete') {
                await offlineDB.replacePendingChangesForCustomer(ownerUid, customerId, operation, null);
            } else {
                await offlineDB.addPendingChange(ownerUid, operation, customerId, customerData);
            }
            this.notifyStatus({ state: 'offline', message: 'تغییر ذخیره شد، منتظر اتصال' });
        }
    }
}

export const syncManager = new SyncManager();
