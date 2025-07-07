const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.enableFileLogging = process.env.LOG_TO_FILE === 'true';
        this.logDir = path.join(__dirname, '..', 'logs');
        this.logFile = path.join(this.logDir, 'app.log');
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        this.colors = {
            error: '\x1b[31m',
            warn: '\x1b[33m',
            info: '\x1b[36m',
            debug: '\x1b[35m',
            trace: '\x1b[37m',
            reset: '\x1b[0m'
        };
        
        this.initializeFileLogging();
    }
    
    initializeFileLogging() {
        if (this.enableFileLogging) {
            try {
                if (!fs.existsSync(this.logDir)) {
                    fs.mkdirSync(this.logDir, { recursive: true });
                }
            } catch (error) {
                console.warn('Failed to create log directory:', error.message);
                this.enableFileLogging = false;
            }
        }
    }
    
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }
    
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    }
    
    writeToFile(formattedMessage) {
        if (this.enableFileLogging) {
            try {
                fs.appendFileSync(this.logFile, formattedMessage + '\n');
            } catch (error) {
                console.warn('Failed to write to log file:', error.message);
            }
        }
    }
    
    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;
        
        const formattedMessage = this.formatMessage(level, message, meta);
        const coloredMessage = `${this.colors[level]}${formattedMessage}${this.colors.reset}`;
        
        // Console output
        if (level === 'error') {
            console.error(coloredMessage);
        } else if (level === 'warn') {
            console.warn(coloredMessage);
        } else {
            console.log(coloredMessage);
        }
        
        // File output (without colors)
        this.writeToFile(formattedMessage);
    }
    
    error(message, meta = {}) {
        this.log('error', message, meta);
    }
    
    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }
    
    info(message, meta = {}) {
        this.log('info', message, meta);
    }
    
    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }
    
    trace(message, meta = {}) {
        this.log('trace', message, meta);
    }
    
    // Plex-specific logging methods
    plexConnection(action, details = {}) {
        this.info(`Plex Connection: ${action}`, details);
    }
    
    plexError(action, error, details = {}) {
        this.error(`Plex Error: ${action}`, {
            error: error.message,
            stack: error.stack,
            ...details
        });
    }
    
    plexDebug(action, details = {}) {
        this.debug(`Plex Debug: ${action}`, details);
    }
    
    // Server-specific logging methods
    serverStart(port, host = 'localhost') {
        this.info(`Server started on http://${host}:${port}`);
    }
    
    serverError(error, context = {}) {
        this.error('Server Error', {
            error: error.message,
            stack: error.stack,
            ...context
        });
    }
    
    // API request logging
    apiRequest(method, path, details = {}) {
        this.debug(`API Request: ${method} ${path}`, details);
    }
    
    apiError(method, path, error, details = {}) {
        this.error(`API Error: ${method} ${path}`, {
            error: error.message,
            ...details
        });
    }
    
    // Configuration logging
    configLoad(source, success = true) {
        if (success) {
            this.info(`Configuration loaded from ${source}`);
        } else {
            this.warn(`Failed to load configuration from ${source}`);
        }
    }
    
    configSave(success = true) {
        if (success) {
            this.info('Configuration saved successfully');
        } else {
            this.error('Failed to save configuration');
        }
    }
    
    // Clear log file
    clearLogs() {
        if (this.enableFileLogging && fs.existsSync(this.logFile)) {
            try {
                fs.writeFileSync(this.logFile, '');
                this.info('Log file cleared');
            } catch (error) {
                this.error('Failed to clear log file', { error: error.message });
            }
        }
    }
    
    // Get recent logs
    getRecentLogs(lines = 100) {
        if (!this.enableFileLogging || !fs.existsSync(this.logFile)) {
            return [];
        }
        
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            const allLines = content.split('\n').filter(line => line.trim());
            return allLines.slice(-lines);
        } catch (error) {
            this.error('Failed to read log file', { error: error.message });
            return [];
        }
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;