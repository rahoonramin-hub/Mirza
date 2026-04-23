// users-page.js

import {
    onAuth, loadData, saveData,
    render_top_box, escapeHtml,
    go_home, calculateTotals,
    go_settings, onSyncStatusChange, enhanceInteractiveAccessibility
} from './common.js';
import { auth, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { showUserContextMenu } from './usefull.js';
import { render_search_users } from './func.js';

const loader = document.querySelector(".loader");

async function uploadProfileImage(file, userId) {
    const ownerUid = auth.currentUser?.uid;
    if (!ownerUid) throw new Error('ownerUid نامعتبر است');

    const originalName = file.name || 'profile.png';
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const extension = safeName.includes('.') ? safeName.split('.').pop() : 'png';
    const profileRef = ref(storage, `profile-images/${ownerUid}/${userId}-${Date.now()}.${extension}`);

    await uploadBytes(profileRef, file, {
        contentType: file.type || 'image/png',
        cacheControl: 'public,max-age=31536000'
    });

    return getDownloadURL(profileRef);
}

// ---------- توابع مربوط به کاربران ----------

function createUser(name, description, phone_num, telegram_id, prof, bookAddress, user_id) {
    return {
        name: name,
        telegram_id: telegram_id,
        description: description,
        phone_num: phone_num,
        prof: prof,
        user_id: user_id,
        bookAddress: bookAddress,
        cash: [],
        currencies_total: {}

    };
}

export async function renderUsers() {
    const container = document.querySelector('.user-preview-father');
    if (loader) {
        loader.style.display = "inline-block";
    }

    document.querySelector('.cash-balance').innerHTML = '';
    let total_currencies = {};
    const appData = await loadData();
    if (!appData) {
        if (loader) loader.style.display = "none";
        return;
    }
    const users = appData.customers;
    if (!container) {
        if (loader) loader.style.display = "none";
        return;
    }
    if (!users || users.length === 0) {
        container.innerHTML = '<p style="color:white; text-align:center;">هیچ کاربری وجود ندارد</p>';
        if (loader) loader.style.display = "none";
        return;
    }

    container.innerHTML = '';

    users.forEach(user => {
        const currencies = calculateTotals(user.cash);

        const userEl = document.createElement('div');
        userEl.className = 'user-preview';
        userEl.dataset.userId = user.id;

        userEl.innerHTML = `
            <img class="prof" src="${user.prof || 'isha.jpg'}">
            <div class="name-and-bookAddress">
                <p class="name">${escapeHtml(user.name)}</p>
                <p class="bookAddress">${escapeHtml(user.bookAddress || '')}</p>
            </div>
        `;

        let totalFather = document.createElement('div');
        totalFather.className = 'currencies-and-totals-5';
        if (Object.keys(currencies).length === 0) {
            if (user.cash.length === 0) totalFather.textContent = 'هنوزی ثبت نشده';
            else totalFather.textContent = 'تصفیه است';
        } else {
            Object.entries(currencies).forEach(([curr, amount]) => {
                amount = Number(amount);
                let total = document.createElement('div');
                total.className = 'currency-and-total';
                total.innerHTML = `
                    <p class="total-currency ${curr}">${curr}</p>
                    <p class="total">${amount}</p>
                `;
                totalFather.appendChild(total);
                if (total_currencies[curr]) {
                    total_currencies[curr] += amount;
                } else {
                    total_currencies[curr] = amount;
                }
            });
        }

        userEl.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showUserContextMenu(event.clientX, event.clientY, user, userEl);
        });

        let lastTap = 0;
        let tapTimeout;
        userEl.addEventListener('pointerup', (e) => {
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

        if (window.matchMedia('(pointer: fine)').matches) {
            userEl.addEventListener('click', () => {
                window.location.href = `account.html?userId=${user.id}`;
            });
        }

        container.appendChild(userEl);
        userEl.appendChild(totalFather);
    });

    render_top_box(total_currencies, users);
    enhanceInteractiveAccessibility(container);
    if (loader) loader.style.display = "none";
}

// ---------- مودال ساخت کاربر جدید ----------
function show_new_user_window() {
    document.querySelector('.modal-1').style.display = 'flex';
    enhanceInteractiveAccessibility(document.querySelector('.modal-1'));
    setTimeout(() => {
        document.querySelector('.new-user-window .name')?.focus();
    }, 0);
}

function close_new_user_window() {
    const modal = document.querySelector('.modal-1');
    modal.style.display = 'none';
    modal.querySelector('.name').value = '';
    modal.querySelector('.description').value = '';
    modal.querySelector('.telegram-id').value = '';
    modal.querySelector('.phone-num').value = '';
    modal.querySelector('.bookAddress').value = '';
    modal.querySelector('.prof').src = 'prof/img.jpg';
    modal.querySelector('.prof-input').value = '';
    const saveBtn = modal.querySelector('.save');
    saveBtn.textContent = 'ثبت';
    saveBtn.onclick = add_user;
}

function prof_input() {
    const prof = document.querySelector('.new-user-window .prof');
    const profInput = document.querySelector('.prof-input');
    profInput.click();
    profInput.onchange = () => {
        const file = profInput.files[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        prof.onload = () => URL.revokeObjectURL(previewUrl);
        prof.src = previewUrl;
    };
}

async function add_user() {
    const modal = document.querySelector('.new-user-window');
    if (!modal) return;
    modal.style.display = "none";

    const loaderEl = loader || document.querySelector('.loader');
    if (loaderEl && loaderEl.style.display === "none") { loaderEl.style.display = "block"; }

    const name = modal.querySelector('.name').value.trim();
    const description = modal.querySelector('.description').value.trim();
    const phone_num = modal.querySelector('.phone-num').value.trim();
    const telegram_id = modal.querySelector('.telegram-id').value.trim();
    const book_address = modal.querySelector('.bookAddress').value.trim();
    const file = modal.querySelector('.prof-input').files[0];

    if (!name) {
        alert('لطفاً نام را وارد کنید');
        return;
    }

    const userId = String(Date.now());
    let prof = "img.JPG";
    if (file) {
        prof = await uploadProfileImage(file, userId);
    }

    const newUser = {
        name: name,
        telegram_id: telegram_id,
        description: description,
        phone_num: phone_num,
        prof: prof,
        id: userId,
        user_id: userId,
        bookAddress: book_address,
        cash: [],
        currencies_total: {}
    };

    const appData = await loadData();
    appData.customers.push(newUser);
    await saveData(appData);

    document.querySelector('.modal-1').style.display = "none";
    await renderUsers();
    close_new_user_window();
}

function showEditUserModal(user) {
    const modal = document.querySelector('.modal-1');
    modal.querySelector('.name').value = user.name || '';
    modal.querySelector('.description').value = user.description || '';
    modal.querySelector('.phone-num').value = user.phone_num || '';
    modal.querySelector('.telegram-id').value = user.telegram_id || '';
    modal.querySelector('.bookAddress').value = user.bookAddress || '';
    modal.querySelector('.prof').src = user.prof || 'img.JPG';

    const saveBtn = modal.querySelector('.save');
    saveBtn.textContent = 'ذخیره تغییرات';
    saveBtn.onclick = async () => {
        const appData = await loadData();
        const targetUser = appData.customers.find(u => u.id == user.id);
        if (!targetUser) return;

        targetUser.name = modal.querySelector('.name').value.trim();
        targetUser.description = modal.querySelector('.description').value.trim();
        targetUser.phone_num = modal.querySelector('.phone-num').value.trim();
        targetUser.telegram_id = modal.querySelector('.telegram-id').value.trim();
        targetUser.bookAddress = modal.querySelector('.bookAddress').value.trim();

        const profInput = modal.querySelector('.prof-input');
        if (profInput.files.length > 0) {
            const file = profInput.files[0];
            targetUser.prof = await uploadProfileImage(
                file,
                targetUser.id || targetUser.user_id || String(Date.now())
            );
        }

        await saveData(appData);
        close_new_user_window();
        await renderUsers();

        saveBtn.textContent = 'ثبت';
        saveBtn.onclick = add_user;
    };

    modal.style.display = 'flex';
    enhanceInteractiveAccessibility(modal);
    setTimeout(() => {
        modal.querySelector('.name')?.focus();
    }, 0);
}

// ---------- راه‌اندازی صفحه ----------
onAuth(async (isLoggedIn) => {
    if (isLoggedIn) {
        onSyncStatusChange(updateSyncStatusUI);
        await renderUsers();
        if (loader) { loader.style.display = "none"; }

        const searchBox = document.querySelector('.top-box .searchBox');
        if (searchBox) {
            searchBox.addEventListener('input', async (e) => {
                await render_search_users(e.target.value);
            });
        }

        window.show_new_user_window = show_new_user_window;
        window.close_new_user_window = close_new_user_window;
        window.add_user = add_user;
        window.prof_input = prof_input;
        window.showEditUserModal = showEditUserModal;
        window.go_home = () => window.location.href = 'home-complete.html';

        document.querySelector('.fa-plus')?.addEventListener('click', show_new_user_window);
        document.querySelector('.fa-house')?.addEventListener('click', go_home);
        const gearBTN = document.querySelector('.fa-gear');
        if (gearBTN) gearBTN.addEventListener("click", go_settings);

        onSyncStatusChange(status => {
            const el = document.getElementById('sync-status');
            if (el) {
                el.textContent = status.message;
                el.className = `sync-status ${status.state}`;
            }
        });

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

onSyncStatusChange(status => {
    const el = document.getElementById('sync-status');
    if (el) {
        el.textContent = status.message;
        el.className = `sync-status ${status.state}`;
    }
});

window.renderUsers = renderUsers;