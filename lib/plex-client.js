const axios = require('axios');
const { parseString } = require('xml2js');
const { promisify } = require('util');
const logger = require('./logger');

const parseXML = promisify(parseString);

class PlexClient {
  constructor(serverUrl, token, options = {}) {
    if (typeof serverUrl !== 'string') {
      throw new Error(`Server URL must be a string, got ${typeof serverUrl}: ${serverUrl}`);
    }
    
    this.serverUrl = serverUrl.trim().replace(/\/$/, '');
    this.token = String(token || '').trim();
    this.timeout = options.timeout || parseInt(process.env.PLEX_TIMEOUT) || 10000;
    this.retryAttempts = options.retryAttempts || parseInt(process.env.PLEX_RETRY_ATTEMPTS) || 3;
    this.retryDelay = options.retryDelay || parseInt(process.env.PLEX_RETRY_DELAY) || 2000;
    this.debugEnabled = process.env.DEBUG_PLEX === 'true';
    
    this.client = axios.create({
      baseURL: this.serverUrl,
      timeout: this.timeout,
      headers: {
        'X-Plex-Token': this.token,
        'Accept': 'application/json',
        'User-Agent': 'Plex-Playlist-Manager/1.0.0'
      }
    });
    
    // Add request/response interceptors for logging
    this.setupInterceptors();
    
    logger.plexDebug('PlexClient initialized', {
      serverUrl: this.serverUrl,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    });
  }
  
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.debugEnabled) {
          logger.plexDebug('Request sent', {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            timeout: config.timeout
          });
        }
        return config;
      },
      (error) => {
        logger.plexError('Request failed', error);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        if (this.debugEnabled) {
          logger.plexDebug('Response received', {
            status: response.status,
            statusText: response.statusText,
            url: response.config.url,
            responseTime: response.headers['x-response-time']
          });
        }
        return response;
      },
      (error) => {
        const errorDetails = {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        };
        
        if (error.code === 'ECONNREFUSED') {
          errorDetails.suggestion = 'Check if Plex Media Server is running and accessible';
        } else if (error.code === 'ETIMEDOUT') {
          errorDetails.suggestion = 'Server is taking too long to respond, check network connection';
        } else if (error.response?.status === 401) {
          errorDetails.suggestion = 'Invalid Plex token, please check your authentication token';
        } else if (error.response?.status === 404) {
          errorDetails.suggestion = 'Endpoint not found, check server URL and Plex version';
        }
        
        logger.plexError('Response error', error, errorDetails);
        return Promise.reject(error);
      }
    );
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async retryRequest(requestFn, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.plexDebug(`Attempt ${attempt}/${this.retryAttempts}`, { context });
        const result = await requestFn();
        
        if (attempt > 1) {
          logger.plexConnection(`${context} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          logger.plexDebug(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
            context,
            error: error.message
          });
          await this.sleep(delay);
        } else {
          logger.plexError(`All ${this.retryAttempts} attempts failed`, error, { context });
        }
      }
    }
    
    throw lastError;
  }

  async testConnection() {
    logger.plexConnection('Testing connection', {
      serverUrl: this.serverUrl,
      timeout: this.timeout
    });
    
    return await this.retryRequest(async () => {
      try {
        // Try multiple endpoints to ensure server is responsive
        const endpoints = ['/', '/identity', '/library/sections'];
        let successfulEndpoint = null;
        
        for (const endpoint of endpoints) {
          try {
            const response = await this.client.get(endpoint);
            if (response.status === 200) {
              successfulEndpoint = endpoint;
              logger.plexConnection('Connection successful', {
                endpoint: successfulEndpoint,
                status: response.status,
                serverVersion: response.headers['x-plex-version'],
                serverPlatform: response.headers['x-plex-platform']
              });
              return true;
            }
          } catch (endpointError) {
            logger.plexDebug(`Endpoint ${endpoint} failed`, {
              error: endpointError.message,
              status: endpointError.response?.status
            });
            continue;
          }
        }
        
        throw new Error('No responsive endpoints found');
        
      } catch (error) {
        // Enhanced error messages based on error type
        let enhancedMessage = error.message;
        let troubleshooting = [];
        
        if (error.code === 'ECONNREFUSED') {
          enhancedMessage = 'Connection refused - Plex server is not running or not accessible';
          troubleshooting = [
            'Verify Plex Media Server is running',
            'Check if the server URL is correct',
            'Ensure the port (usually 32400) is not blocked by firewall',
            'Try accessing the server URL in a web browser'
          ];
        } else if (error.code === 'ENOTFOUND') {
          enhancedMessage = 'Server not found - hostname could not be resolved';
          troubleshooting = [
            'Check if the server hostname/IP is correct',
            'Verify network connectivity',
            'Try using IP address instead of hostname'
          ];
        } else if (error.code === 'ETIMEDOUT') {
          enhancedMessage = 'Connection timeout - server is not responding';
          troubleshooting = [
            'Check network connectivity',
            'Verify server is not overloaded',
            'Try increasing timeout in settings'
          ];
        } else if (error.response?.status === 401) {
          enhancedMessage = 'Authentication failed - invalid Plex token';
          troubleshooting = [
            'Verify your Plex token is correct',
            'Generate a new token if needed',
            'Check token has proper permissions'
          ];
        } else if (error.response?.status === 403) {
          enhancedMessage = 'Access forbidden - insufficient permissions';
          troubleshooting = [
            'Check if your Plex account has admin privileges',
            'Verify token permissions',
            'Ensure server allows remote connections'
          ];
        }
        
        const connectionError = new Error(enhancedMessage);
        connectionError.originalError = error;
        connectionError.troubleshooting = troubleshooting;
        connectionError.serverUrl = this.serverUrl;
        connectionError.errorCode = error.code;
        connectionError.httpStatus = error.response?.status;
        
        throw connectionError;
      }
    }, 'Connection test');
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

module.exports = PlexClient;