const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Groove Music Pass',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: true,
    backgroundColor: '#1f1f1f',
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handler to open audio files
ipcMain.handle('select-audio-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] }
    ]
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths.map(filePath => {
    const fileName = path.basename(filePath);
    const nameWithoutExt = path.parse(fileName).name;
    const parts = nameWithoutExt.split(' - ');

    return {
      path: filePath,
      title: parts.length > 1 ? parts[1].trim() : nameWithoutExt,
      artist: parts.length > 1 ? parts[0].trim() : 'Unknown Artist',
      album: 'Local Library',
      duration: '3:30',
      source: 'local'
    };
  });
});

// IPC handler to save exported Spotify CSV / JSON playlist
ipcMain.handle('save-playlist-file', async (event, { name, content, extension }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export Playlist: ${name}`,
    defaultPath: `${name}.${extension}`,
    filters: [
      { name: extension.toUpperCase(), extensions: [extension] }
    ]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('open-external-url', async (event, url) => {
  await shell.openExternal(url);
});
