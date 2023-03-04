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
    achievementsRatio: [0, 0], // complete, incomplete
    friends: []
}

ipcRenderer.on('steamAppFolders', function (event, data) {
    state.libraryfolders = data.libraryfolders
    getInstalledGames()
})

const getInstalledGames = (appid) => {
    const folders = Object.keys(state.libraryfolders)
    let foundDirectory = ''
    folders.forEach(folder => {
        const appids = Object.keys(state.libraryfolders[folder].apps)
        state.installedGames = [...appids]
        if (appid) {
            // eslint-disable-next-line eqeqeq
            if (appids.find(g => g == appid)) {
                foundDirectory = state.libraryfolders[folder].path
            }
        }
    })
    return foundDirectory
}

const makeRequest = (action, url, after) => {
    const http = new XMLHttpRequest()
    http.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            after(this.response)
        }
    }
    http.open(action, url, true)
    http.send()
}

const getGames = () => {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&format=json&include_appinfo=1&include_played_free_games=1`
    makeRequest('GET', url, (game) => {
        const games = JSON.parse(game)
        state.games = games.response.games
        renderGamesList('sort', state.sort)
    })
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
        const url = `http://store.steampowered.com/api/appdetails?appids=${game.appid}`
        makeRequest('GET', url, (selectedGameInfo) => {
            state.selectedGameInfo = JSON.parse(selectedGameInfo)
            state.selectedGameInfo = { ...state.selectedGame, ...state.selectedGameInfo[game.appid].data }
            renderGameTab(game)
            getAchievements(game.appid)
        })
    } else {
        const backgroundBlur = document.getElementById('backgroundImage')
        const gameBanner = document.getElementById('gameBanner')
        const gameTitle = document.getElementById('gameTitle')
        const playText = document.getElementById('playText')
        const playIcon = document.getElementById('playIcon')
        
        // eslint-disable-next-line eqeqeq
        if (!state.installedGames.find(g => g == game.appid)) {
            playText.innerText = 'INSTALL'
            playIcon.style.display = 'none'
        } else {
            playText.innerText = 'PLAY'
            playIcon.style.display = 'block'
            document.getElementById('playButton').addEventListener('click', () => { launchGame() })
        }
    
        backgroundBlur.style.backgroundImage = `url("https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_hero.jpg")`
        gameBanner.style.backgroundImage = `url("https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_hero.jpg")`
        gameTitle.innerText = state.selectedGameInfo.name
        getAchievements(game.appid)
        getFriends()
    }

}

const launchGame = (appid = state.selectedGame.appid, args = '') => {
    (async () => {
        // const foundDirectory = getInstalledGames(appid)
        // + '/steamapps/common/'
        // console.log(foundDirectory, state)
        // const result = await ipcRenderer.invoke('runApp', [foundDirectory, appid])
        // console.log(result)

        // basically the same as before - requires steamapp to be running to launch game
        window.location.href = `steam://run/${appid}/${args}`
        // steam://run/${appid}/${args}
    })()
}

const getFriends = () => {
    const url = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}`
    makeRequest('GET', url, (res) => {
        const response = JSON.parse(res)
        state.friends = response.friendslist.friends
        getFriendsInfo()
    })
}

const getFriendsInfo = () => {
    let friendsList = ''
    state.friends.forEach((friend, i) => {
        friendsList += friend.steamid
        if (i < state.friends.length - 1) {
            friendsList += '%2C'
        }
    })
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${friendsList}`
    makeRequest('GET', url, (res) => {
        const response = JSON.parse(res)
        // only loses friends_sice property
        state.friends = response.response.players
        RenderFriendsPane()
    })
}

const RenderFriendsPane = () => {
    const allFriends = document.getElementById('friendsWhoPlayList')
    const friendsPlayingNow = document.getElementById('friendsNowPlayingList')

    allFriends.innerHTML = ''
    friendsPlayingNow.innerHTML = ''

    document.getElementById('friendsSubTitle').innerText = `Friends Playing ${state.selectedGameInfo.name}`

    const onlineFriends = state.friends.filter(friend => friend.gameid)
    const offlineFriends = state.friends.filter(friend => !friend.gameid).sort((a, b) => {
        if (a.lastlogoff < b.lastlogoff) {
            return 1
        }
        if (a.lastlogoff > b.lastlogoff) {
            return -1
        }
        return 0
    })

    const sortedFriends = [...onlineFriends, ...offlineFriends]

    sortedFriends.forEach(friend => {

        // eslint-disable-next-line eqeqeq
        const friendsListElement = friend.gameid == state.selectedGame.appid ? friendsPlayingNow : allFriends
        const friendIcon = friend.avatar

        friendsListElement.appendChild(document.createElement('div')).id = 'friendLink' + friend.steamid

        const friendLinkElement = document.getElementById('friendLink' + friend.steamid)
        friendLinkElement.appendChild(document.createElement('div')).id = 'friendIcon_' + friend.steamid
        friendLinkElement.appendChild(document.createElement('div')).id = 'friendName_' + friend.steamid
        friendLinkElement.classList.add('firendsLink')

        const friendIconElement = document.getElementById('friendIcon_' + friend.steamid)
        friendIconElement.style.backgroundImage = `url('${friendIcon}')`
        friendIconElement.classList.add('friendLinkIcon')
        if (!friend.gameid) friendIconElement.classList.add('offline')

        const friendNameElement = document.getElementById('friendName_' + friend.steamid)
        friendNameElement.innerText = friend.personaname
        friendNameElement.classList.add('friendLinkName')
    })

    if (!allFriends.innerHTML) {
        allFriends.innerText = 'No Friends Online'
    }
    if (!friendsPlayingNow.innerHTML) {
        friendsPlayingNow.innerText = 'No Friends Playing This Game'
    }

}

const getAchievements = (appid) => {
    const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&appid=${appid}`
    makeRequest('GET', url, (achievementsResponse) => {
        const achievements = JSON.parse(achievementsResponse)
        state.achievements = achievements.playerstats?.achievements ?? []
        getAchievementsInfo()
    })
}

const getAchievementsInfo = () => {
    const url = `http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?key=${STEAM_KEY}&appid=${state.selectedGame.appid}&l=english&format=json`
    makeRequest('GET', url, (achievementsResponse) => {
        achievementsResponse = JSON.parse(achievementsResponse)
        const achievementsInfo = achievementsResponse.game.availableGameStats.achievements
        state.achievements.forEach((achievement, i) => {
            const achievementInfo = achievementsInfo.find(a => a.name === achievement.apiname) ?? {}
            state.achievements[i] = { ...achievement, ...achievementInfo }
        })
        renderAchievementsPane()
    })
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
        if (a.unlocktime < b.unlocktime) {
            return 1
        }
        if (a.unlocktime > b.unlocktime) {
            return -1
        }
        return 0
    })

    shownAchievements.forEach(achievement => {
        const achievementListElement = achievement.achieved ? unlockedAchievementsList : lockedAchievementsList

        state.achievementsRatio[achievement.achieved ? 0 : 1] += 1

        // eslint-disable-next-line eqeqeq
        const achievementIcon = achievement.icon

        achievementListElement.appendChild(document.createElement('div')).id = 'achivementLink_' + achievement.name

        const achivementLinkElement = document.getElementById('achivementLink_' + achievement.name)
        achivementLinkElement.appendChild(document.createElement('div')).id = 'achivementIcon_' + achievement.name
        achivementLinkElement.appendChild(document.createElement('div')).id = 'achivementName_' + achievement.name
        achivementLinkElement.classList.add('achievementLink')

        const achivementIconElement = document.getElementById('achivementIcon_' + achievement.name)
        achivementIconElement.style.backgroundImage = `url('${achievementIcon}')`
        achivementIconElement.classList.add('achievementLinkIcon')

        const achivementNameElement = document.getElementById('achivementName_' + achievement.name)
        achivementNameElement.innerText = achievement.displayName
        achivementNameElement.classList.add('achievementLinkName')
    })

    const [complete, incomplete] = state.achievementsRatio
    document.getElementById('achievementsTitle').innerText = `Achievements - ${complete} of ${complete + incomplete} Completed`
    document.getElementById('achievementsSubTitle').innerText = `${incomplete} Achievements Left`

    const circle = document.getElementById('achievementProgressRing')
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
