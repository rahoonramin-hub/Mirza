// offline-db.js (اصلاح‌شده)
import Dexie from 'https://cdn.skypack.dev/dexie';

class OfflineDB extends Dexie {
    constructor() {
        super('MirzaOfflineDB');
        
        this.version(1).stores({
            customers: 'id, ownerUid, _lastModified',
            pendingChanges: '++localId, ownerUid, customerId, operation, timestamp',
            syncMeta: 'key'
        });
        
        this.customers = this.table('customers');
        this.pendingChanges = this.table('pendingChanges');
        this.syncMeta = this.table('syncMeta');
    }

    // ذخیره مشتریان در کش (نسخه اصلاح‌شده)
    async cacheCustomers(ownerUid, customersArray) {
        const now = new Date().toISOString();
        
        // ۱. حذف تمام رکوردهای قبلی این مالک
        await this.customers.where('ownerUid').equals(ownerUid).delete();
        
        // ۲. اطمینان از اینکه customersArray آرایه است
        if (!Array.isArray(customersArray)) {
            console.warn('cacheCustomers: customersArray آرایه نیست');
            return;
        }
        
        // ۳. آماده‌سازی داده‌ها
        const toAdd = customersArray.map(c => ({
            ...c,
            ownerUid: ownerUid,
            _lastModified: c._lastModified || now
        }));
        
        // ۴. استفاده از bulkPut به جای bulkAdd (در صورت وجود کلید تکراری، بازنویسی می‌کند)
        try {
            await this.customers.bulkPut(toAdd);
        } catch (error) {
            console.error('خطا در bulkPut مشتریان:', error);
            // اگر باز هم خطا داد، تلاش مجدد با قرار دادن تکی
            for (const customer of toAdd) {
                try {
                    await this.customers.put(customer);
                } catch (e) {
                    console.error(`خطا در ذخیره مشتری ${customer.id}:`, e);
                }
            }
        }
    }

    // سایر متدها بدون تغییر...
    async getCachedCustomers(ownerUid) {
        return await this.customers.where('ownerUid').equals(ownerUid).toArray();
    }

    async updateCustomerInCache(ownerUid, customerId, updates) {
        if (!ownerUid) throw new Error('ownerUid نامعتبر است');
        if (!customerId) throw new Error('customerId نامعتبر است');
        if (!updates || typeof updates !== 'object') throw new Error('updates نامعتبر است');
    
        try {
            const customer = await this.customers.get(customerId);
            if (!customer || customer.ownerUid !== ownerUid) {
                await this.customers.put({
                    ...updates,
                    id: customerId,
                    ownerUid: ownerUid,
                    _lastModified: new Date().toISOString()
                });
            } else {
                await this.customers.update(customerId, {
                    ...updates,
                    _lastModified: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('خطا در updateCustomerInCache:', error);
            throw error;
        }
    }

    async deleteCustomerFromCache(customerId) {
        await this.customers.delete(customerId);
    }

    async addPendingChange(ownerUid, operation, customerId, data) {
        await this.pendingChanges.add({
            ownerUid: ownerUid,
            operation: operation,
            customerId: customerId,
            data: data,
            timestamp: new Date().toISOString(),
            synced: false,
            retryCount: 0
        });
    }

    async removePendingChangesForCustomer(ownerUid, customerId) {
        const changes = await this.pendingChanges
            .where('ownerUid').equals(ownerUid)
            .filter(change => change.customerId === customerId)
            .toArray();

        if (changes.length === 0) return;
        await this.pendingChanges.bulkDelete(changes.map(change => change.localId));
    }

    async replacePendingChangesForCustomer(ownerUid, customerId, operation, data) {
        await this.removePendingChangesForCustomer(ownerUid, customerId);
        await this.addPendingChange(ownerUid, operation, customerId, data);
    }

    async getPendingChanges(ownerUid) {
        return await this.pendingChanges
            .where('ownerUid').equals(ownerUid)
            .and(change => !change.synced)
            .sortBy('timestamp');
    }

    async markChangeSynced(localId) {
        await this.pendingChanges.update(localId, { synced: true });
    }

    async cleanupSyncedChanges() {
        await this.pendingChanges.where('synced').equals(true).delete();
    }

    async setLastSyncTime(ownerUid, time) {
        await this.syncMeta.put({ key: `lastSync_${ownerUid}`, value: time });
    }

    async getLastSyncTime(ownerUid) {
        const meta = await this.syncMeta.get(`lastSync_${ownerUid}`);
        return meta ? meta.value : null;
    }

    async clearOwnerData(ownerUid) {
        await this.customers.where('ownerUid').equals(ownerUid).delete();
        await this.pendingChanges.where('ownerUid').equals(ownerUid).delete();
        await this.syncMeta.delete(`lastSync_${ownerUid}`);
    }
}

export const offlineDB = new OfflineDB();
