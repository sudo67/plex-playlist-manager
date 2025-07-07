import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

export class PlexClient {
  constructor(serverUrl, token) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.token = token;
    this.client = axios.create({
      baseURL: this.serverUrl,
      headers: {
        'X-Plex-Token': this.token,
        'Accept': 'application/json'
      }
    });
  }

  async testConnection() {
    try {
      const response = await this.client.get('/');
      return response.status === 200;
    } catch (error) {
      throw new Error(`Failed to connect to Plex server: ${error.message}`);
    }
  }

  async getLibraries() {
    try {
      const response = await this.client.get('/library/sections');
      return response.data.MediaContainer.Directory || [];
    } catch (error) {
      throw new Error(`Failed to get libraries: ${error.message}`);
    }
  }

  async getPlaylists() {
    try {
      const response = await this.client.get('/playlists');
      return response.data.MediaContainer.Metadata || [];
    } catch (error) {
      throw new Error(`Failed to get playlists: ${error.message}`);
    }
  }

  async getPlaylistItems(playlistId) {
    try {
      const response = await this.client.get(`/playlists/${playlistId}/items`);
      return response.data.MediaContainer.Metadata || [];
    } catch (error) {
      throw new Error(`Failed to get playlist items: ${error.message}`);
    }
  }

  async createPlaylist(title, type = 'audio', smart = 0, uri = '') {
    try {
      const params = new URLSearchParams({
        title,
        type,
        smart: smart.toString(),
        uri
      });

      const response = await this.client.post(`/playlists?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create playlist: ${error.message}`);
    }
  }

  async addToPlaylist(playlistId, uri) {
    try {
      const params = new URLSearchParams({ uri });
      const response = await this.client.put(`/playlists/${playlistId}/items?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to add items to playlist: ${error.message}`);
    }
  }

  async removeFromPlaylist(playlistId, playlistItemId) {
    try {
      const response = await this.client.delete(`/playlists/${playlistId}/items/${playlistItemId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to remove item from playlist: ${error.message}`);
    }
  }

  async deletePlaylist(playlistId) {
    try {
      const response = await this.client.delete(`/playlists/${playlistId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete playlist: ${error.message}`);
    }
  }

  async searchLibrary(libraryId, query) {
    try {
      const params = new URLSearchParams({ query });
      const response = await this.client.get(`/library/sections/${libraryId}/search?${params}`);
      return response.data.MediaContainer.Metadata || [];
    } catch (error) {
      throw new Error(`Failed to search library: ${error.message}`);
    }
  }
}