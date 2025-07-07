# Plex Playlist Manager

A Node.js CLI application to connect to your Plex Media Server and manage playlists.

## Features

- ✅ Connect to Plex Media Server
- 📋 List all playlists
- 🔍 View playlist details and tracks
- ➕ Create new playlists
- 🗑️ Delete playlists
- 🎵 Search and add tracks to playlists
- ➖ Remove tracks from playlists
- 📚 List media libraries

## Prerequisites

- Node.js 16+ installed
- Access to a Plex Media Server
- Plex authentication token

## Setup

1. **Clone or download this project**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Get your Plex token:**
   - Visit: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
   - Follow the instructions to find your X-Plex-Token

4. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Plex server details:
   ```
   PLEX_SERVER_URL=http://your-plex-server:32400
   PLEX_TOKEN=your_plex_token_here
   ```

## Usage

### List all playlists
```bash
npm start list
```

### Show playlist details
```bash
npm start show <playlist-id>
```

### Create a new playlist
```bash
npm start create "My New Playlist"
npm start create "My Video Playlist" --type video
```

### Delete a playlist
```bash
npm start delete <playlist-id>
```

### Add tracks to a playlist
```bash
npm start add <playlist-id> "artist name"
npm start add <playlist-id> "song title" --library <library-id>
```

### Remove a track from playlist
```bash
npm start remove <playlist-id> <track-index>
```

### List all libraries
```bash
npm start libraries
```

### Help
```bash
npm start --help
```

## Examples

```bash
# List all playlists
npm start list

# Show details of playlist with ID 12345
npm start show 12345

# Create a new audio playlist
npm start create "Road Trip Mix"

# Search for Beatles songs and add to playlist 12345
npm start add 12345 "Beatles"

# Remove the first track (index 0) from playlist 12345
npm start remove 12345 0

# Delete playlist 12345
npm start delete 12345
```

## Troubleshooting

### Connection Issues
- Verify your Plex server is running and accessible
- Check that your `PLEX_SERVER_URL` is correct
- Ensure your `PLEX_TOKEN` is valid and has appropriate permissions

### Permission Issues
- Make sure your Plex token has admin privileges
- Verify you can access the Plex server from the machine running this tool

### Library Issues
- Use `npm start libraries` to see available libraries
- Some operations require a music library to be present

## API Reference

The app uses the Plex Media Server API. Key endpoints used:
- `/library/sections` - Get libraries
- `/playlists` - Get/create/delete playlists
- `/playlists/{id}/items` - Get/add/remove playlist items
- `/library/sections/{id}/search` - Search library content

## License

MIT