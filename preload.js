/* eslint-disable padded-blocks */
/* eslint-disable no-trailing-spaces */
/* eslint-disable indent */
// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

// const fs = require('fs')
const { ipcRenderer } = require('electron')

const { STEAM_KEY, STEAM_ID } = process.env

const state = {
    libraryfolders: {},
    installedGames: [],
    games: [],
    sort: 'chronological',
    tab: 'game',
    selectedGame: {},
    selectedGameInfo: {},
    achievements: [],
    achievementsRatio: [0, 0] // complete, incomplete
}

ipcRenderer.on('steamAppFolders', function (event, data) {
    state.libraryfolders = data.libraryfolders
    getInstalledGames()
})

const getInstalledGames = (appid) => {
    const folders = Object.keys(state.libraryfolders)
    folders.forEach(folder => {
        state.installedGames = [...Object.keys(state.libraryfolders[folder].apps)]
    })
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

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const renderGamesList = (method, pick) => {
    const sort1 = document.getElementById('chronological')
    const sort2 = document.getElementById('alphabetic')
    const sort3 = document.getElementById('filter')
    
    let shownGames = [...state.games]

    // want to do this here to preserve the sort in case the filter changes that
    if (method === 'sort') {
        state.sort = pick
    }

    if (method === 'filter' && pick.length) {
        shownGames = shownGames.filter(game => {
                const searchIndex = game.name.toUpperCase().indexOf(pick.toUpperCase())
                game.searchIndex = searchIndex
                return searchIndex > -1
            })
        method = 'sort'
        pick = 'searchIndex'
    } else if (method === 'filter' && !pick.length) {
        method = 'sort'
        pick = state.sort
    }
    
    if (method === 'sort') {
        if (pick === 'alphabetic') {
            sort1.classList.remove('activeFilter')
            sort2.classList.add('activeFilter')
            sort3.classList.remove('activeFilter')
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
            sort3.classList.remove('activeFilter')
            shownGames = shownGames.sort((a, b) => {
                if (a.rtime_last_played < b.rtime_last_played) {
                    return 1
                }
                if (a.rtime_last_played > b.rtime_last_played) {
                    return -1
                }
                return 0
            })
        } else if (pick === 'searchIndex') {
            sort1.classList.remove('activeFilter')
            sort2.classList.remove('activeFilter')
            sort3.classList.add('activeFilter')
            shownGames = shownGames.sort((a, b) => {
                if (a.searchIndex < b.searchIndex) {
                    return -1
                }
                if (a.searchIndex > b.searchIndex) {
                    return 1
                }
                return 0
            })
        }
    }

    const listElement = document.getElementById('scrollableList')
    listElement.innerHTML = ''

    const currentDate = new Date()
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()

    const createDivider = (id, innerText) => {

        const labelId = 'listLabel' + id
        const dividerId = 'listDivider' + id

        listElement.appendChild(document.createElement('div')).id = labelId
    
        const labelElement = document.getElementById(labelId)
        labelElement.classList.add('listLabel')
        labelElement.innerHTML = innerText

        listElement.appendChild(document.createElement('div')).id = dividerId
        const dividerElement = document.getElementById(dividerId)
        dividerElement.classList.add('listDivider')
    }

    shownGames.forEach(game => {

      if (pick === 'chronological') {
        const gameDate = new Date(game.rtime_last_played * 1000)
        const gameMonth = gameDate.getMonth()
        const gameYear = gameDate.getFullYear()

        const labelId = 'listLabel' + gameMonth + gameYear
        if (!game.rtime_last_played) {
            createDivider(`${gameMonth}${gameYear}`, 'Never Played')
        } else if (gameYear !== currentYear && !document.getElementById(labelId)) {
            createDivider(`${gameMonth}${gameYear}`, months[gameMonth] + ' ' + gameYear)
        } else if (gameYear === currentYear && gameMonth !== currentMonth) {
            createDivider(`${gameMonth}${gameYear}`, months[gameMonth])
        } else if (gameYear === currentYear && gameMonth === currentMonth) {
            createDivider(`${gameMonth}${gameYear}`, 'Recent')
        }
      }
  
      listElement.appendChild(document.createElement('div')).id = 'gameLink' + game.appid
      const gameLink = document.getElementById('gameLink' + game.appid)
      gameLink.classList.add('gameLink')
      gameLink.addEventListener('click', () => { renderGameTab(game) })

      if (game.appid === state.selectedGame.appid) {
        gameLink.classList.add('selectedGame')
      }

      // eslint-disable-next-line eqeqeq
      if (!state.installedGames.find(g => g == game.appid)) {
        gameLink.classList.add('notPlayable')
      }
  
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
        const gameLink = document.getElementById('gameLink' + shownGames[0].appid)
        gameLink.classList.add('selectedGame')
    }

}

const setFilterButtons = () => {
    const sort1 = document.getElementById('chronological')
    const sort2 = document.getElementById('alphabetic')

    sort1.addEventListener('click', () => { renderGamesList('sort', 'chronological') })
    sort2.addEventListener('click', () => { renderGamesList('sort', 'alphabetic') })

    const textFilter = document.getElementById('textFilter')
    textFilter.addEventListener('input', (e) => { renderGamesList('filter', e.target.value) })
}

const renderGameTab = (game) => {

    state.selectedGame.appid && document.getElementById('gameLink' + state.selectedGame.appid)?.classList.remove('selectedGame')
    document.getElementById('gameLink' + game.appid).classList.add('selectedGame')

    state.selectedGame = game
    state.tab = 'game'

    if (!state.selectedGameInfo.appid || state.selectedGameInfo.appid !== state.selectedGame.appid) {
        const http = new XMLHttpRequest()
        http.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                state.selectedGameInfo = JSON.parse(this.response)
                state.selectedGameInfo = state.selectedGameInfo[game.appid].data
                state.selectedGameInfo.appid = game.appid
                renderGameTab(game)
                getAchievements(game.appid)
            }
        }
        http.open('GET', `http://store.steampowered.com/api/appdetails?appids=${game.appid}`, true)
        http.send()
    } else {
        const backgroundBlur = document.getElementById('backgroundImage')
        const gameBanner = document.getElementById('gameBanner')
        const gameTitle = document.getElementById('gameTitle')
    
        backgroundBlur.style.backgroundImage = `url("https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_hero.jpg")`
        gameBanner.style.backgroundImage = `url("https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_hero.jpg")`
        gameTitle.innerText = state.selectedGameInfo.name
        getAchievements(game.appid)
    }

}

// const renderAchievementsPane = (appid) => {
//     const http = new XMLHttpRequest()
//     http.onreadystatechange = function () {
//         if (this.readyState === 4 && this.status === 200) {
//             const achievements = JSON.parse(this.response)
//             state.achievements = achievements.playerstats.achievements
//             console.log(appid, state.achievements)
//             console.log(state.selectedGameInfo)
//             renderAchievementsIcons(appid)
//         }
//     }
//     http.open('GET', `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&appid=${appid}`, true)
//     http.send()
// }

const parseXml = (xml, arrayTags) => {
    let dom = null
    if (window.DOMParser) dom = (new DOMParser()).parseFromString(xml, 'text/xml')
    else if (window.ActiveXObject) {
        // eslint-disable-next-line no-undef
        dom = new ActiveXObject('Microsoft.XMLDOM')
        dom.async = false
        // eslint-disable-next-line no-throw-literal
        if (!dom.loadXML(xml)) throw dom.parseError.reason + ' ' + dom.parseError.srcText
    } else throw new Error('cannot parse xml string!')

    function parseNode (xmlNode, result) {
        if (xmlNode.nodeName === '#cdata-section' || xmlNode.nodeName === '#text') {
            const v = xmlNode.nodeValue
            if (v.trim()) result['#cdata-section'] = v
            return
        }

        const jsonNode = {}
            const existing = result[xmlNode.nodeName]
        if (existing) {
            if (!Array.isArray(existing)) result[xmlNode.nodeName] = [existing, jsonNode]
            else result[xmlNode.nodeName].push(jsonNode)
        } else {
            if (arrayTags && arrayTags.indexOf(xmlNode.nodeName) !== -1) result[xmlNode.nodeName] = [jsonNode]
            else result[xmlNode.nodeName] = jsonNode
        }

        if (xmlNode.attributes) for (const attribute of xmlNode.attributes) jsonNode[attribute.nodeName] = attribute.nodeValue

        for (const node of xmlNode.childNodes) parseNode(node, jsonNode)
    }

    const result = {}
    for (const node of dom.childNodes) parseNode(node, result)

    return result
}

const getAchievements = (appid) => {
    const http = new XMLHttpRequest()
    http.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            const achievements = parseXml(this.response)
            state.achievements = achievements.playerstats?.achievements.achievement ?? []
            renderAchievementsPane()
        }
    }
    // for rare achievement marker http.open('GET', `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appid}`, true)
    // for basic achievements data (no icons) http.open('GET', `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&appid=${appid}`, true)

    http.open('GET', `http://steamcommunity.com/profiles/${STEAM_ID}/stats/${appid}/achievements/?xml=1`, true)
    http.send()
}

const renderAchievementsPane = () => {
    let shownAchievements = state.achievements

    const unlockedAchievementsList = document.getElementById('unlockedAchievements')
    const lockedAchievementsList = document.getElementById('lockedAchievements')

    unlockedAchievementsList.innerHTML = ''
    lockedAchievementsList.innerHTML = ''

    state.achievementsRatio = [0, 0]

    if (!shownAchievements.length) {
        const [complete, incomplete] = state.achievementsRatio
        document.getElementById('achievementsTitle').innerText = `Achievements - ${complete} of ${complete + incomplete} Completed`
        document.getElementById('achievementsSubTitle').innerText = `${incomplete} Achievements Left`
        return false
    }

    shownAchievements = shownAchievements.sort((a, b) => {
        if (a.unlockTimestamp?.['#cdata-section'] < b.unlockTimestamp?.['#cdata-section']) {
            return 1
        }
        if (a.unlockTimestamp?.['#cdata-section'] > b.unlockTimestamp?.['#cdata-section']) {
            return -1
        }
        return 0
    })

    shownAchievements.forEach(achievement => {
        const achievementListElement = achievement.unlockTimestamp ? unlockedAchievementsList : lockedAchievementsList

        state.achievementsRatio[achievement.unlockTimestamp ? 0 : 1] += 1

        // eslint-disable-next-line eqeqeq
        const achievementIcon = (achievement.closed == 1 && !achievement.unlockTimestamp) ? achievement.iconOpen['#cdata-section'] : achievement.iconClosed['#cdata-section']

        achievementListElement.appendChild(document.createElement('div')).id = 'achivementIcon_' + achievement.apiname['#cdata-section']

        const achivementIconElement = document.getElementById('achivementIcon_' + achievement.apiname['#cdata-section'])
        achivementIconElement.style.backgroundImage = `url('${achievementIcon}')`
        achivementIconElement.classList.add('achievementLinkIcon')
    })

    const [complete, incomplete] = state.achievementsRatio
    document.getElementById('achievementsTitle').innerText = `Achievements - ${complete} of ${complete + incomplete} Completed`
    document.getElementById('achievementsSubTitle').innerText = `${incomplete} Achievements Left`

    const circle = document.getElementById('activementProgressRing')
    const radius = circle.r.baseVal.value
    const circumference = radius * 2 * Math.PI

    circle.style.strokeDasharray = `${circumference} ${circumference}`
    circle.style.strokeDashoffset = `${circumference}`

    const setProgress = (percent) => {
        const offset = circumference - percent * circumference
        circle.style.strokeDashoffset = offset
    }

    setProgress(complete / (complete + incomplete))

}

window.addEventListener('DOMContentLoaded', () => {

    getGames()
    setFilterButtons()

})
