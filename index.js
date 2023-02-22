/* eslint-disable multiline-ternary */

// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')

const isMac = process.platform === 'darwin'

const template = [
  ...(isMac ? [{
    label: app.name,
    submenu: [
      // {
      //    label: 'Preferences'
      // },
      // {
      //    type: 'separator'
      // },
      {
        role: 'quit',
        label: 'Quit Open Music Visualizer'
      }
    ]
  }] : []),
  {
    label: 'View',
    submenu: [
      {
        role: 'reload'
      },
      {
        role: 'toggledevtools'
      }
    ]
  },

  {
    label: 'Options',
    submenu: [
      {
        label: 'Visualizer Type',
        submenu: [
          {
            label: 'Bouncy Bars',
            click: () => {
              changeVisualizer('bars')
            }
          },
          {
            label: 'Centered Bars',
            click: () => {
              changeVisualizer('centeredBars')
            }
          },
          {
            label: 'Wiggly Waveform',
            click: () => {
              changeVisualizer('wave')
            }
          },
          {
            label: 'Circular Waveform',
            click: () => {
              changeVisualizer('circle')
            }
          },
          {
            label: 'Concentric Circles',
            click: () => {
              changeVisualizer('concentricCircles')
            }
          },
          {
            label: 'Bubbles',
            click: () => {
              changeVisualizer('bubbles')
            }
          }
        ]
      },
      {
        label: 'Change Audio Source',
        click: () => {
          changeAudioSource()
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Boost Input Signal',
        type: 'checkbox',
        checked: false,
        click: () => {
          settings.boosted_audio = !settings.boosted_audio
          changeSettings()
        }
      },
      {
        label: 'Color Cycle',
        type: 'checkbox',
        checked: true,
        click: () => {
          settings.color_cycle = !settings.color_cycle
          changeSettings()
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Extra Tall Bars',
        type: 'checkbox',
        checked: true,
        click: () => {
          settings.tall_bars = !settings.tall_bars
          changeSettings()
        }
      },
      {
        label: 'Rounded Bars',
        type: 'checkbox',
        checked: false,
        click: () => {
          settings.rounded_bars = !settings.rounded_bars
          changeSettings()
        }
      }
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

const changeVisualizer = (type) => {
  contents.send('changeVisualizer', [type])
}

const changeAudioSource = () => {
  contents.send('changeAudioSource', [true])
}

const settings = {
  tall_bars: true,
  boosted_audio: false,
  rounded_bars: false,
  color_cycle: true
}

const changeSettings = () => {
  contents.send('changeSettings', Object.keys(settings).map(setting => settings[setting]))
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Open Music Visualizer',
    transparent: true,
    titleBarStyle: 'hiddenInset',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  contents = mainWindow.webContents

  contents.on('did-finish-load', () => {
    contents.setAudioMuted(true)
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
