const config = require('../config/config');

class TelegramUtils {
    constructor(bot) {
        this.bot = bot;
        this.adminChatId = config.telegram.adminChatId;
    }

    async sendMessage(message, options = {}) {
        try {
            await this.bot.sendMessage(this.adminChatId, message, options);
            return true;
        } catch (error) {
            console.error('Error sending to Telegram:', error.message);
            return false;
        }
    }

    async sendPhoto(buffer, caption = '', filename = 'photo.jpg') {
        try {
            await this.bot.sendPhoto(this.adminChatId, buffer, { 
                caption,
                filename: filename
            });
            return true;
        } catch (error) {
            console.error('Error sending photo to Telegram:', error.message);
            return false;
        }
    }

    async downloadFile(fileId) {
        try {
            const file = await this.bot.getFile(fileId);
            const fileBuffer = await this.bot.downloadFile(fileId, './temp/');
            
            // Jika method downloadFile tidak mengembalikan buffer, baca file
            if (!Buffer.isBuffer(fileBuffer)) {
                const fs = require('fs');
                const filePath = `./temp/${file.file_path.split('/').pop()}`;
                const buffer = fs.readFileSync(filePath);
                fs.unlinkSync(filePath); // Hapus file temporary
                return buffer;
            }
            
            return fileBuffer;
        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    formatStatus(state) {
        return `📊 *Status Bot*\n\n` +
               `WhatsApp: ${state.whatsappReady ? '✅ Terhubung' : '❌ Tidak terhubung'}\n` +
               `Login Progress: ${state.loginInProgress ? '🔄 Berlangsung' : '⏹️ Tidak aktif'}\n` +
               `Broadcast: ${state.isRunning ? '🟢 Aktif' : '🔴 Tidak aktif'}\n` +
               `Jumlah Grup: ${state.groups.length}\n` +
               `Grup Aktif: ${state.groups.length > 0 ? state.groups[state.currentGroupIndex]?.name || 'None' : 'None'}\n` +
               `Pesan Terkirim: ${state.sendCount}\n` +
               `Pesan: ${state.message ? '✅ Sudah diset' : '❌ Belum diset'}\n` +
               `Gambar: ${state.imageBuffer ? '✅ Sudah diset' : '❌ Belum diset'}`;
    }

    formatGroupList(groups, currentIndex) {
        if (groups.length === 0) {
            return '❌ Belum ada grup yang tersedia';
        }

        let groupList = '📋 *Daftar Grup:*\n\n';
        groups.forEach((group, index) => {
            const isActive = index === currentIndex ? '🔄 ' : '';
            groupList += `${index + 1}. ${isActive}${group.name}\n`;
        });
        
        return groupList;
    }

    formatPreview(state) {
        let preview = '👀 *Preview Konten Broadcast:*\n\n';
        
        if (state.message && state.imageBuffer) {
            preview += '📸 Gambar: ✅ Siap\n📝 Pesan: ✅ Siap\n\n';
            preview += `💬 Pesan teks:\n"${state.message}"\n\n`;
            preview += `🖼️ Gambar akan dikirim bersama pesan di atas dalam 1 pesan yang sama`;
        } else if (state.imageBuffer) {
            preview += '📸 Gambar: ✅ Siap\n📝 Pesan: ❌ Belum diset\n\n';
            preview += '🖼️ Hanya gambar yang akan dikirim';
        } else if (state.message) {
            preview += '📸 Gambar: ❌ Belum diset\n📝 Pesan: ✅ Siap\n\n';
            preview += `💬 Pesan teks:\n"${state.message}"`;
        } else {
            preview += '📸 Gambar: ❌ Belum diset\n📝 Pesan: ❌ Belum diset\n\n';
            preview += '⚠️ Belum ada konten untuk broadcast';
        }
        
        return preview;
    }

    getStartMessage() {
        return '🤖 *WhatsApp Auto Sender Bot*\n\n' +
               '📋 *Perintah yang tersedia:*\n' +
               '• /loginwa - Login ke WhatsApp\n' +
               '• /setmessage - Set pesan broadcast\n' +
               '• /setimage - Set gambar broadcast (atau kirim gambar langsung)\n' +
               '• /start\\_broadcast - Mulai auto send\n' +
               '• /stop\\_broadcast - Stop auto send\n' +
               '• /status - Cek status bot\n' +
               '• /groups - Lihat daftar grup\n' +
               '• /preview - Preview konten broadcast\n' +
               '• /clear - Hapus pesan/gambar\n' +
               '• /reset - Reset bot\n\n' +
               '💡 Mulai dengan /loginwa untuk menghubungkan WhatsApp';
    }

    getClearKeyboard() {
        return {
            inline_keyboard: [
                [{text: '🗑️ Hapus Pesan', callback_data: 'clear_message'}],
                [{text: '🗑️ Hapus Gambar', callback_data: 'clear_image'}],
                [{text: '🗑️ Hapus Semua', callback_data: 'clear_all'}],
                [{text: '❌ Batal', callback_data: 'cancel'}]
            ]
        };
    }
}

module.exports = TelegramUtils;