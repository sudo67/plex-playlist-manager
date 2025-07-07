const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables FIRST
dotenv.config();

const PlexClient = require('./lib/plex-client');
const PlaylistManager = require('./lib/playlist-manager');
const ConfigManager = require('./lib/config-manager');
const logger = require('./lib/logger');

const app = express();
const configManager = new ConfigManager();
const serverConfig = configManager.getServerConfig();

// Priority: ENV variable > config file > default
const PORT = process.env.WEB_PORT || process.env.PORT || serverConfig.port || 3000;
const HOST = process.env.WEB_HOST || serverConfig.host || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Request logging middleware
if (process.env.DEBUG_API === 'true') {
    app.use((req, res, next) => {
        logger.apiRequest(req.method, req.path, {
            query: req.query,
            body: req.method !== 'GET' ? req.body : undefined,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
        next();
    });
}

let plexClient = null;
let playlistManager = null;

async function initializePlexConnection() {
    const plexConfig = configManager.getPlexConfig();
    
    if (!plexConfig.autoConnect) {
        logger.info('Auto-connect disabled, skipping Plex initialization');
        return;
    }
    
    if (!plexConfig.serverUrl || !plexConfig.token) {
        logger.warn('Auto-connect enabled but missing server URL or token');
        return;
    }
    
    logger.plexConnection('Attempting auto-connection', {
        serverUrl: plexConfig.serverUrl,
        tokenLength: plexConfig.token.length
    });
    
    try {
        plexClient = new PlexClient(plexConfig.serverUrl, plexConfig.token);
        await plexClient.testConnection();
        playlistManager = new PlaylistManager(plexClient);
        logger.plexConnection('Auto-connection successful');
    } catch (error) {
        logger.plexError('Auto-connection failed', error, {
            serverUrl: plexConfig.serverUrl,
            troubleshooting: error.troubleshooting
        });
        
        // Reset clients on failure
        plexClient = null;
        playlistManager = null;
    }
}

app.get('/', (req, res) => {
    if (!configManager.isSetupCompleted()) {
        res.sendFile(path.join(__dirname, 'views', 'setup.html'));
    } else {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    }
});

app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'setup.html'));
});

app.get('/config', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'config.html'));
});

app.get('/api/config', (req, res) => {
    res.json({
        config: configManager.config,
        isSetupCompleted: configManager.isSetupCompleted()
    });
});

app.post('/api/config', (req, res) => {
    try {
        const success = configManager.update(req.body);
        if (success) {
            res.json({ success: true, message: 'Configuration updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save configuration' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/setup/complete', async (req, res) => {
    try {
        const { config } = req.body;
        
        if (config) {
            configManager.update(config);
        }
        
        configManager.markSetupCompleted();
        
        if (config?.plex?.autoConnect && config?.plex?.serverUrl && config?.plex?.token) {
            try {
                plexClient = new PlexClient(config.plex.serverUrl, config.plex.token);
                await plexClient.testConnection();
                playlistManager = new PlaylistManager(plexClient);
            } catch (error) {
                console.warn('Failed to auto-connect during setup:', error.message);
            }
        }
        
        res.json({ success: true, message: 'Setup completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/config/reset', (req, res) => {
    try {
        const success = configManager.reset();
        if (success) {
            plexClient = null;
            playlistManager = null;
            res.json({ success: true, message: 'Configuration reset successfully' });
        } else {
            res.status(500).json({ error: 'Failed to reset configuration' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/plex/discover', async (req, res) => {
    logger.info('Starting Plex server discovery');
    
    try {
        const axios = require('axios');
        const os = require('os');
        const discoveries = [];
        const commonPorts = [32400, 32401, 32402, 32403];
        
        // Get local network interfaces to scan local subnet
        const networkInterfaces = os.networkInterfaces();
        const localHosts = ['localhost', '127.0.0.1'];
        
        // Add local network IPs
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    // Add the interface IP itself
                    localHosts.push(iface.address);
                    
                    // Add common local network IPs based on subnet
                    const ipParts = iface.address.split('.');
                    if (ipParts[0] === '192' && ipParts[1] === '168') {
                        // Scan common IPs in 192.168.x.x networks
                        const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
                        for (const lastOctet of [1, 2, 10, 100, 110, 200, 254]) {
                            localHosts.push(`${subnet}.${lastOctet}`);
                        }
                    }
                }
            }
        }
        
        // Add common hostnames
        localHosts.push('plex.local', 'plex', 'mediaserver', 'nas');
        
        // Remove duplicates
        const uniqueHosts = [...new Set(localHosts)];
        
        logger.debug('Scanning hosts for Plex servers', { 
            hostCount: uniqueHosts.length,
            ports: commonPorts 
        });
        
        // Create promises for all host/port combinations
        const scanPromises = [];
        
        for (const host of uniqueHosts) {
            for (const port of commonPorts) {
                const url = `http://${host}:${port}`;
                
                const scanPromise = (async () => {
                    try {
                        logger.trace('Scanning', { url });
                        
                        // Try multiple endpoints to identify Plex
                        const endpoints = ['/identity', '/', '/web'];
                        let bestResponse = null;
                        let serverInfo = null;
                        
                        for (const endpoint of endpoints) {
                            try {
                                const response = await axios.get(`${url}${endpoint}`, { 
                                    timeout: 3000,
                                    validateStatus: () => true,
                                    headers: {
                                        'User-Agent': 'Plex-Playlist-Manager-Discovery/1.0.0'
                                    }
                                });
                                
                                if (response.status === 200) {
                                    bestResponse = response;
                                    
                                    // Check if this is definitely a Plex server
                                    const data = response.data;
                                    const headers = response.headers;
                                    
                                    if (headers['x-plex-protocol'] || 
                                        (typeof data === 'string' && data.includes('Plex')) ||
                                        (typeof data === 'object' && data.MediaContainer)) {
                                        
                                        serverInfo = {
                                            version: headers['x-plex-version'],
                                            platform: headers['x-plex-platform'],
                                            product: headers['x-plex-product'],
                                            protocol: headers['x-plex-protocol']
                                        };
                                        break; // Found Plex server
                                    }
                                }
                            } catch (endpointError) {
                                // Continue to next endpoint
                                continue;
                            }
                        }
                        
                        if (bestResponse && bestResponse.status === 200) {
                            const discovery = {
                                url,
                                status: 'reachable',
                                info: serverInfo ? 'Plex Media Server' : 'Web Service (Unknown)',
                                details: serverInfo || {}
                            };
                            
                            if (serverInfo) {
                                discovery.info = `Plex Media Server ${serverInfo.version || ''}`.trim();
                                discovery.isPlex = true;
                            }
                            
                            logger.debug('Server found', discovery);
                            return discovery;
                        }
                        
                    } catch (error) {
                        logger.trace('Scan failed', { url, error: error.message });
                        return null;
                    }
                })();
                
                scanPromises.push(scanPromise);
            }
        }
        
        // Wait for all scans to complete (with reasonable timeout)
        const results = await Promise.allSettled(scanPromises);
        
        // Collect successful discoveries
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                discoveries.push(result.value);
            }
        }
        
        // Sort discoveries - Plex servers first, then by URL
        discoveries.sort((a, b) => {
            if (a.isPlex && !b.isPlex) return -1;
            if (!a.isPlex && b.isPlex) return 1;
            return a.url.localeCompare(b.url);
        });
        
        logger.info('Plex discovery completed', { 
            found: discoveries.length,
            plexServers: discoveries.filter(d => d.isPlex).length
        });
        
        res.json({ discoveries });
        
    } catch (error) {
        logger.serverError(error, { endpoint: '/api/plex/discover' });
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/connect', async (req, res) => {
    try {
        // Debug the raw request body first
        logger.debug('Raw request body received', {
            body: req.body,
            bodyType: typeof req.body,
            serverUrlRaw: req.body.serverUrl,
            serverUrlRawType: typeof req.body.serverUrl,
            tokenRaw: typeof req.body.token === 'string' ? req.body.token.substring(0, 8) + '...' : req.body.token,
            tokenRawType: typeof req.body.token
        });
        
        let { serverUrl, token, saveConfig = false } = req.body;
        
        // Ensure we have strings
        serverUrl = String(serverUrl || '').trim();
        token = String(token || '').trim();
        
        logger.apiRequest('POST', '/api/connect', {
            serverUrl,
            tokenLength: token.length,
            saveConfig,
            serverUrlType: typeof req.body.serverUrl,
            tokenType: typeof req.body.token
        });
        
        if (!serverUrl || !token) {
            logger.warn('Connection attempt with missing credentials', {
                hasServerUrl: !!serverUrl,
                hasToken: !!token,
                serverUrlLength: serverUrl.length,
                tokenLength: token.length
            });
            return res.status(400).json({ 
                error: 'Server URL and token are required',
                details: {
                    serverUrl: !serverUrl ? 'Server URL is missing or empty' : 'OK',
                    token: !token ? 'Token is missing or empty' : 'OK'
                }
            });
        }

        // Validate URL format
        try {
            new URL(serverUrl);
        } catch (urlError) {
            logger.warn('Invalid server URL format', { serverUrl });
            return res.status(400).json({ 
                error: 'Invalid server URL format',
                details: 'Please provide a valid URL (e.g., http://localhost:32400)'
            });
        }

        logger.plexConnection('Attempting connection', { 
            serverUrl,
            serverUrlType: typeof serverUrl,
            serverUrlLength: serverUrl.length,
            token: token.substring(0, 8) + '...',
            tokenType: typeof token,
            tokenLength: token.length
        });
        
        // Additional validation before creating PlexClient
        if (typeof serverUrl !== 'string') {
            throw new Error(`Server URL must be a string, got ${typeof serverUrl}: ${serverUrl}`);
        }
        
        if (typeof token !== 'string') {
            throw new Error(`Token must be a string, got ${typeof token}: ${token}`);
        }
        
        plexClient = new PlexClient(serverUrl, token);
        await plexClient.testConnection();
        
        playlistManager = new PlaylistManager(plexClient);
        
        if (saveConfig) {
            const configSuccess = configManager.update({
                plex: {
                    serverUrl,
                    token,
                    autoConnect: true
                }
            });
            
            if (configSuccess) {
                logger.configSave(true);
            } else {
                logger.configSave(false);
            }
        }
        
        logger.plexConnection('Connection successful', { serverUrl });
        res.json({ 
            success: true, 
            message: 'Connected to Plex server successfully',
            serverInfo: {
                url: serverUrl,
                connected: true
            }
        });
        
    } catch (error) {
        logger.apiError('POST', '/api/connect', error, {
            serverUrl: req.body.serverUrl,
            errorCode: error.errorCode,
            httpStatus: error.httpStatus
        });
        
        // Reset clients on connection failure
        plexClient = null;
        playlistManager = null;
        
        // Provide detailed error response
        const errorResponse = {
            error: error.message,
            serverUrl: req.body.serverUrl,
            timestamp: new Date().toISOString()
        };
        
        if (error.troubleshooting) {
            errorResponse.troubleshooting = error.troubleshooting;
        }
        
        if (error.errorCode) {
            errorResponse.errorCode = error.errorCode;
        }
        
        if (error.httpStatus) {
            errorResponse.httpStatus = error.httpStatus;
        }
        
        res.status(500).json(errorResponse);
    }
});

app.get('/api/playlists', async (req, res) => {
    try {
        if (!playlistManager) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        const playlists = await playlistManager.listPlaylists();
        console.log('API returning playlists:', playlists.length);
        res.json(playlists);
    } catch (error) {
        console.error('Error in /api/playlists:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/playlists/:id', async (req, res) => {
    try {
        if (!playlistManager) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        const playlist = await playlistManager.getPlaylistDetails(req.params.id);
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/playlists', async (req, res) => {
    try {
        if (!playlistManager) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }
        
        const result = await playlistManager.createPlaylist(name);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/playlists/:id', async (req, res) => {
    try {
        if (!playlistManager) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        await playlistManager.deletePlaylist(req.params.id);
        res.json({ success: true, message: 'Playlist deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/libraries', async (req, res) => {
    try {
        if (!plexClient) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        const libraries = await plexClient.getLibraries();
        res.json(libraries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        if (!plexClient) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        const { query, type } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        const results = await plexClient.searchMedia(query, type);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/playlists/:id/tracks', async (req, res) => {
    try {
        if (!playlistManager) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        const { trackId } = req.body;
        if (!trackId) {
            return res.status(400).json({ error: 'Track ID is required' });
        }
        
        await playlistManager.addTrackToPlaylist(req.params.id, trackId);
        res.json({ success: true, message: 'Track added to playlist' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/playlists/:id/tracks/:trackId', async (req, res) => {
    try {
        if (!playlistManager) {
            return res.status(400).json({ error: 'Not connected to Plex server' });
        }
        
        await playlistManager.removeTrackFromPlaylist(req.params.id, req.params.trackId);
        res.json({ success: true, message: 'Track removed from playlist' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to test request body parsing
app.post('/api/debug/connect', (req, res) => {
    logger.info('Debug connect endpoint called', {
        body: req.body,
        bodyType: typeof req.body,
        serverUrl: req.body.serverUrl,
        serverUrlType: typeof req.body.serverUrl,
        serverUrlConstructor: req.body.serverUrl?.constructor?.name,
        token: req.body.token,
        tokenType: typeof req.body.token,
        headers: req.headers
    });
    
    res.json({
        received: req.body,
        types: {
            serverUrl: typeof req.body.serverUrl,
            token: typeof req.body.token
        }
    });
});

// Add logs endpoint for debugging
app.get('/api/logs', (req, res) => {
    try {
        const lines = parseInt(req.query.lines) || 100;
        const logs = logger.getRecentLogs(lines);
        res.json({ logs });
    } catch (error) {
        logger.serverError(error, { endpoint: '/api/logs' });
        res.status(500).json({ error: 'Failed to retrieve logs' });
    }
});

// Add logs clear endpoint
app.post('/api/logs/clear', (req, res) => {
    try {
        logger.clearLogs();
        res.json({ success: true, message: 'Logs cleared successfully' });
    } catch (error) {
        logger.serverError(error, { endpoint: '/api/logs/clear' });
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

// Global error handler
app.use((error, req, res, next) => {
    logger.serverError(error, {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body
    });
    
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, HOST, async () => {
    logger.serverStart(PORT, HOST);
    logger.info(`Setup completed: ${configManager.isSetupCompleted()}`);
    logger.info(`Log level: ${process.env.LOG_LEVEL || 'info'}`);
    logger.info(`File logging: ${process.env.LOG_TO_FILE === 'true' ? 'enabled' : 'disabled'}`);
    
    if (!configManager.isSetupCompleted()) {
        logger.info(`First time setup required. Visit http://${HOST}:${PORT} to get started.`);
    } else {
        await initializePlexConnection();
    }
});