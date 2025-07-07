const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'config.json');
        this.defaultConfig = {
            server: {
                port: 3000,
                host: 'localhost'
            },
            plex: {
                serverUrl: '',
                token: '',
                autoConnect: false
            },
            ui: {
                theme: 'dark',
                autoRefresh: true,
                refreshInterval: 30000
            },
            setup: {
                completed: false,
                version: '1.0.0'
            }
        };
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const config = JSON.parse(configData);
                return { ...this.defaultConfig, ...config };
            }
        } catch (error) {
            console.warn('Error loading config, using defaults:', error.message);
        }
        return { ...this.defaultConfig };
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving config:', error.message);
            return false;
        }
    }

    get(key) {
        const keys = key.split('.');
        let value = this.config;
        for (const k of keys) {
            value = value[k];
            if (value === undefined) return undefined;
        }
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let obj = this.config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        return this.saveConfig();
    }

    update(updates) {
        this.config = this.mergeDeep(this.config, updates);
        return this.saveConfig();
    }

    mergeDeep(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeDeep(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    isSetupCompleted() {
        return this.get('setup.completed') === true;
    }

    markSetupCompleted() {
        return this.set('setup.completed', true);
    }

    getServerConfig() {
        return {
            port: this.get('server.port'),
            host: this.get('server.host')
        };
    }

    getPlexConfig() {
        return {
            serverUrl: this.get('plex.serverUrl'),
            token: this.get('plex.token'),
            autoConnect: this.get('plex.autoConnect')
        };
    }

    reset() {
        this.config = { ...this.defaultConfig };
        return this.saveConfig();
    }

    export() {
        return JSON.stringify(this.config, null, 2);
    }

    import(configJson) {
        try {
            const importedConfig = JSON.parse(configJson);
            this.config = this.mergeDeep(this.defaultConfig, importedConfig);
            return this.saveConfig();
        } catch (error) {
            console.error('Error importing config:', error.message);
            return false;
        }
    }
}

module.exports = ConfigManager;