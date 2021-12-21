

const {dapp, BrowserWindow} = require('electron');
const path = require('path');

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 600,
    webPreferences: {
      //preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.loadURL('http://localhost:8080');
  // and load the index.html of the app.
  // mainWindow.loadFile('index.html')
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

createWindow();

dapp.whenReady().then(() => {
  createWindow();

  dapp.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  })
})

dapp.on('window-all-closed', function () {
  if (process.platform !== 'darwin') dapp.quit();
})