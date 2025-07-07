const PlexClient = require('./plex-client');

class PlaylistManager {
  constructor(plexClient) {
    this.client = plexClient;
  }

  async initialize() {
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Plex server');
    }
    console.log('✅ Connected to Plex server');
  }

  async listPlaylists() {
    const playlists = await this.client.getPlaylists();
    
    if (playlists.length === 0) {
      console.log('No playlists found');
      return [];
    }

    console.log('\n📋 Playlists:');
    playlists.forEach((playlist, index) => {
      console.log(`${index + 1}. ${playlist.title} (${playlist.leafCount || 0} items)`);
    });

    return playlists;
  }

  async showPlaylistDetails(playlistId) {
    const playlists = await this.client.getPlaylists();
    const playlist = playlists.find(p => p.ratingKey === playlistId);
    
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    console.log(`\n🎵 Playlist: ${playlist.title}`);
    console.log(`Items: ${playlist.leafCount || 0}`);
    console.log(`Type: ${playlist.playlistType || 'Unknown'}`);
    
    const items = await this.client.getPlaylistItems(playlistId);
    
    if (items.length > 0) {
      console.log('\nTracks:');
      items.forEach((item, index) => {
        const artist = item.grandparentTitle || 'Unknown Artist';
        const album = item.parentTitle || 'Unknown Album';
        const title = item.title || 'Unknown Title';
        console.log(`${index + 1}. ${artist} - ${title} (${album})`);
      });
    }

    return { playlist, items };
  }

  async createPlaylist(title, type = 'audio') {
    console.log(`Creating playlist: ${title}`);
    const result = await this.client.createPlaylist(title, type);
    console.log('✅ Playlist created successfully');
    return result;
  }

  async deletePlaylist(playlistId) {
    const playlists = await this.client.getPlaylists();
    const playlist = playlists.find(p => p.ratingKey === playlistId);
    
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    console.log(`Deleting playlist: ${playlist.title}`);
    await this.client.deletePlaylist(playlistId);
    console.log('✅ Playlist deleted successfully');
  }

  async searchAndAddToPlaylist(playlistId, searchQuery, libraryId = null) {
    if (!libraryId) {
      const libraries = await this.client.getLibraries();
      const musicLibrary = libraries.find(lib => lib.type === 'artist');
      if (!musicLibrary) {
        throw new Error('No music library found');
      }
      libraryId = musicLibrary.key;
    }

    console.log(`Searching for: ${searchQuery}`);
    const searchResults = await this.client.searchLibrary(libraryId, searchQuery);
    
    if (searchResults.length === 0) {
      console.log('No results found');
      return;
    }

    console.log(`Found ${searchResults.length} results:`);
    searchResults.forEach((item, index) => {
      const artist = item.grandparentTitle || 'Unknown Artist';
      const title = item.title || 'Unknown Title';
      console.log(`${index + 1}. ${artist} - ${title}`);
    });

    const uris = searchResults.map(item => `server://localhost/com.plexapp.plugins.library/library/metadata/${item.ratingKey}`);
    const uri = uris.join(',');
    
    await this.client.addToPlaylist(playlistId, uri);
    console.log(`✅ Added ${searchResults.length} items to playlist`);
  }

  async removeFromPlaylist(playlistId, itemIndex) {
    const items = await this.client.getPlaylistItems(playlistId);
    
    if (itemIndex < 0 || itemIndex >= items.length) {
      throw new Error('Invalid item index');
    }

    const item = items[itemIndex];
    const playlistItemId = item.playlistItemID;
    
    console.log(`Removing: ${item.title}`);
    await this.client.removeFromPlaylist(playlistId, playlistItemId);
    console.log('✅ Item removed from playlist');
  }

  async getLibraries() {
    const libraries = await this.client.getLibraries();
    console.log('\n📚 Libraries:');
    libraries.forEach((library, index) => {
      console.log(`${index + 1}. ${library.title} (${library.type})`);
    });
    return libraries;
  }
}

module.exports = PlaylistManager;