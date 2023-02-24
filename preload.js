/* eslint-disable padded-blocks */
/* eslint-disable no-trailing-spaces */
/* eslint-disable indent */
// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron')

{/*
<div class="listLabel">Recent</div>
<div class="listDivider"></div>
*/}


const { STEAM_KEY, STEAM_ID } = process.env

const state = {
    games: [],
    sort: 'chronological',
    tab: 'game',
    selectedGame: {},
    selectedGameInfo: {}
}

const getGames = () => {
  const http = new XMLHttpRequest()
  http.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
        const games = JSON.parse(this.response)
        state.games = games.response.games
        renderGamesList('sort', state.sort)
    }
  }
  http.open('GET', `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&format=json&include_appinfo=1&include_played_free_games=1`, true)
  http.send()
}

const renderGamesList = (method, pick) => {
    const sort1 = document.getElementById('chronological')
    const sort2 = document.getElementById('alphabetic')
    
    let shownGames = [...state.games]
    
    if (method === 'sort') {
        state.sort = pick

        if (pick === 'alphabetic') {
            sort1.classList.remove('activeFilter')
            sort2.classList.add('activeFilter')
            shownGames = shownGames.sort((a, b) => {
                if (a.name < b.name) {
                    return -1
                }
                if (a.name > b.name) {
                    return 1
                }
                return 0
            })
        } else if (pick === 'chronological') {
            sort1.classList.add('activeFilter')
            sort2.classList.remove('activeFilter')
            shownGames = shownGames.sort((a, b) => {
                if (a.rtime_last_played < b.rtime_last_played) {
                    return 1
                }
                if (a.rtime_last_played > b.rtime_last_played) {
                    return -1
                }
                return 0
            })
        }
    }

    const listElement = document.getElementById('scrollableList')
    listElement.innerHTML = ''

    shownGames.forEach(game => {
  
      listElement.appendChild(document.createElement('div')).id = 'gameLink' + game.appid
      const gameLink = document.getElementById('gameLink' + game.appid)
      gameLink.classList.add('gameLink')
  
      gameLink.appendChild(document.createElement('div')).id = 'gameLinkIcon' + game.appid
      const gameLinkIcon = document.getElementById('gameLinkIcon' + game.appid)
      gameLinkIcon.classList.add('gameLinkIcon')
      gameLinkIcon.style.backgroundImage = `url("https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg")`
  
      gameLink.appendChild(document.createElement('div')).id = 'gameLinkTitle' + game.appid
      const gameLinkTitle = document.getElementById('gameLinkTitle' + game.appid)
      gameLinkTitle.classList.add('gameLinkTitle')
      gameLinkTitle.innerText = game.name
    })

    if (!state.selectedGame.appid && shownGames.length) {
        renderGameTab(shownGames[0])
    }

}

const setFilterButtons = () => {
    const sort1 = document.getElementById('chronological')
    const sort2 = document.getElementById('alphabetic')

    sort1.addEventListener('click', () => { renderGamesList('sort', 'chronological') })
    sort2.addEventListener('click', () => { renderGamesList('sort', 'alphabetic') })
}

const renderGameTab = (game) => {
    state.selectedGame = game
    state.tab = 'game'

    if (!state.selectedGameInfo.appid || state.selectedGameInfo.appid !== state.selectedGame.appid) {
        const http = new XMLHttpRequest()
        http.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                state.selectedGameInfo = JSON.parse(this.response)
                state.selectedGameInfo = state.selectedGameInfo[game.appid].data
                state.selectedGameInfo.appid = game.appid
                console.log(state.selectedGameInfo)
            }
        }
        http.open('GET', `http://store.steampowered.com/api/appdetails?appids=${game.appid}`, true)
        http.send()
    }
}

window.addEventListener('DOMContentLoaded', () => {

    getGames()
    setFilterButtons()

})
