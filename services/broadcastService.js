const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config/config');

class BroadcastService {
    constructor(whatsappClient, stateManager, telegramUtils) {
        this.whatsappClient = whatsappClient;
        this.stateManager = stateManager;
        this.telegramUtils = telegramUtils;
    }

    async start() {
        if (!this.whatsappClient.isReady()) {
            await this.telegramUtils.sendMessage('❌ WhatsApp belum terhubung! Gunakan /loginwa untuk login');
            return;
        }
        
        if (!this.stateManager.hasContent()) {
            await this.telegramUtils.sendMessage('❌ Belum ada pesan atau gambar yang diset!\n\nGunakan /setmessage atau /setimage');
            return;
        }
        
        const groups = this.stateManager.get('groups');
        if (groups.length === 0) {
            await this.telegramUtils.sendMessage('❌ Tidak ada grup yang tersedia!');
            return;
        }
        
        this.stateManager.set('isRunning', true);
        this.stateManager.set('sendCount', 0);
        
        await this.sendPreview();
        await this.runBroadcastLoop();
    }

    async sendPreview() {
        const contentType = this.stateManager.getContentType();
        let contentPreview = '🚀 Memulai broadcast...\n\n📋 Konten yang akan dikirim:\n';
        
        switch (contentType) {
            case 'both':
                contentPreview += '📸 Gambar + 📝 Pesan teks\n';
                break;
            case 'image':
                contentPreview += '📸 Gambar saja\n';
                break;
            case 'text':
                contentPreview += '📝 Pesan teks saja\n';
                break;
        }
        
        contentPreview += '\n🔄 Pola pengiriman:\n• Grup ganjil → delay 10 detik\n• Grup genap → delay 1 jam\n\nGunakan /stop_broadcast untuk menghentikan';
        
        await this.telegramUtils.sendMessage(contentPreview);
    }

    async runBroadcastLoop() {
        const groups = this.stateManager.get('groups');
        
        while (this.stateManager.get('isRunning') && this.whatsappClient.isReady()) {
            try {
                const currentIndex = this.stateManager.get('currentGroupIndex');
                const currentGroup = groups[currentIndex];
                
                const success = await this.sendToGroup(currentGroup.id, currentGroup.name);
                
                if (!success) {
                    this.moveToNextGroup();
                    await this.delay(config.broadcast.errorDelay);
                    continue;
                }
                
                const delayInfo = this.calculateDelay(currentIndex);
                this.moveToNextGroup();
                
                if (this.stateManager.get('isRunning')) {
                    const nextIndex = this.stateManager.get('currentGroupIndex');
                    const nextGroup = groups[nextIndex];
                    
                    await this.telegramUtils.sendMessage(
                        `⏳ Delay ${delayInfo.text} sebelum mengirim ke: ${nextGroup.name}`
                    );
                    
                    await this.handleDelay(delayInfo.time, nextGroup.name);
                }
                
            } catch (error) {
                console.error('Error in broadcast loop:', error);
                await this.telegramUtils.sendMessage(`❌ Error dalam broadcast: ${error.message}`);
                await this.delay(config.broadcast.retryDelay);
            }
        }
        
        if (!this.stateManager.get('isRunning')) {
            await this.telegramUtils.sendMessage('⏹️ Broadcast dihentikan');
        }
    }

    async sendToGroup(groupId, groupName) {
        try {
            const message = this.stateManager.get('message');
            const imageBuffer = this.stateManager.get('imageBuffer');
            const imageName = this.stateManager.get('imageName');
            
            let sentMessage = false;
            
            if (imageBuffer && message) {
                console.log(`Sending image with caption to ${groupName}`);
                const media = new MessageMedia('image/jpeg', imageBuffer.toString('base64'), imageName);
                await this.whatsappClient.sendMessage(groupId, media, { caption: message });
                sentMessage = true;
            } else if (imageBuffer && !message) {
                console.log(`Sending image only to ${groupName}`);
                const media = new MessageMedia('image/jpeg', imageBuffer.toString('base64'), imageName);
                await this.whatsappClient.sendMessage(groupId, media);
                sentMessage = true;
            } else if (!imageBuffer && message) {
                console.log(`Sending text only to ${groupName}`);
                await this.whatsappClient.sendMessage(groupId, message);
                sentMessage = true;
            }
            
            if (sentMessage) {
                const sendCount = this.stateManager.get('sendCount') + 1;
                this.stateManager.set('sendCount', sendCount);
                
                const contentType = (imageBuffer && message) ? '📸+📝' : 
                                  (imageBuffer) ? '📸' : '📝';
                const status = `✅ ${contentType} Pesan ke-${sendCount} terkirim ke: ${groupName}`;
                
                console.log(status);
                await this.telegramUtils.sendMessage(status);
                return true;
            } else {
                await this.telegramUtils.sendMessage(`⚠️ Tidak ada konten untuk dikirim ke ${groupName}`);
                return false;
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            await this.telegramUtils.sendMessage(`❌ Error mengirim ke ${groupName}: ${error.message}`);
            return false;
        }
    }

    calculateDelay(currentIndex) {
        if (currentIndex % 2 === 0) {
            return {
                time: config.broadcast.shortDelay,
                text: '10 detik'
            };
        } else {
            return {
                time: config.broadcast.longDelay,
                text: '1 jam'
            };
        }
    }

    async handleDelay(delayTime, nextGroupName) {
        if (delayTime >= 3600000) { // 1 jam
            await this.handleLongDelay(delayTime, nextGroupName);
        } else {
            await this.delay(delayTime);
        }
    }

    async handleLongDelay(delayTime, nextGroupName) {
        const countdownIntervals = config.broadcast.countdownIntervals;
        let remainingTime = delayTime;
        
        for (const minutes of countdownIntervals) {
            const intervalMs = minutes * 60 * 1000;
            if (remainingTime > intervalMs) {
                await this.delay(remainingTime - intervalMs);
                if (!this.stateManager.get('isRunning')) break;
                await this.telegramUtils.sendMessage(`⏰ ${minutes} menit lagi menuju grup: ${nextGroupName}`);
                remainingTime = intervalMs;
            }
        }
        
        if (this.stateManager.get('isRunning') && remainingTime > 0) {
            await this.delay(remainingTime);
        }
    }

    moveToNextGroup() {
        const groups = this.stateManager.get('groups');
        const currentIndex = this.stateManager.get('currentGroupIndex');
        const nextIndex = (currentIndex + 1) % groups.length;
        this.stateManager.set('currentGroupIndex', nextIndex);
    }

    stop() {
        this.stateManager.set('isRunning', false);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BroadcastService;