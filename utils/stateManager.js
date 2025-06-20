class StateManager {
    constructor() {
        this.state = {
            whatsappReady: false,
            whatsappInitialized: false,
            groups: [],
            currentGroupIndex: 0,
            isRunning: false,
            message: '',
            imageBuffer: null,
            imageName: '',
            sendCount: 0,
            waitingForMessage: false,
            waitingForImage: false,
            qrSent: false,
            loginInProgress: false
        };
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state[key] = value;
    }

    getAll() {
        return { ...this.state };
    }

    reset() {
        this.state.isRunning = false;
        this.state.loginInProgress = false;
        this.state.qrSent = false;
        this.state.waitingForMessage = false;
        this.state.waitingForImage = false;
        this.state.whatsappReady = false;
    }

    clearContent(type = 'all') {
        switch (type) {
            case 'message':
                this.state.message = '';
                break;
            case 'image':
                this.state.imageBuffer = null;
                this.state.imageName = '';
                break;
            case 'all':
                this.state.message = '';
                this.state.imageBuffer = null;
                this.state.imageName = '';
                break;
        }
    }

    hasContent() {
        return !!(this.state.message || this.state.imageBuffer);
    }

    getContentType() {
        if (this.state.imageBuffer && this.state.message) return 'both';
        if (this.state.imageBuffer) return 'image';
        if (this.state.message) return 'text';
        return 'none';
    }
}

module.exports = new StateManager();