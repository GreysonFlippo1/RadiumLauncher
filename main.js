/* eslint-disable multiline-ternary */

// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const { STEAM_KEY, STEAM_ID, STEAM_LIBRARY } = require('./env')
const fs = require('fs')
const vdfplus = require('vdfplus')

process.env.STEAM_KEY = STEAM_KEY
process.env.STEAM_ID = STEAM_ID

const isMac = process.platform === 'darwin'

const template = [
  ...(isMac ? [{
    label: app.name,
    submenu: [
      {
        label: 'Preferences'
      },
      // {
      //    type: 'separator'
      // },
      {
        role: 'quit',
        label: 'Quit Radium Launcher'
      }
    ]
  }] : []),
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },

  {
    role: 'window',
    submenu: [
      {
        role: 'togglefullscreen'
      },
      {
        role: 'minimize'
      },
      {
        role: 'close'
      }
    ]
  },

  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More'
      }
    ]
  }
]

let contents

// const runApp = (path, appName) => {
//   // shell.openPath(path.join('/Users/greysonflippo/Library/Application Support/Steam/steamapps/common/BloonsTD6', 'BloonsTD6.app'))
//   shell.openPath(path.join(path, appName))
// }

ipcMain.handle('save-user-data', async (event, fileName, json) => {
  const path = app.getPath('userData')
  try {
    fs.writeFileSync(`${path}/${fileName}`, json, 'utf-8')
  } catch (e) {
    return e
  }
  return 'success'
})

ipcMain.handle('runApp', async (event, arg) => {
  // + '/steamapps/common/'
  // do stuff
  // await awaitableProcess();
  fs.readFile(arg[0] + `/steamapps/appmanifest_${arg[1]}.acf`, 'utf8', function (err, data) {
    if (err) return err
    const json = vdfplus.parse(data)
    const installdir = json.AppState.installdir
    const fullPath = arg[0] + '/steamapps/common/' + installdir
    const appName = installdir + '.app'
    shell.openPath(path.join(fullPath, appName))
    return true
  })
})

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Radium Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  contents = mainWindow.webContents

  contents.on('did-finish-load', () => {
    fs.readFile(STEAM_LIBRARY, 'utf8', function (err, data) {
      if (err) {
        console.log(err)
      } else {
        const json = vdfplus.parse(data)
        contents.send('steamAppFolders', json)
      }
    })

    const path = app.getPath('userData')
    fs.readFile(`${path}/user-settings.json`, 'utf8', function (err, data) {
      if (err) {
        fs.writeFileSync(`${path}/user-settings.json`, '{}', 'utf-8')
        contents.send('userData', {})
      } else {
        const json = JSON.parse(data)
        contents.send('userData', json)
      }
    })

    fs.readFile(`${path}/cached-requests.json`, 'utf8', function (err, data) {
      if (err) {
        fs.writeFileSync(`${path}/cached-requests.json`, '{}', 'utf-8')
        contents.send('cachedRequests', {})
      } else {
        const json = JSON.parse(data)
        contents.send('cachedRequests', json)
      }
    })
  })

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
