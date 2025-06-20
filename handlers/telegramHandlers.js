const config = require('../config/config');

class TelegramHandlers {
    constructor(bot, whatsappClient, broadcastService, stateManager, telegramUtils) {
        this.bot = bot;
        this.whatsappClient = whatsappClient;
        this.broadcastService = broadcastService;
        this.stateManager = stateManager;
        this.telegramUtils = telegramUtils;
        this.adminChatId = config.telegram.adminChatId;
        
        this.setupHandlers();
    }

    setupHandlers() {
        // Message handler
        this.bot.on('message', async (msg) => {
            if (msg.chat.id.toString() !== this.adminChatId) return;
            
            console.log(`Telegram command: ${msg.text}`);
            await this.handleMessage(msg);
        });

        // Photo handler
        this.bot.on('photo', async (msg) => {
            if (msg.chat.id.toString() !== this.adminChatId) return;
            await this.handlePhoto(msg);
        });

        // Callback query handler
        this.bot.on('callback_query', async (callbackQuery) => {
            if (callbackQuery.message.chat.id.toString() !== this.adminChatId) return;
            await this.handleCallbackQuery(callbackQuery);
        });

        // Error handlers
        this.bot.on('error', (error) => {
            console.error('Telegram bot error:', error.message);
        });

        this.bot.on('polling_error', (error) => {
            console.error('Telegram polling error:', error.message);
        });
    }

    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;

        try {
            if (text === '/start') {
                const startMessage = this.telegramUtils.getStartMessage();
                const state = this.stateManager.getAll();
                const status = `${startMessage}\n\nStatus WhatsApp: ${state.whatsappReady ? '✅ Terhubung' : '❌ Tidak terhubung'}`;
                
                await this.bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
            }
            else if (text === '/loginwa') {
                await this.handleLoginWA(chatId);
            }
            else if (text === '/status') {
                const state = this.stateManager.getAll();
                const status = this.telegramUtils.formatStatus(state);
                await this.bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
            }
            else if (text === '/groups') {
                await this.handleGroups(chatId);
            }
            else if (text === '/setmessage') {
                await this.bot.sendMessage(chatId, '📝 Kirim pesan yang ingin di-broadcast:');
                this.stateManager.set('waitingForMessage', true);
            }
            else if (text === '/setimage') {
                await this.bot.sendMessage(chatId, '🖼️ Kirim gambar untuk mengatur gambar broadcast\n\n💡 Tips: Anda bisa langsung kirim gambar tanpa perlu menggunakan /setimage terlebih dahulu');
                this.stateManager.set('waitingForImage', true);
            }
            else if (text === '/preview') {
                const state = this.stateManager.getAll();
                const preview = this.telegramUtils.formatPreview(state);
                await this.bot.sendMessage(chatId, preview, { parse_mode: 'Markdown' });
            }
            else if (text === '/clear') {
                const keyboard = this.telegramUtils.getClearKeyboard();
                await this.bot.sendMessage(chatId, '🗑️ Pilih apa yang ingin dihapus:', {
                    reply_markup: keyboard
                });
            }
            else if (text === '/start_broadcast') {
                await this.handleStartBroadcast(chatId);
            }
            else if (text === '/stop_broadcast') {
                await this.handleStopBroadcast(chatId);
            }
            else if (text === '/reset') {
                await this.handleReset(chatId);
            }
            else if (this.stateManager.get('waitingForMessage') && text && !text.startsWith('/')) {
                await this.handleSetMessage(chatId, text);
            }
            
        } catch (error) {
            console.error('Error handling Telegram message:', error);
            await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
    }

    async handleLoginWA(chatId) {
        if (this.stateManager.get('whatsappReady')) {
            await this.bot.sendMessage(chatId, '✅ WhatsApp sudah terhubung!\n\nGunakan /status untuk melihat detail');
            return;
        }
        
        if (this.stateManager.get('loginInProgress')) {
            await this.bot.sendMessage(chatId, '⏳ Proses login sedang berlangsung...\n\nTunggu QR code atau gunakan /reset untuk membatalkan');
            return;
        }
        
        this.stateManager.set('loginInProgress', true);
        this.stateManager.set('qrSent', false);
        
        await this.bot.sendMessage(chatId, '🔄 Memulai proses login WhatsApp...');
        
        try {
            await this.whatsappClient.initialize();
        } catch (error) {
            console.error('Error initializing WhatsApp:', error);
            this.stateManager.set('loginInProgress', false);
            await this.bot.sendMessage(chatId, `❌ Error memulai login: ${error.message}`);
        }
    }

    async handleGroups(chatId) {
        if (!this.stateManager.get('whatsappReady')) {
            await this.bot.sendMessage(chatId, '❌ WhatsApp belum terhubung! Gunakan /loginwa');
            return;
        }
        
        const groups = this.stateManager.get('groups');
        const currentIndex = this.stateManager.get('currentGroupIndex');
        const groupList = this.telegramUtils.formatGroupList(groups, currentIndex);
        
        await this.bot.sendMessage(chatId, groupList, { parse_mode: 'Markdown' });
    }

    async handleStartBroadcast(chatId) {
        if (this.stateManager.get('isRunning')) {
            await this.bot.sendMessage(chatId, '⚠️ Broadcast sudah berjalan!\n\nGunakan /stop_broadcast untuk menghentikan');
            return;
        }
        await this.broadcastService.start();
    }

    async handleStopBroadcast(chatId) {
        if (!this.stateManager.get('isRunning')) {
            await this.bot.sendMessage(chatId, '⚠️ Broadcast tidak sedang berjalan!');
            return;
        }
        this.broadcastService.stop();
        await this.bot.sendMessage(chatId, '⏹️ Menghentikan broadcast...');
    }

    async handleReset(chatId) {
        this.stateManager.reset();
        
        try {
            await this.whatsappClient.destroy();
        } catch (error) {
            console.log('Error destroying client:', error.message);
        }
        
        await this.bot.sendMessage(chatId, '🔄 Bot telah direset!\n\nGunakan /loginwa untuk login kembali');
    }

    async handleSetMessage(chatId, text) {
        this.stateManager.set('message', text);
        this.stateManager.set('waitingForMessage', false);
        
        let confirmation = `✅ Pesan berhasil diset:\n\n"${text}"\n\n`;
        
        if (this.stateManager.get('imageBuffer')) {
            confirmation += '💡 Pesan ini akan dikirim bersama gambar yang sudah diset dalam 1 pesan yang sama';
        } else {
            confirmation += '💡 Gunakan /setimage atau kirim gambar langsung untuk menambahkan gambar, atau langsung /start_broadcast untuk mengirim pesan teks saja';
        }
        
        await this.bot.sendMessage(chatId, confirmation);
    }

    async handlePhoto(msg) {
        const chatId = msg.chat.id;
        
        try {
            const photo = msg.photo[msg.photo.length - 1]; // Ambil resolusi tertinggi
            const fileId = photo.file_id;
            
            console.log('Received photo with file_id:', fileId);
            await this.bot.sendMessage(chatId, '📥 Mengunduh gambar...');
            
            const imageBuffer = await this.telegramUtils.downloadFile(fileId);
            
            this.stateManager.set('imageBuffer', imageBuffer);
            this.stateManager.set('imageName', `image_${Date.now()}.jpg`);
            this.stateManager.set('waitingForImage', false);
            
            console.log(`Image saved to buffer: ${imageBuffer.length} bytes`);
            
            let confirmation = '✅ Gambar berhasil diset untuk broadcast!\n\n';
            confirmation += `📊 Ukuran: ${Math.round(imageBuffer.length / 1024)} KB\n\n`;
            
            const message = this.stateManager.get('message');
            if (message) {
                confirmation += '💡 Gambar ini akan dikirim bersama pesan teks yang sudah diset dalam 1 pesan yang sama:\n\n';
                confirmation += `"${message}"`;
            } else {
                confirmation += '💡 Gunakan /setmessage untuk menambahkan teks, atau langsung /start_broadcast untuk mengirim gambar saja';
            }
            
            await this.bot.sendMessage(chatId, confirmation);
            
        } catch (error) {
            console.error('Error handling photo:', error);
            await this.bot.sendMessage(chatId, `❌ Error mengatur gambar: ${error.message}`);
        }
    }

    async handleCallbackQuery(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        try {
            let message = '';
            
            if (data === 'clear_message') {
                this.stateManager.clearContent('message');
                message = '✅ Pesan teks berhasil dihapus!';
            }
            else if (data === 'clear_image') {
                this.stateManager.clearContent('image');
                message = '✅ Gambar berhasil dihapus!';
            }
            else if (data === 'clear_all') {
                this.stateManager.clearContent('all');
                message = '✅ Semua konten berhasil dihapus!';
            }
            else if (data === 'cancel') {
                message = '❌ Dibatalkan';
            }
            
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
            
            await this.bot.answerCallbackQuery(callbackQuery.id);
            
        } catch (error) {
            console.error('Error handling callback query:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Error occurred' });
        }
    }
}

module.exports = TelegramHandlers;