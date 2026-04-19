import { onAuth, go_home, go_users, escapeHtml } from './common.js';

// پیکربندی تلگرام (بهتر است این مقادیر را در Firestore یا متغیرهای محیطی قرار دهید)
const TELEGRAM_BOT_TOKEN = '8788988037:AAF55VtzsRtB99lqcgNgHKhFldCI24sDQIw';          // توکن ربات تلگرام خود را جایگزین کنید
const TELEGRAM_CHAT_ID = '@Mirza_feedbacks';    // شناسه کانال یا @username (باید ربات عضو کانال باشد)
const YOUR_TELEGRAM_ID = 'https://t.me/rahoonramin'; // لینک پشتیبانی شما

// عناصر DOM
let settingsContainer;
let feedbackTextarea;
let sendFeedbackBtn;
let statusDiv;

// مقداردهی اولیه پس از احراز هویت
onAuth(async (isLoggedIn) => {
    if (!isLoggedIn) {
        window.location.href = 'login.html';
        return;
    }
    setupUI();
});

function setupUI() {
    settingsContainer = document.querySelector('.settings-container');
    if (!settingsContainer) return;
    settingsContainer.innerHTML = ''; // پاکسازی (فقط یکبار)

    // 1. بخش راهنما و پشتیبانی
    const helpCard = createCard('📞 پشتیبانی و راهنما');
    const helpButtons = document.createElement('div');
    helpButtons.className = 'help-buttons';

    const telegramBtn = createButton('📱 ارتباط با پشتیبان در تلگرام', 'btn-outline', () => {
        window.open(YOUR_TELEGRAM_ID, '_blank');
    });
    const guideBtn = createButton('📚 مشاهده راهنمای نرم‌افزار', 'btn-outline', () => {
        // می‌توانید یک فایل PDF یا صفحه راهنما باز کنید
        alert('راهنما به زودی اضافه می‌شود. فعلاً با پشتیبانی تماس بگیرید.');
    });

    helpButtons.appendChild(telegramBtn);
    helpButtons.appendChild(guideBtn);
    helpCard.appendChild(helpButtons);
    settingsContainer.appendChild(helpCard);

    // 2. بخش ارسال بازخورد
    const feedbackCard = createCard('💬 ارسال بازخورد یا گزارش خطا');
    const form = document.createElement('div');
    form.className = 'feedback-form';

    feedbackTextarea = document.createElement('textarea');
    feedbackTextarea.placeholder = 'نظر، پیشنهاد یا مشکل خود را بنویسید...';
    feedbackTextarea.rows = 4;

    sendFeedbackBtn = createButton('📤 ارسال بازخورد', '', sendFeedback);
    statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';

    form.appendChild(feedbackTextarea);
    form.appendChild(sendFeedbackBtn);
    form.appendChild(statusDiv);
    feedbackCard.appendChild(form);
    settingsContainer.appendChild(feedbackCard);

    // 3. فضای خالی برای تنظیمات آینده
    const futureCard = createCard('⚙️ تنظیمات برنامه');
    const placeholder = document.createElement('div');
    placeholder.className = 'future-settings-placeholder';
    placeholder.textContent = 'گزینه‌های بیشتر در به‌روزرسانی‌های آینده...';
    futureCard.appendChild(placeholder);
    settingsContainer.appendChild(futureCard);
}

/**
 * ایجاد یک کارت (div با کلاس settings-card)
 */
function createCard(title) {
    const card = document.createElement('div');
    card.className = 'settings-card';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    card.appendChild(h3);
    return card;
}

/**
 * ایجاد دکمه
 */
function createButton(text, additionalClass = '', clickHandler) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'btn' + (additionalClass ? ' ' + additionalClass : '');
    btn.addEventListener('click', clickHandler);
    return btn;
}

/**
 * ارسال بازخورد به تلگرام
 */
async function sendFeedback() {
    const message = feedbackTextarea.value.trim();
    if (!message) {
        showStatus('لطفاً پیام خود را وارد کنید.', true);
        return;
    }

    if (TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN') {
        showStatus('⚠️ توکن ربات تلگرام تنظیم نشده است. لطفاً با پشتیبانی تماس بگیرید.', true);
        return;
    }

    sendFeedbackBtn.disabled = true;
    sendFeedbackBtn.textContent = '⏳ در حال ارسال...';
    showStatus('');

    try {
        const userInfo = await getUserInfo();
        const fullMessage = `📩 بازخورد جدید:\n👤 ${userInfo}\n\n📝 پیام:\n${escapeHtml(message)}`;

        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: fullMessage,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();
        if (data.ok) {
            feedbackTextarea.value = '';
            showStatus('✅ بازخورد شما با موفقیت ارسال شد. متشکریم!');
        } else {
            throw new Error(data.description || 'خطای نامشخص');
        }
    } catch (error) {
        console.error('خطا در ارسال:', error);
        showStatus('❌ خطا در ارسال. لطفاً دوباره تلاش کنید یا از طریق تلگرام تماس بگیرید.', true);
    } finally {
        sendFeedbackBtn.disabled = false;
        sendFeedbackBtn.textContent = '📤 ارسال بازخورد';
    }
}

function showStatus(msg, isError = false) {
    statusDiv.textContent = msg;
    statusDiv.className = 'status-message' + (isError ? ' error' : '');
}

/**
 * دریافت اطلاعات کاربر برای پیوست به بازخورد
 */
async function getUserInfo() {
    // می‌توانید از اطلاعات احراز هویت یا Firestore استفاده کنید
    const email = localStorage.getItem('userEmail') || 'کاربر';
    const device = navigator.userAgent.includes('Mobile') ? '📱 موبایل' : '💻 دسکتاپ';
    return `${email} (${device})`;
}

// اتصال توابع به window برای onclickهای HTML
window.go_home = go_home;
window.go_users = go_users;