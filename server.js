const express = require('express');
const cors = require('cors');
const path = require('path');
const PlexClient = require('./lib/plex-client');
const PlaylistManager = require('./lib/playlist-manager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let plexClient = null;
let playlistManager = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post('/api/connect', async (req, res) => {
    try {
        const { serverUrl, token } = req.body;
        
        if (!serverUrl || !token) {
            return res.status(400).json({ error: 'Server URL and token are required' });
        }

        plexClient = new PlexClient(serverUrl, token);
        await plexClient.testConnection();
        
        playlistManager = new PlaylistManager(plexClient);
        
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

app.listen(PORT, () => {
    console.log(`Plex Playlist Manager Web UI running on http://localhost:${PORT}`);
});