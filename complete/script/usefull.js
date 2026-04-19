import { loadData, saveData } from "./common.js";


// ====================== usefull.js ======================
// شامل توابع کاربردی: اشتراک‌گذاری، خروجی پیشرفته، پشتیبان‌گیری، ارسال به تلگرام و...

// ---------- ۱. اشتراک‌گذاری تراکنش (واتساپ/تلگرام و ...) ----------
export async function shareTransaction(user, transaction) {
    const shareText = `🧾 تراکنش\n👤 ${user.name}\n📝 ${transaction.description || 'بدون شرح'}\n💰 ${transaction.amount} ${transaction.currency}\n🔄 ${transaction.state === 'برد' ? 'برداشت' : 'رسید'}\n📅 ${transaction.trans_date}`;

    if (navigator.share) {
        try {
            await navigator.share({ title: 'اشتراک تراکنش', text: shareText });
        } catch (err) {
            if (err.name !== 'AbortError') fallbackShare(shareText);
        }
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    navigator.clipboard?.writeText(text).then(() => {
        alert('متن تراکنش در کلیپ‌بورد کپی شد. می‌توانید آن را در واتساپ/تلگرام بچسبانید.');
    }).catch(() => {
        prompt('متن تراکنش (می‌توانید کپی کنید):', text);
    });
}

// ---------- ۲. ارسال مستقیم به تلگرام کاربر (با استفاده از آیدی یا شماره) ----------
export function sendToTelegram(user, transaction) {
    if (!user.telegram_id && !user.phone_num) {
        alert('این کاربر فاقد آیدی تلگرام یا شماره تماس است.');
        return;
    }

    const message = encodeURIComponent(
        `🧾 تراکنش جدید\n` +
        `👤 ${user.name}\n` +
        `📝 ${transaction.description || 'بدون شرح'}\n` +
        `💰 ${transaction.amount} ${transaction.currency}\n` +
        `🔄 ${transaction.state === 'برد' ? 'برداشت' : 'رسید'}\n` +
        `📅 ${transaction.trans_date}`
    );

    let url;
    if (user.telegram_id) {
        // حذف @ احتمالی از ابتدای آیدی
        const cleanId = user.telegram_id.replace(/^@/, '');
        url = `https://t.me/${cleanId}?text=${message}`;
    } else {
        // شماره تلفن (فرمت بین‌المللی بدون +)
        const phone = user.phone_num.replace(/\D/g, '');
        url = `https://t.me/+${phone}?text=${message}`;
    }

    window.open(url, '_blank');
}

// ---------- ۳. کپی متن تراکنش در کلیپ‌بورد ----------
export function copyTransactionText(user, transaction) {
    const text = `🧾 ${user.name} | ${transaction.amount} ${transaction.currency} | ${transaction.state} | ${transaction.description || ''} | ${transaction.trans_date}`;
    navigator.clipboard?.writeText(text).then(() => {
        alert('تراکنش کپی شد.');
    }).catch(() => {
        prompt('متن تراکنش:', text);
    });
}

// ---------- ۴. ثبت تراکنش تکراری (با همان مقادیر) ----------
export async function duplicateTransaction(user, transaction) {
    if (!confirm('آیا تراکنش مشابه دیگری ثبت شود؟')) return;

    const newTrans = {
        ...transaction,
        trans_date: getPersianDate()
    };

    const appData = await loadData();
    const targetUser = appData.customers.find(u => u.user_id == user.user_id);
    if (!targetUser) return;

    targetUser.cash.push(newTrans);
    // به‌روزرسانی currencies_total
    if (targetUser.currencies_total[newTrans.currency]) {
        targetUser.currencies_total[newTrans.currency] += Number(newTrans.amount);
    } else {
        targetUser.currencies_total[newTrans.currency] = Number(newTrans.amount);
    }

    await saveData(appData);
    alert('تراکنش تکراری با موفقیت ثبت شد.');
    location.reload();
}

// ---------- ۵. خروجی پیشرفته (بازه‌ی زمانی، ارز، فرمت) ----------
export async function showAdvancedExport(userId = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-export-advanced';
    modal.style.cssText = `
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.6); display: flex; justify-content: center;
        align-items: center; z-index: 10000;
    `;
    modal.innerHTML = `
        <div style="background: #17212b; padding: 20px; border-radius: 16px; width: 90%; max-width: 400px; color: white; border: 1px solid #2ea6ff;">
            <h3 style="margin-top: 0;">📤 خروجی پیشرفته</h3>
            <label>از تاریخ:</label>
            <input type="date" id="export-date-from" style="width:100%; margin-bottom:10px; padding:8px; border-radius:8px; border:none;">
            <label>تا تاریخ:</label>
            <input type="date" id="export-date-to" style="width:100%; margin-bottom:10px; padding:8px; border-radius:8px; border:none;">
            <label>ارز (چندتا با کاما جدا کنید):</label>
            <input type="text" id="export-currencies" placeholder="مثلاً: تومان, دلار" style="width:100%; margin-bottom:15px; padding:8px; border-radius:8px; border:none;">
            <label>فرمت خروجی:</label>
            <select id="export-format" style="width:100%; margin-bottom:20px; padding:8px; border-radius:8px;">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="txt">متن ساده (TXT)</option>
                <option value="print">نسخه قابل چاپ (PDF)</option>
            </select>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="export-cancel" style="padding:8px 16px; border-radius:8px; border:none; background:#444; color:white;">لغو</button>
                <button id="export-generate" style="padding:8px 16px; border-radius:8px; border:none; background:#2ea6ff; color:black;">تولید</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#export-cancel').onclick = () => modal.remove();
    modal.querySelector('#export-generate').onclick = async () => {
        const from = modal.querySelector('#export-date-from').value;
        const to = modal.querySelector('#export-date-to').value;
        const currenciesInput = modal.querySelector('#export-currencies').value;
        const format = modal.querySelector('#export-format').value;

        const currencies = currenciesInput ? currenciesInput.split(',').map(c => c.trim()) : null;
        await generateAdvancedExport(userId, { from, to, currencies, format });
        modal.remove();
    };
}

export async function generateAdvancedExport(userId, filters) {
    const appData = await loadData();
    let users = appData.customers;
    if (userId) {
        users = users.filter(u => u.user_id == userId);
    }

    let allTransactions = [];
    users.forEach(user => {
        user.cash.forEach(trans => {
            // فیلتر تاریخ
            if (filters.from || filters.to) {
                const transDateParts = trans.trans_date.split('/');
                if (transDateParts.length === 3) {
                    const dateNum = parseInt(transDateParts[0] + transDateParts[1].padStart(2,'0') + transDateParts[2].padStart(2,'0'));
                    let fromNum = filters.from ? parseInt(filters.from.replace(/-/g, '')) : null;
                    let toNum = filters.to ? parseInt(filters.to.replace(/-/g, '')) : null;
                    if (fromNum && dateNum < fromNum) return;
                    if (toNum && dateNum > toNum) return;
                }
            }

            if (filters.currencies && filters.currencies.length > 0) {
                if (!filters.currencies.includes(trans.currency)) return;
            }

            allTransactions.push({
                userName: user.name,
                ...trans
            });
        });
    });

    if (filters.format === 'print') {
        generatePrintableReport(allTransactions, userId ? users[0]?.name : 'همه کاربران');
        return;
    }

    let content = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    switch (filters.format) {
        case 'csv':
            ext = 'csv';
            mimeType = 'text/csv';
            content = "نام کاربر,تاریخ,شرح,مبلغ,ارز,نوع\n";
            content += allTransactions.map(t => 
                `"${t.userName}","${t.trans_date}","${t.description || ''}",${t.amount},"${t.currency}","${t.state}"`
            ).join('\n');
            break;
        case 'json':
            ext = 'json';
            mimeType = 'application/json';
            content = JSON.stringify(allTransactions, null, 2);
            break;
        case 'txt':
            ext = 'txt';
            mimeType = 'text/plain';
            content = allTransactions.map(t => 
                `${t.userName} | ${t.trans_date} | ${t.description || ''} | ${t.amount} ${t.currency} | ${t.state}`
            ).join('\n');
            break;
        default:
            return;
    }

    const blob = new Blob(["\uFEFF" + content], { type: `${mimeType};charset=utf-8;` });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `export_${new Date().toISOString().slice(0,10)}.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// تابع تولید نسخه قابل چاپ (جایگزین PDF با قابلیت فارسی)
function generatePrintableReport(transactions, title) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>گزارش تراکنش‌ها</title>
            <style>
                body { font-family: Tahoma, sans-serif; padding: 20px; background: white; color: black; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; }
                h2 { text-align: center; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h2>${title} - گزارش تراکنش‌ها</h2>
            <table>
                <thead>
                    <tr>
                        <th>نام کاربر</th>
                        <th>تاریخ</th>
                        <th>شرح</th>
                        <th>مبلغ</th>
                        <th>ارز</th>
                        <th>نوع</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => `
                        <tr>
                            <td>${t.userName}</td>
                            <td>${t.trans_date}</td>
                            <td>${t.description || ''}</td>
                            <td>${t.amount}</td>
                            <td>${t.currency}</td>
                            <td>${t.state}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="no-print" style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()">🖨️ چاپ / ذخیره به صورت PDF</button>
                <button onclick="window.close()">بستن</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ---------- ۶. پشتیبان‌گیری و بازیابی ----------
export async function backupDatabase() {
    const record = await db.appData.get(1);
    if (!record || !record.content) {
        alert('دیتابیس خالی است.');
        return;
    }
    const blob = new Blob([record.content], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backup_${new Date().toISOString().slice(0,10)}.enc`;
    link.click();
    URL.revokeObjectURL(link.href);
}

export async function restoreDatabase() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.enc,application/octet-stream';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const encryptedContent = ev.target.result;
                const bytes = CryptoJS.AES.decrypt(encryptedContent, SECRET_KEY);
                const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                JSON.parse(decrypted);
                await db.appData.put({ id: 1, content: encryptedContent });
                alert('پشتیبان با موفقیت بازیابی شد. صفحه مجدد بارگذاری می‌شود.');
                location.reload();
            } catch (error) {
                alert('فایل پشتیبان نامعتبر است یا رمز عبور اشتباه می‌باشد.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ---------- ۷. منوی راست‌کلیک برای کاربران (users-page) ----------
export function showUserContextMenu(x, y, user, element) {
    const existing = document.querySelector('.user-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'user-context-menu';
    menu.style.cssText = `
        position: fixed; left: ${x}px; top: ${y}px;
        background: #17212b; border: 1px solid #2ea6ff; border-radius: 8px;
        padding: 5px; z-index: 1000; min-width: 150px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5); color: white;
    `;

    function addOption(text, color, onClick) {
        const opt = document.createElement('div');
        opt.textContent = text;
        opt.style.cssText = `
            padding: 8px 12px; margin: 2px 0; cursor: pointer;
            color: ${color}; border-radius: 6px;
            transition: background 0.2s;
        `;
        opt.onmouseenter = () => opt.style.backgroundColor = '#2ea6ff20';
        opt.onmouseleave = () => opt.style.backgroundColor = 'transparent';
        opt.onclick = (e) => {
            e.stopPropagation();
            menu.remove();
            onClick();
        };
        menu.appendChild(opt);
    }

    addOption('📊 خروجی تراکنش‌های این کاربر', '#a8ebff', () => showAdvancedExport(user.user_id));
    addOption('📱 ارسال لینک دعوت به تلگرام', '#b2ffa8', () => {
        if (user.telegram_id) {
            const cleanId = user.telegram_id.replace(/^@/, '');
            window.open(`https://t.me/${cleanId}`, '_blank');
        } else if (user.phone_num) {
            window.open(`https://t.me/+${user.phone_num.replace(/\D/g, '')}`, '_blank');
        } else {
            alert('اطلاعات تماس تلگرام ثبت نشده است.');
        }
    });
    addOption('📋 کپی اطلاعات کاربر', '#ffd966', () => {
        const text = `👤 ${user.name}\n📞 ${user.phone_num || ''}\n📱 ${user.telegram_id || ''}\n📝 ${user.description || ''}`;
        navigator.clipboard?.writeText(text).then(() => alert('کپی شد.'));
    });
    addOption('✏️ ویرایش کاربر', '#87CEEB', () => {
        if (typeof showEditUserModal === 'function') {
            showEditUserModal(user);
        } else {
            alert('قابلیت ویرایش کاربر در این صفحه پیاده‌سازی نشده است.');
        }
    });
    addOption('🗑 حذف کاربر', '#ffa8a8', async () => {
        if (!confirm(`آیا از حذف کاربر "${user.name}" و تمام تراکنش‌هایش مطمئن هستید؟`)) return;
        const appData = await loadData();
        appData.customers = appData.customers.filter(u => u.user_id != user.user_id);
        await saveData(appData);
        element?.remove();
        if (typeof renderUsers === 'function') await renderUsers();
    });

    document.body.appendChild(menu);
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// ---------- ۸. توابع کمکی تاریخ ----------
export function getPersianDate(date = new Date()) {
    return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// ---------- ۹. خروجی ساده CSV (نسخه قبلی) ----------
export async function exportTransactionsToCSV(userId) {
    const appData = await loadData();
    const user = appData.customers.find(u => u.user_id == userId);
    if (!user || !user.cash.length) {
        alert('تراکنشی برای خروجی وجود ندارد.');
        return;
    }

    let csvRows = [["تاریخ", "شرح", "مبلغ", "واحد", "نوع"]];
    user.cash.forEach(t => {
        csvRows.push([t.trans_date, t.description || '', t.amount, t.currency, t.state]);
    });
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${user.name}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

function goToTrans_account(user) {
    const userId = user.user_id;
    window.location.href = `account.html?userId=${userId}`;
      
}