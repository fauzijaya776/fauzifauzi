require('dotenv').config();

module.exports = {
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN || '7786566974:AAEA4O7Ioh8oqmrowtqheWLxRqCtCsOrwyM',
        adminChatId: process.env.ADMIN_CHAT_ID || '1641090169'
    },
    whatsapp: {
        clientId: 'main-session',
        puppeteerConfig: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security'
            ]
        }
    },
    broadcast: {
        shortDelay: 10 * 1000, // 10 detik
        longDelay: 60 * 60 * 1000, // 1 jam
        errorDelay: 5000, // 5 detik
        retryDelay: 30000, // 30 detik
        countdownIntervals: [45, 30, 15, 10, 5, 1] // menit
    }
};
