class ConfigManager {
    constructor() {
        this.originalConfig = null;
        this.currentConfig = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadConfig();
        this.populateForm();
    }

    bindEvents() {
        document.querySelectorAll('.config-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        document.getElementById('saveConfig').addEventListener('click', () => this.saveConfig());
        document.getElementById('cancelConfig').addEventListener('click', () => this.cancelChanges());
        document.getElementById('testPlexConnection').addEventListener('click', () => this.testConnection());
        document.getElementById('discoverPlex').addEventListener('click', () => this.discoverServers());
        document.getElementById('toggleToken').addEventListener('click', () => this.toggleTokenVisibility());
        document.getElementById('exportConfig').addEventListener('click', () => this.exportConfig());
        document.getElementById('importConfig').addEventListener('click', () => this.importConfig());
        document.getElementById('configFile').addEventListener('change', (e) => this.handleConfigFile(e));
        document.getElementById('resetConfig').addEventListener('click', () => this.resetConfig());
        document.getElementById('toastClose').addEventListener('click', () => this.hideToast());

        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', () => this.updateConfigFromForm());
        });
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            this.originalConfig = JSON.parse(JSON.stringify(data.config));
            this.currentConfig = JSON.parse(JSON.stringify(data.config));
        } catch (error) {
            this.showToast('Failed to load configuration: ' + error.message, 'error');
        }
    }

    populateForm() {
        if (!this.currentConfig) return;

        document.getElementById('plexServerUrl').value = this.currentConfig.plex?.serverUrl || '';
        document.getElementById('plexToken').value = this.currentConfig.plex?.token || '';
        document.getElementById('plexAutoConnect').checked = this.currentConfig.plex?.autoConnect || false;
        
        document.getElementById('serverPort').value = this.currentConfig.server?.port || 3000;
        document.getElementById('serverHost').value = this.currentConfig.server?.host || 'localhost';
        
        document.getElementById('uiTheme').value = this.currentConfig.ui?.theme || 'dark';
        document.getElementById('uiAutoRefresh').checked = this.currentConfig.ui?.autoRefresh !== false;
        document.getElementById('uiRefreshInterval').value = (this.currentConfig.ui?.refreshInterval || 30000) / 1000;
    }

    updateConfigFromForm() {
        if (!this.currentConfig) return;

        this.currentConfig.plex = {
            ...this.currentConfig.plex,
            serverUrl: document.getElementById('plexServerUrl').value,
            token: document.getElementById('plexToken').value,
            autoConnect: document.getElementById('plexAutoConnect').checked
        };

        this.currentConfig.server = {
            ...this.currentConfig.server,
            port: parseInt(document.getElementById('serverPort').value) || 3000,
            host: document.getElementById('serverHost').value || 'localhost'
        };

        this.currentConfig.ui = {
            ...this.currentConfig.ui,
            theme: document.getElementById('uiTheme').value,
            autoRefresh: document.getElementById('uiAutoRefresh').checked,
            refreshInterval: (parseInt(document.getElementById('uiRefreshInterval').value) || 30) * 1000
        };
    }

    switchSection(sectionName) {
        document.querySelectorAll('.config-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.config-section').forEach(section => {
            section.classList.remove('active');
        });

        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        document.getElementById(`${sectionName}Section`).classList.add('active');
    }

    async saveConfig() {
        const btn = document.getElementById('saveConfig');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        try {
            this.updateConfigFromForm();
            
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.currentConfig),
            });

            const result = await response.json();

            if (response.ok) {
                this.originalConfig = JSON.parse(JSON.stringify(this.currentConfig));
                this.showToast('Configuration saved successfully!', 'success');
                
                if (this.hasServerChanges()) {
                    this.showToast('Server settings changed. Please restart the application.', 'warning');
                }
            } else {
                this.showToast('Failed to save configuration: ' + result.error, 'error');
            }
        } catch (error) {
            this.showToast('Failed to save configuration: ' + error.message, 'error');
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    }

    hasServerChanges() {
        return this.originalConfig.server?.port !== this.currentConfig.server?.port ||
               this.originalConfig.server?.host !== this.currentConfig.server?.host;
    }

    cancelChanges() {
        this.currentConfig = JSON.parse(JSON.stringify(this.originalConfig));
        this.populateForm();
        this.showToast('Changes cancelled', 'info');
    }

    async testConnection() {
        const btn = document.getElementById('testPlexConnection');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        btn.disabled = true;

        try {
            const serverUrl = document.getElementById('plexServerUrl').value;
            const token = document.getElementById('plexToken').value;

            if (!serverUrl || !token) {
                this.showToast('Please enter both server URL and token', 'error');
                return;
            }

            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ serverUrl, token }),
            });

            const result = await response.json();

            if (response.ok) {
                this.showToast('Connection successful!', 'success');
            } else {
                this.showToast('Connection failed: ' + result.error, 'error');
            }
        } catch (error) {
            this.showToast('Connection failed: ' + error.message, 'error');
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    }

    async discoverServers() {
        const btn = document.getElementById('discoverPlex');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Discovering...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/plex/discover');
            const data = await response.json();

            if (data.discoveries && data.discoveries.length > 0) {
                const serverUrl = data.discoveries[0].url;
                document.getElementById('plexServerUrl').value = serverUrl;
                this.updateConfigFromForm();
                this.showToast(`Found server: ${serverUrl}`, 'success');
            } else {
                this.showToast('No Plex servers found on common ports', 'warning');
            }
        } catch (error) {
            this.showToast('Discovery failed: ' + error.message, 'error');
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    }

    toggleTokenVisibility() {
        const tokenInput = document.getElementById('plexToken');
        const toggleBtn = document.getElementById('toggleToken');
        
        if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            tokenInput.type = 'password';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }

    exportConfig() {
        const configJson = JSON.stringify(this.currentConfig, null, 2);
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plex-playlist-manager-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Configuration exported successfully', 'success');
    }

    importConfig() {
        document.getElementById('configFile').click();
    }

    handleConfigFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedConfig = JSON.parse(e.target.result);
                this.currentConfig = { ...this.currentConfig, ...importedConfig };
                this.populateForm();
                this.showToast('Configuration imported successfully', 'success');
            } catch (error) {
                this.showToast('Invalid configuration file: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    async resetConfig() {
        if (!confirm('Are you sure you want to reset all configuration to defaults? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/config/reset', {
                method: 'POST',
            });

            const result = await response.json();

            if (response.ok) {
                await this.loadConfig();
                this.populateForm();
                this.showToast('Configuration reset to defaults', 'success');
            } else {
                this.showToast('Failed to reset configuration: ' + result.error, 'error');
            }
        } catch (error) {
            this.showToast('Failed to reset configuration: ' + error.message, 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const messageEl = document.getElementById('toastMessage');
        
        messageEl.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }

    hideToast() {
        document.getElementById('toast').classList.remove('show');
    }
}

const configManager = new ConfigManager();