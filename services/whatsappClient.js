const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const config = require('../config/config');

class WhatsAppClient {
    constructor(stateManager, telegramUtils) {
        this.stateManager = stateManager;
        this.telegramUtils = telegramUtils;
        this.client = null;
    }

    initialize() {
        if (this.client) {
            try {
                this.client.destroy();
            } catch (error) {
                console.log('Error destroying existing client:', error.message);
            }
        }

        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: config.whatsapp.clientId }),
            puppeteer: config.whatsapp.puppeteerConfig
        });

        this.setupEventHandlers();
        return this.client.initialize();
    }

    setupEventHandlers() {
        // QR Code handler
        this.client.on('qr', async (qr) => {
            if (this.stateManager.get('qrSent')) {
                console.log('QR already sent, skipping...');
                return;
            }

            try {
                console.log('Generating QR Code...');
                this.stateManager.set('qrSent', true);
                
                const qrBuffer = await qrcode.toBuffer(qr, { 
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    scale: 8,
                    width: 512
                });
                
                await this.telegramUtils.sendPhoto(
                    qrBuffer, 
                    '📱 Scan QR Code untuk login WhatsApp\n\n⏰ QR Code berlaku 20 detik', 
                    'whatsapp_qr.png'
                );
                
                await this.telegramUtils.sendMessage(
                    '⏳ Menunggu scan QR Code...\n\n💡 Tips: Buka WhatsApp → Menu (3 titik) → Linked Devices → Link a Device'
                );
                
            } catch (error) {
                console.error('Error generating QR:', error);
                await this.telegramUtils.sendMessage('❌ Error generating QR Code: ' + error.message);
                this.stateManager.set('qrSent', false);
            }
        });

        // Ready handler
        this.client.on('ready', async () => {
            console.log('WhatsApp Client is ready!');
            this.stateManager.set('whatsappReady', true);
            this.stateManager.set('loginInProgress', false);
            this.stateManager.set('qrSent', false);
            
            await this.telegramUtils.sendMessage('✅ WhatsApp berhasil terhubung! Mengambil daftar grup...');
            
            try {
                await this.loadGroups();
            } catch (error) {
                console.error('Error getting groups:', error);
                await this.telegramUtils.sendMessage('❌ Error mengambil daftar grup: ' + error.message);
            }
        });

        // Authenticated handler
        this.client.on('authenticated', async () => {
            console.log('WhatsApp authenticated');
            await this.telegramUtils.sendMessage('🔐 WhatsApp berhasil terotentikasi!');
            this.stateManager.set('qrSent', false);
        });

        // Disconnected handler
        this.client.on('disconnected', async (reason) => {
            console.log('WhatsApp disconnected:', reason);
            this.stateManager.set('whatsappReady', false);
            this.stateManager.set('isRunning', false);
            this.stateManager.set('loginInProgress', false);
            this.stateManager.set('qrSent', false);
            await this.telegramUtils.sendMessage(`❌ WhatsApp terputus: ${reason}\n\nGunakan /loginwa untuk login kembali`);
        });

        // Auth failure handler
        this.client.on('auth_failure', async (msg) => {
            console.error('WhatsApp auth failure:', msg);
            this.stateManager.set('loginInProgress', false);
            this.stateManager.set('qrSent', false);
            await this.telegramUtils.sendMessage(`❌ WhatsApp authentication gagal: ${msg}\n\nCoba login ulang dengan /loginwa`);
        });
    }

    async loadGroups() {
        const chats = await this.client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        const groupList = groups.map((group, index) => ({
            id: group.id._serialized,
            name: group.name,
            index: index
        }));
        
        this.stateManager.set('groups', groupList);
        
        if (groupList.length > 0) {
            let message = '📋 *Daftar Grup WhatsApp:*\n\n';
            groupList.forEach((group, index) => {
                message += `${index + 1}. ${group.name}\n`;
            });
            message += `\n📊 Total: ${groupList.length} grup`;
            
            await this.telegramUtils.sendMessage(message, { parse_mode: 'Markdown' });
        } else {
            await this.telegramUtils.sendMessage('⚠️ Tidak ada grup yang ditemukan dalam akun WhatsApp ini');
        }
        
        await this.telegramUtils.sendMessage(
            '🎯 Bot siap digunakan!\n\nGunakan perintah:\n/setmessage - Set pesan\n/setimage - Set gambar\n/start_broadcast - Mulai broadcast\n/status - Lihat status'
        );
    }

    async sendMessage(groupId, content) {
        if (!this.client) throw new Error('WhatsApp client not initialized');
        return await this.client.sendMessage(groupId, content);
    }

    async destroy() {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
        }
    }

    isReady() {
        return this.stateManager.get('whatsappReady');
    }
}

module.exports = WhatsAppClient;