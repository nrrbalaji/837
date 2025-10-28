# Install Required Dependencies

## NPM Packages

Run the following command in the backend directory to install required dependencies:

```bash
cd backend
npm install ssh2-sftp-client@^9.1.0 chokidar@^3.5.3
```

## Package Details

### ssh2-sftp-client (v9.1.0)
- **Purpose:** SFTP client for Node.js
- **Used in:** `backend/services/ftpIngestionService.js`
- **Features:** SSH2-based SFTP operations, supports password and key authentication
- **License:** MIT
- **Repository:** https://github.com/theophilusx/ssh2-sftp-client

### chokidar (v3.5.3)
- **Purpose:** Efficient file system watcher
- **Used in:** `backend/services/fileWatcherService.js`
- **Features:** Cross-platform, debouncing, recursive watching
- **License:** MIT
- **Repository:** https://github.com/paulmillr/chokidar

## Verify Installation

After running the install command, verify the packages are installed:

```bash
npm list ssh2-sftp-client
npm list chokidar
```

## Add to package.json

If you want to manually add to `package.json`:

```json
{
  "dependencies": {
    "ssh2-sftp-client": "^9.1.0",
    "chokidar": "^3.5.3"
  }
}
```

Then run:

```bash
npm install
```

## Production Installation

For production environments:

```bash
npm install --production ssh2-sftp-client@^9.1.0 chokidar@^3.5.3
```

## Troubleshooting

### Issue: "Cannot find module 'ssh2-sftp-client'"

**Solution:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Native compilation errors with chokidar

**Solution:**
Chokidar may require native compilation on some systems. Ensure you have:
- Node.js build tools installed
- Python 2.7 or 3.x (for node-gyp)

**Windows:**
```bash
npm install --global windows-build-tools
```

**Linux/Mac:**
```bash
# Usually pre-installed, but if needed:
sudo apt-get install build-essential  # Ubuntu/Debian
brew install python3  # macOS
```

## Next Steps

After installing dependencies, continue with the installation guide:
See `INSTALLATION_GUIDE.md` for complete setup instructions.
