const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const PlexClient = require('./lib/plex-client');
const PlaylistManager = require('./lib/playlist-manager');
const ConfigManager = require('./lib/config-manager');
const logger = require('./lib/logger');

// Load environment variables
dotenv.config();

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
    try {
        const axios = require('axios');
        const commonPorts = [32400, 32401, 32402];
        const commonHosts = ['localhost', '127.0.0.1', 'plex.local'];
        const discoveries = [];
        
        for (const host of commonHosts) {
            for (const port of commonPorts) {
                const url = `http://${host}:${port}`;
                try {
                    const response = await axios.get(`${url}/identity`, { 
                        timeout: 2000,
                        validateStatus: () => true
                    });
                    if (response.status === 200) {
                        const data = response.data;
                        discoveries.push({
                            url,
                            status: 'reachable',
                            info: (typeof data === 'string' && data.includes('MediaContainer')) || 
                                  (typeof data === 'object' && data.MediaContainer) ? 
                                  'Plex Server Found' : 'Unknown Service'
                        });
                    }
                } catch (error) {
                    // Ignore connection errors for discovery
                }
            }
        }
        
        res.json({ discoveries });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/connect', async (req, res) => {
    try {
        const { serverUrl, token, saveConfig = false } = req.body;
        
        logger.apiRequest('POST', '/api/connect', {
            serverUrl,
            tokenLength: token?.length,
            saveConfig
        });
        
        if (!serverUrl || !token) {
            logger.warn('Connection attempt with missing credentials');
            return res.status(400).json({ 
                error: 'Server URL and token are required',
                details: {
                    serverUrl: !serverUrl ? 'Server URL is missing' : 'OK',
                    token: !token ? 'Token is missing' : 'OK'
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

        logger.plexConnection('Attempting connection', { serverUrl });
        
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
        res.json(playlists);
    } catch (error) {
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
        
        const { query, type = 'track' } = req.query;
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