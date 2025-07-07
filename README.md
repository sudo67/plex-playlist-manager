# Plex Playlist Manager

A modern Node.js application to connect to your Plex Media Server and manage playlists. Available as both a CLI tool and a beautiful web interface.

## Features

### CLI Features
- ✅ Connect to Plex Media Server
- 📋 List all playlists
- 🔍 View playlist details and tracks
- ➕ Create new playlists
- 🗑️ Delete playlists
- 🎵 Search and add tracks to playlists
- ➖ Remove tracks from playlists
- 📚 List media libraries

### Web UI Features
- 🌐 Modern, responsive web interface
- 🎨 Dark theme with intuitive design
- 📱 Mobile-friendly responsive layout
- 🔍 Real-time search functionality
- 🎵 Drag-and-drop playlist management
- 📊 Visual playlist overview
- 🚀 Fast, single-page application
- ⚙️ **First-time setup wizard** with guided configuration
- 🔧 **Advanced configuration page** with all settings
- 🔍 **Automatic Plex server discovery**
- 💾 **Configuration export/import**
- 🔄 **Auto-connect on startup**

## Prerequisites

- Node.js 16+ installed
- Access to a Plex Media Server
- Plex authentication token

## Quick Start

1. **Clone or download this project**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the web interface:**
   ```bash
   npm run web
   ```

4. **Open your browser to:** http://localhost:3000

5. **Follow the setup wizard** - it will guide you through:
   - Finding your Plex server (automatic discovery available)
   - Getting your Plex authentication token (with helpful instructions)
   - Configuring the application settings
   - Testing the connection

That's it! The setup wizard makes configuration easy and provides helpful guidance for each step.

## Manual Configuration (Optional)

If you prefer manual setup or need to configure environment variables:

1. **Get your Plex token:**
   - Visit: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
   - Follow the instructions to find your X-Plex-Token

2. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Plex server details:
   ```
   PLEX_SERVER_URL=http://your-plex-server:32400
   PLEX_TOKEN=your_plex_token_here
   ```

## Usage

### Web Interface (Recommended)

Start the web server:
```bash
npm run web
```

Then open your browser to: http://localhost:3000

#### First Time Setup
On first launch, you'll be guided through a setup wizard that helps you:
- **Discover Plex servers** automatically on your network
- **Configure authentication** with step-by-step token instructions
- **Customize settings** like port, theme, and auto-refresh
- **Test connections** before saving

#### Configuration Management
Access the configuration page anytime via the gear icon (⚙️) in the header:
- **Server settings** - Change port, host, and connection details
- **Plex configuration** - Update server URL, token, and auto-connect
- **Interface settings** - Customize theme, refresh intervals
- **Advanced options** - Export/import config, reset to defaults

#### Custom Port
To run on a different port:
```bash
WEB_PORT=8080 npm run web
```
Or configure it permanently in the settings page.

#### Environment Configuration
Create a `.env` file to customize behavior:
```bash
# Web Server
WEB_PORT=3000
WEB_HOST=localhost

# Logging
LOG_LEVEL=info          # error, warn, info, debug, trace
LOG_TO_FILE=true        # Enable file logging

# Plex Connection
PLEX_TIMEOUT=10000      # Connection timeout (ms)
PLEX_RETRY_ATTEMPTS=3   # Number of retry attempts
PLEX_RETRY_DELAY=2000   # Delay between retries (ms)

# Debug Options
DEBUG_PLEX=false        # Enable detailed Plex debugging
DEBUG_API=false         # Enable API request logging
```

#### Debugging & Troubleshooting
The application includes comprehensive logging and debugging features:

- **Debug Logs View** - Access via the web interface to see real-time logs
- **Robust Error Handling** - Detailed error messages with troubleshooting suggestions
- **Connection Retry Logic** - Automatic retry with exponential backoff
- **File Logging** - Persistent logs saved to `logs/app.log` (when enabled)
- **Multiple Log Levels** - Filter logs by error, warn, info, debug levels

**Common Issues:**
- **Connection Refused**: Check if Plex server is running and accessible
- **Authentication Failed**: Verify your Plex token is correct and has permissions
- **Timeout Errors**: Increase `PLEX_TIMEOUT` or check network connectivity
- **Port Conflicts**: Change `WEB_PORT` to an available port

The web interface provides:
- Easy connection setup with form validation
- Visual playlist management
- Real-time search and add functionality
- Responsive design for desktop and mobile
- Modern, intuitive user experience
- Guided setup for new users
- Comprehensive configuration management

### CLI Interface

For command-line usage:

#### List all playlists
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

### Development

For development with auto-reload:

**Web interface:**
```bash
npm run web-dev
```

**CLI interface:**
```bash
npm run dev
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