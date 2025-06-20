const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const StateManager = require('./utils/stateManager');
const TelegramUtils = require('./utils/telegramUtils');
const WhatsAppClient = require('./services/whatsappClient');
const BroadcastService = require('./services/broadcastService');
const TelegramHandlers = require('./handlers/telegramHandlers');

// Inisialisasi Telegram Bot
const telegramBot = new TelegramBot(config.telegram.token, { 
    polling: true,
    filepath: false
});

// Inisialisasi komponen
const telegramUtils = new TelegramUtils(telegramBot);
const whatsappClient = new WhatsAppClient(StateManager, telegramUtils);
const broadcastService = new BroadcastService(whatsappClient, StateManager, telegramUtils);

// Setup handlers
new TelegramHandlers(
    telegramBot, 
    whatsappClient, 
    broadcastService, 
    StateManager, 
    telegramUtils
);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    StateManager.set('isRunning', false);
    
    try {
        await whatsappClient.destroy();
    } catch (error) {
        console.log('Error destroying WhatsApp client:', error.message);
    }
    
    process.exit(0);
});

// Start bot
console.log('🚀 Starting Telegram bot...');
telegramUtils.sendMessage('🤖 Bot started! Gunakan /start untuk melihat menu');