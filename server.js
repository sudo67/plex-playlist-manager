const express = require('express');
const cors = require('cors');
const path = require('path');
const PlexClient = require('./lib/plex-client');
const PlaylistManager = require('./lib/playlist-manager');
const ConfigManager = require('./lib/config-manager');

const app = express();
const configManager = new ConfigManager();
const serverConfig = configManager.getServerConfig();
const PORT = process.env.PORT || serverConfig.port;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let plexClient = null;
let playlistManager = null;

async function initializePlexConnection() {
    const plexConfig = configManager.getPlexConfig();
    if (plexConfig.autoConnect && plexConfig.serverUrl && plexConfig.token) {
        try {
            plexClient = new PlexClient(plexConfig.serverUrl, plexConfig.token);
            await plexClient.testConnection();
            playlistManager = new PlaylistManager(plexClient);
            console.log('Auto-connected to Plex server');
        } catch (error) {
            console.warn('Auto-connection to Plex failed:', error.message);
        }
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
        const commonPorts = [32400, 32401, 32402];
        const commonHosts = ['localhost', '127.0.0.1', 'plex.local'];
        const discoveries = [];
        
        for (const host of commonHosts) {
            for (const port of commonPorts) {
                const url = `http://${host}:${port}`;
                try {
                    const testClient = new PlexClient(url, 'test');
                    const response = await fetch(`${url}/identity`, { 
                        method: 'GET',
                        timeout: 2000 
                    });
                    if (response.ok) {
                        const data = await response.text();
                        discoveries.push({
                            url,
                            status: 'reachable',
                            info: data.includes('MediaContainer') ? 'Plex Server Found' : 'Unknown Service'
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
        
        if (!serverUrl || !token) {
            return res.status(400).json({ error: 'Server URL and token are required' });
        }

        plexClient = new PlexClient(serverUrl, token);
        await plexClient.testConnection();
        
        playlistManager = new PlaylistManager(plexClient);
        
        if (saveConfig) {
            configManager.update({
                plex: {
                    serverUrl,
                    token,
                    autoConnect: true
                }
            });
        }
        
        res.json({ success: true, message: 'Connected to Plex server successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

app.listen(PORT, async () => {
    console.log(`Plex Playlist Manager Web UI running on http://localhost:${PORT}`);
    console.log(`Setup completed: ${configManager.isSetupCompleted()}`);
    
    if (!configManager.isSetupCompleted()) {
        console.log('First time setup required. Visit http://localhost:' + PORT + ' to get started.');
    } else {
        await initializePlexConnection();
    }
});