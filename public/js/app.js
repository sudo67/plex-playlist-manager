class PlexPlaylistManager {
    constructor() {
        this.isConnected = false;
        this.currentPlaylist = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateConnectionStatus();
    }

    bindEvents() {
        document.getElementById('connectionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.connect();
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        document.getElementById('createPlaylistBtn').addEventListener('click', () => {
            this.showCreatePlaylistModal();
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.hideModal('playlistModal');
        });

        document.getElementById('playlistDetailsClose').addEventListener('click', () => {
            this.hideModal('playlistDetailsModal');
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal('playlistModal');
        });

        document.getElementById('playlistForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createPlaylist();
        });

        document.getElementById('searchBtn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        document.getElementById('toastClose').addEventListener('click', () => {
            this.hideToast();
        });

        // Logs functionality
        document.getElementById('refreshLogsBtn').addEventListener('click', () => {
            this.loadLogs();
        });

        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('logLevelFilter').addEventListener('change', () => {
            this.filterLogs();
        });

        document.getElementById('logSearchFilter').addEventListener('input', () => {
            this.filterLogs();
        });
    }

    async connect() {
        const serverUrl = document.getElementById('serverUrl').value;
        const token = document.getElementById('token').value;

        if (!serverUrl || !token) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

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
                this.isConnected = true;
                this.updateConnectionStatus();
                this.showDashboard();
                this.loadPlaylists();
                this.loadLibraries();
                this.showToast('Connected successfully!', 'success');
            } else {
                this.showToast(result.error || 'Connection failed', 'error');
            }
        } catch (error) {
            this.showToast('Connection failed: ' + error.message, 'error');
        }
    }

    updateConnectionStatus() {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');

        if (this.isConnected) {
            statusIndicator.classList.add('online');
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.classList.remove('online');
            statusText.textContent = 'Not Connected';
        }
    }

    showDashboard() {
        document.getElementById('connectionPanel').style.display = 'none';
        document.getElementById('dashboard').style.display = 'grid';
    }

    switchView(viewName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        document.getElementById(`${viewName}View`).classList.add('active');

        if (viewName === 'playlists') {
            this.loadPlaylists();
        } else if (viewName === 'libraries') {
            this.loadLibraries();
        } else if (viewName === 'logs') {
            this.loadLogs();
        }
    }

    async loadPlaylists() {
        const grid = document.getElementById('playlistsGrid');
        grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading playlists...</div>';

        try {
            const response = await fetch('/api/playlists');
            const playlists = await response.json();

            if (response.ok) {
                this.renderPlaylists(playlists);
            } else {
                grid.innerHTML = `<div class="error">Error loading playlists: ${playlists.error}</div>`;
            }
        } catch (error) {
            grid.innerHTML = `<div class="error">Error loading playlists: ${error.message}</div>`;
        }
    }

    renderPlaylists(playlists) {
        const grid = document.getElementById('playlistsGrid');
        
        if (playlists.length === 0) {
            grid.innerHTML = '<div class="empty-state">No playlists found. Create your first playlist!</div>';
            return;
        }

        grid.innerHTML = playlists.map(playlist => `
            <div class="playlist-card" onclick="app.viewPlaylist('${playlist.ratingKey}')">
                <h3>${playlist.title}</h3>
                <div class="playlist-meta">
                    <i class="fas fa-music"></i> ${playlist.leafCount || 0} tracks
                    <br>
                    <i class="fas fa-clock"></i> ${playlist.duration ? this.formatDuration(playlist.duration) : 'Unknown'}
                </div>
                <div class="playlist-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-secondary" onclick="app.viewPlaylist('${playlist.ratingKey}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-danger" onclick="app.deletePlaylist('${playlist.ratingKey}', '${playlist.title}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadLibraries() {
        const grid = document.getElementById('librariesGrid');
        grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading libraries...</div>';

        try {
            const response = await fetch('/api/libraries');
            const libraries = await response.json();

            if (response.ok) {
                this.renderLibraries(libraries);
            } else {
                grid.innerHTML = `<div class="error">Error loading libraries: ${libraries.error}</div>`;
            }
        } catch (error) {
            grid.innerHTML = `<div class="error">Error loading libraries: ${error.message}</div>`;
        }
    }

    renderLibraries(libraries) {
        const grid = document.getElementById('librariesGrid');
        
        if (libraries.length === 0) {
            grid.innerHTML = '<div class="empty-state">No libraries found.</div>';
            return;
        }

        grid.innerHTML = libraries.map(library => `
            <div class="library-card">
                <i class="fas fa-${this.getLibraryIcon(library.type)}"></i>
                <h3>${library.title}</h3>
                <p>${library.type}</p>
            </div>
        `).join('');
    }

    getLibraryIcon(type) {
        const icons = {
            'movie': 'film',
            'show': 'tv',
            'artist': 'music',
            'photo': 'images'
        };
        return icons[type] || 'folder';
    }

    showCreatePlaylistModal() {
        document.getElementById('playlistName').value = '';
        this.showModal('playlistModal');
    }

    async createPlaylist() {
        const name = document.getElementById('playlistName').value.trim();
        
        if (!name) {
            this.showToast('Please enter a playlist name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/playlists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name }),
            });

            const result = await response.json();

            if (response.ok) {
                this.hideModal('playlistModal');
                this.loadPlaylists();
                this.showToast('Playlist created successfully!', 'success');
            } else {
                this.showToast(result.error || 'Failed to create playlist', 'error');
            }
        } catch (error) {
            this.showToast('Failed to create playlist: ' + error.message, 'error');
        }
    }

    async deletePlaylist(id, name) {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/playlists/${id}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (response.ok) {
                this.loadPlaylists();
                this.showToast('Playlist deleted successfully!', 'success');
            } else {
                this.showToast(result.error || 'Failed to delete playlist', 'error');
            }
        } catch (error) {
            this.showToast('Failed to delete playlist: ' + error.message, 'error');
        }
    }

    async viewPlaylist(id) {
        try {
            const response = await fetch(`/api/playlists/${id}`);
            const playlist = await response.json();

            if (response.ok) {
                this.showPlaylistDetails(playlist);
            } else {
                this.showToast(playlist.error || 'Failed to load playlist details', 'error');
            }
        } catch (error) {
            this.showToast('Failed to load playlist details: ' + error.message, 'error');
        }
    }

    showPlaylistDetails(playlist) {
        document.getElementById('playlistDetailsTitle').textContent = playlist.title;
        
        const info = document.getElementById('playlistInfo');
        info.innerHTML = `
            <div class="playlist-summary">
                <h4>${playlist.title}</h4>
                <p><i class="fas fa-music"></i> ${playlist.leafCount || 0} tracks</p>
                <p><i class="fas fa-clock"></i> ${playlist.duration ? this.formatDuration(playlist.duration) : 'Unknown duration'}</p>
            </div>
        `;

        const tracks = document.getElementById('playlistTracks');
        if (playlist.Metadata && playlist.Metadata.length > 0) {
            tracks.innerHTML = `
                <h4>Tracks</h4>
                ${playlist.Metadata.map(track => `
                    <div class="track-item">
                        <div class="track-info">
                            <h5>${track.title}</h5>
                            <p>${track.grandparentTitle || 'Unknown Artist'} - ${track.parentTitle || 'Unknown Album'}</p>
                        </div>
                        <button class="btn btn-danger" onclick="app.removeTrackFromPlaylist('${playlist.ratingKey}', '${track.ratingKey}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            `;
        } else {
            tracks.innerHTML = '<p>No tracks in this playlist.</p>';
        }

        this.currentPlaylist = playlist;
        this.showModal('playlistDetailsModal');
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        const results = document.getElementById('searchResults');

        if (!query) {
            this.showToast('Please enter a search term', 'error');
            return;
        }

        results.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=track`);
            const searchResults = await response.json();

            if (response.ok) {
                this.renderSearchResults(searchResults);
            } else {
                results.innerHTML = `<div class="error">Search failed: ${searchResults.error}</div>`;
            }
        } catch (error) {
            results.innerHTML = `<div class="error">Search failed: ${error.message}</div>`;
        }
    }

    renderSearchResults(results) {
        const container = document.getElementById('searchResults');
        
        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state">No results found.</div>';
            return;
        }

        container.innerHTML = results.map(track => `
            <div class="search-result">
                <img src="${track.thumb || '/images/music-placeholder.png'}" alt="${track.title}" onerror="this.src='/images/music-placeholder.png'">
                <div class="search-result-info">
                    <h4>${track.title}</h4>
                    <p>${track.grandparentTitle || 'Unknown Artist'} - ${track.parentTitle || 'Unknown Album'}</p>
                </div>
                <button class="btn btn-primary" onclick="app.showAddToPlaylistOptions('${track.ratingKey}', '${track.title}')">
                    <i class="fas fa-plus"></i> Add to Playlist
                </button>
            </div>
        `).join('');
    }

    async showAddToPlaylistOptions(trackId, trackTitle) {
        try {
            const response = await fetch('/api/playlists');
            const playlists = await response.json();

            if (response.ok && playlists.length > 0) {
                const playlistOptions = playlists.map(playlist => 
                    `<button class="btn btn-secondary" onclick="app.addTrackToPlaylist('${playlist.ratingKey}', '${trackId}', '${trackTitle}', '${playlist.title}')" style="margin: 0.25rem; display: block; width: 100%;">
                        ${playlist.title}
                    </button>`
                ).join('');

                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Add "${trackTitle}" to Playlist</h3>
                            <button class="modal-close" onclick="this.closest('.modal').remove()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            ${playlistOptions}
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            } else {
                this.showToast('No playlists available. Create a playlist first.', 'error');
            }
        } catch (error) {
            this.showToast('Failed to load playlists: ' + error.message, 'error');
        }
    }

    async addTrackToPlaylist(playlistId, trackId, trackTitle, playlistTitle) {
        try {
            const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ trackId }),
            });

            const result = await response.json();

            if (response.ok) {
                this.showToast(`"${trackTitle}" added to "${playlistTitle}"!`, 'success');
                document.querySelector('.modal.active')?.remove();
            } else {
                this.showToast(result.error || 'Failed to add track to playlist', 'error');
            }
        } catch (error) {
            this.showToast('Failed to add track to playlist: ' + error.message, 'error');
        }
    }

    async removeTrackFromPlaylist(playlistId, trackId) {
        try {
            const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (response.ok) {
                this.showToast('Track removed from playlist!', 'success');
                this.viewPlaylist(playlistId);
            } else {
                this.showToast(result.error || 'Failed to remove track', 'error');
            }
        } catch (error) {
            this.showToast('Failed to remove track: ' + error.message, 'error');
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
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

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m ${seconds % 60}s`;
        }
    }

    async loadLogs() {
        const container = document.getElementById('logsContent');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading logs...</div>';

        try {
            const response = await fetch('/api/logs?lines=200');
            const data = await response.json();

            if (response.ok) {
                this.renderLogs(data.logs);
            } else {
                container.innerHTML = `<div class="error">Error loading logs: ${data.error}</div>`;
            }
        } catch (error) {
            container.innerHTML = `<div class="error">Error loading logs: ${error.message}</div>`;
        }
    }

    renderLogs(logs) {
        const container = document.getElementById('logsContent');
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">No logs available.</div>';
            return;
        }

        this.allLogs = logs;
        this.filterLogs();
    }

    filterLogs() {
        if (!this.allLogs) return;

        const levelFilter = document.getElementById('logLevelFilter').value;
        const searchFilter = document.getElementById('logSearchFilter').value.toLowerCase();
        const container = document.getElementById('logsContent');

        let filteredLogs = this.allLogs;

        if (levelFilter) {
            filteredLogs = filteredLogs.filter(log => 
                log.toLowerCase().includes(`[${levelFilter.toUpperCase()}]`)
            );
        }

        if (searchFilter) {
            filteredLogs = filteredLogs.filter(log => 
                log.toLowerCase().includes(searchFilter)
            );
        }

        if (filteredLogs.length === 0) {
            container.innerHTML = '<div class="empty-state">No logs match the current filters.</div>';
            return;
        }

        container.innerHTML = filteredLogs.map(log => {
            const logLevel = this.extractLogLevel(log);
            return `<div class="log-entry ${logLevel}">${this.escapeHtml(log)}</div>`;
        }).join('');

        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    extractLogLevel(logLine) {
        if (logLine.includes('[ERROR]')) return 'error';
        if (logLine.includes('[WARN]')) return 'warn';
        if (logLine.includes('[INFO]')) return 'info';
        if (logLine.includes('[DEBUG]')) return 'debug';
        return 'info';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async clearLogs() {
        if (!confirm('Are you sure you want to clear all logs?')) {
            return;
        }

        try {
            const response = await fetch('/api/logs/clear', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.showToast('Logs cleared successfully', 'success');
                this.loadLogs();
            } else {
                this.showToast('Failed to clear logs: ' + result.error, 'error');
            }
        } catch (error) {
            this.showToast('Failed to clear logs: ' + error.message, 'error');
        }
    }
}

const app = new PlexPlaylistManager();