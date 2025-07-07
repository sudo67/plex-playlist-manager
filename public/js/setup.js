class SetupWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.config = {
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
            }
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStepDisplay();
    }

    bindEvents() {
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevStep());
        document.getElementById('discoverBtn').addEventListener('click', () => this.discoverServers());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        document.getElementById('toastClose').addEventListener('click', () => this.hideToast());

        document.getElementById('manualServerUrl').addEventListener('input', (e) => {
            document.getElementById('serverUrl').value = e.target.value;
        });

        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', () => this.updateConfig());
        });
    }

    updateConfig() {
        this.config.server.port = parseInt(document.getElementById('appPort').value) || 3000;
        this.config.server.host = document.getElementById('appHost').value || 'localhost';
        this.config.plex.serverUrl = document.getElementById('serverUrl').value;
        this.config.plex.token = document.getElementById('plexToken').value;
        this.config.plex.autoConnect = document.getElementById('autoConnect').checked;
        this.config.ui.theme = document.getElementById('theme').value;
        this.config.ui.autoRefresh = document.getElementById('autoRefresh').checked;
        this.config.ui.refreshInterval = (parseInt(document.getElementById('refreshInterval').value) || 30) * 1000;
    }

    async discoverServers() {
        const btn = document.getElementById('discoverBtn');
        const results = document.getElementById('discoveryResults');
        const list = document.getElementById('discoveryList');
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/plex/discover');
            const data = await response.json();
            
            if (data.discoveries && data.discoveries.length > 0) {
                list.innerHTML = data.discoveries.map(discovery => `
                    <div class="discovery-item ${discovery.status}">
                        <div>
                            <strong>${discovery.url}</strong>
                            <br>
                            <small>${discovery.info}</small>
                        </div>
                        <button class="btn btn-secondary" onclick="setupWizard.selectServer('${discovery.url}')">
                            <i class="fas fa-check"></i> Select
                        </button>
                    </div>
                `).join('');
                results.style.display = 'block';
            } else {
                list.innerHTML = '<div class="discovery-item">No Plex servers found on common ports</div>';
                results.style.display = 'block';
            }
        } catch (error) {
            this.showToast('Discovery failed: ' + error.message, 'error');
        }
        
        btn.innerHTML = '<i class="fas fa-search"></i> Scan for Plex Servers';
        btn.disabled = false;
    }

    selectServer(url) {
        document.getElementById('manualServerUrl').value = url;
        document.getElementById('serverUrl').value = url;
        this.updateConfig();
        this.showToast('Server selected: ' + url, 'success');
    }

    async testConnection() {
        const btn = document.getElementById('testConnectionBtn');
        const serverUrl = document.getElementById('serverUrl').value;
        const token = document.getElementById('plexToken').value;
        
        if (!serverUrl || !token) {
            this.showToast('Please enter both server URL and token', 'error');
            return;
        }
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        btn.disabled = true;
        
        try {
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
                this.updateConfig();
            } else {
                this.showToast('Connection failed: ' + result.error, 'error');
            }
        } catch (error) {
            this.showToast('Connection failed: ' + error.message, 'error');
        }
        
        btn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
        btn.disabled = false;
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            if (this.validateStep(this.currentStep)) {
                this.currentStep++;
                this.updateStepDisplay();
                
                if (this.currentStep === 4) {
                    this.showConfigSummary();
                }
            }
        } else {
            this.completeSetup();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    validateStep(step) {
        switch (step) {
            case 1:
                const serverUrl = document.getElementById('manualServerUrl').value || 
                                document.getElementById('serverUrl').value;
                if (!serverUrl) {
                    this.showToast('Please select or enter a Plex server URL', 'error');
                    return false;
                }
                document.getElementById('serverUrl').value = serverUrl;
                return true;
                
            case 2:
                if (!document.getElementById('serverUrl').value) {
                    this.showToast('Please enter a server URL', 'error');
                    return false;
                }
                if (!document.getElementById('plexToken').value) {
                    this.showToast('Please enter your Plex token', 'error');
                    return false;
                }
                this.updateConfig();
                return true;
                
            case 3:
                this.updateConfig();
                return true;
                
            default:
                return true;
        }
    }

    updateStepDisplay() {
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.remove('active');
        });
        
        document.querySelectorAll('.setup-step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 < this.currentStep) {
                step.classList.add('completed');
            } else if (index + 1 === this.currentStep) {
                step.classList.add('active');
            }
        });
        
        document.getElementById(`step${this.currentStep}`).classList.add('active');
        
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.style.display = this.currentStep > 1 ? 'block' : 'none';
        
        if (this.currentStep === this.totalSteps) {
            nextBtn.innerHTML = '<i class="fas fa-check"></i> Complete Setup';
        } else {
            nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
        }
    }

    showConfigSummary() {
        const summary = document.getElementById('configSummary');
        summary.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <strong>Server URL:</strong><br>
                    ${this.config.plex.serverUrl}
                </div>
                <div>
                    <strong>Auto Connect:</strong><br>
                    ${this.config.plex.autoConnect ? 'Yes' : 'No'}
                </div>
                <div>
                    <strong>Web Port:</strong><br>
                    ${this.config.server.port}
                </div>
                <div>
                    <strong>Theme:</strong><br>
                    ${this.config.ui.theme}
                </div>
            </div>
        `;
    }

    async completeSetup() {
        const btn = document.getElementById('nextBtn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/setup/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config: this.config }),
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showToast('Setup completed successfully!', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                this.showToast('Setup failed: ' + result.error, 'error');
                btn.innerHTML = '<i class="fas fa-check"></i> Complete Setup';
                btn.disabled = false;
            }
        } catch (error) {
            this.showToast('Setup failed: ' + error.message, 'error');
            btn.innerHTML = '<i class="fas fa-check"></i> Complete Setup';
            btn.disabled = false;
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

const setupWizard = new SetupWizard();