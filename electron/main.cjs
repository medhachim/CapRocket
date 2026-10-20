const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { probe, runExport } = require('./ffmpeg.cjs');

const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];

let win;
let currentExport = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#141416',
    title: 'Free Video Editor',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  if (process.env.FVE_SMOKE) {
    win.webContents.once('did-finish-load', () => require('./smoke.cjs')(win, app, process.env.FVE_SMOKE));
  }
}

ipcMain.handle('media:import', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Import media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: [...VIDEO_EXT, ...AUDIO_EXT] },
      { name: 'Video', extensions: VIDEO_EXT },
      { name: 'Audio', extensions: AUDIO_EXT },
    ],
  });
  if (res.canceled) return [];
  const items = [];
  for (const file of res.filePaths) {
    try {
      const info = await probe(file);
      items.push({ path: file, name: path.basename(file), type: info.hasVideo ? 'video' : 'audio', ...info });
    } catch (e) {
      items.push({ path: file, name: path.basename(file), error: e.message });
    }
  }
  return items;
});

ipcMain.handle('project:save', async (_e, json) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Save project',
    defaultPath: 'project.fve.json',
    filters: [{ name: 'Project', extensions: ['json'] }],
  });
  if (res.canceled) return null;
  fs.writeFileSync(res.filePath, json, 'utf8');
  return res.filePath;
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Open project',
    properties: ['openFile'],
    filters: [{ name: 'Project', extensions: ['json'] }],
  });
  if (res.canceled) return null;
  return fs.readFileSync(res.filePaths[0], 'utf8');
});

ipcMain.handle('export:start', async (_e, project) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export video',
    defaultPath: 'export.mp4',
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  });
  if (res.canceled) return { canceled: true };
  try {
    currentExport = runExport(project, res.filePath, (p) => win.webContents.send('export:progress', p));
    await currentExport.promise;
    return { ok: true, file: res.filePath };
  } catch (e) {
    if (currentExport?.canceled) return { canceled: true };
    return { ok: false, error: e.message };
  } finally {
    currentExport = null;
  }
});

ipcMain.handle('export:cancel', () => {
  if (!currentExport) return;
  currentExport.canceled = true;
  currentExport.cancel();
});
ipcMain.handle('shell:show', (_e, file) => shell.showItemInFolder(file));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
