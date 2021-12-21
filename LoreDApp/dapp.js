const {app, BrowserWindow} = require('electron')
const path = require('path')

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1020,
    height: 680,
    icon: __dirname + '/lore.ico',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL('http://localhost:8080')
}

app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

