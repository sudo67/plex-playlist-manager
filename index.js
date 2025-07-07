#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { PlaylistManager } from './lib/playlist-manager.js';

dotenv.config();

const program = new Command();

program
  .name('plex-playlist-manager')
  .description('CLI tool to manage Plex Media Server playlists')
  .version('1.0.0');

const serverUrl = process.env.PLEX_SERVER_URL || 'http://localhost:32400';
const token = process.env.PLEX_TOKEN;

if (!token) {
  console.error('❌ PLEX_TOKEN environment variable is required');
  console.log('Please set your Plex token in a .env file or environment variable');
  console.log('You can find your token at: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/');
  process.exit(1);
}

const manager = new PlaylistManager(serverUrl, token);

program
  .command('list')
  .description('List all playlists')
  .action(async () => {
    try {
      await manager.initialize();
      await manager.listPlaylists();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('show <playlistId>')
  .description('Show playlist details and tracks')
  .action(async (playlistId) => {
    try {
      await manager.initialize();
      await manager.showPlaylistDetails(playlistId);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('create <title>')
  .description('Create a new playlist')
  .option('-t, --type <type>', 'Playlist type (audio, video)', 'audio')
  .action(async (title, options) => {
    try {
      await manager.initialize();
      await manager.createPlaylist(title, options.type);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('delete <playlistId>')
  .description('Delete a playlist')
  .action(async (playlistId) => {
    try {
      await manager.initialize();
      await manager.deletePlaylist(playlistId);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('add <playlistId> <searchQuery>')
  .description('Search for tracks and add them to a playlist')
  .option('-l, --library <libraryId>', 'Library ID to search in')
  .action(async (playlistId, searchQuery, options) => {
    try {
      await manager.initialize();
      await manager.searchAndAddToPlaylist(playlistId, searchQuery, options.library);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('remove <playlistId> <itemIndex>')
  .description('Remove a track from a playlist by index (0-based)')
  .action(async (playlistId, itemIndex) => {
    try {
      await manager.initialize();
      await manager.removeFromPlaylist(playlistId, parseInt(itemIndex));
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('libraries')
  .description('List all libraries')
  .action(async () => {
    try {
      await manager.initialize();
      await manager.getLibraries();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse();