/* eslint-disable padded-blocks */
/* eslint-disable no-trailing-spaces */
/* eslint-disable indent */
// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

// const fs = require('fs')
const { ipcRenderer } = require('electron')

const { STEAM_KEY, STEAM_ID, PLATFORM } = process.env

const STEAM_CLAN_IMAGE = 'https://cdn.akamai.steamstatic.com/steamcommunity/public/images/clans'

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
    friends: [],
    savedData: {},
    defaultSettings: {
        theme: 'system',
        favorites: [],
        sort: 'chronological',
        gamesSettings: {
            default: {
                args: '',
                run_without_steam: false,
                steamless_binary: '',
                start_in_big_picture: false
            }
        }
    },
    cachedRequests: {},
    domLoaded: false,
    cacheFilesFetched: false,
    settingsLoaded: false,
    init: false
}

ipcRenderer.on('userSettings', function (event, data) {
    state.savedData = { ...state.defaultSettings, ...data }
    state.settingsLoaded = true
    init()
})

ipcRenderer.on('cachedRequests', function (event, data) {
    state.cachedRequests = { ...state.cachedRequests, ...data }
    state.cacheFilesFetched = true
    init()
})

ipcRenderer.on('steamAppFolders', function (event, data) {
    state.libraryfolders = data.libraryfolders
    getInstalledGames()
})

ipcRenderer.on('getLocalAppData', function (event, data) {
    state.selectedGameInfo.localInfo = data
})

const saveUserData = () => {
    const jsonData = JSON.stringify(state.savedData)
    ipcRenderer.invoke('save-user-data', 'user-settings.json', jsonData).then(
        result => {
        }
    )
}

const saveCachedData = () => {
    const jsonData = JSON.stringify(state.cachedRequests)
    ipcRenderer.invoke('save-user-data', 'cached-requests.json', jsonData).then(
        result => {
        }
    )
}

const getInstalledGames = (appid) => {
    const folders = Object.keys(state.libraryfolders)
    let foundDirectory = ''
    state.installedGames = []
    folders.forEach(folder => {
        const appids = Object.keys(state.libraryfolders[folder].apps)
        state.installedGames = [...state.installedGames, ...appids]
        if (appid) {
            // eslint-disable-next-line eqeqeq
            if (appids.find(g => g == appid)) {
                foundDirectory = state.libraryfolders[folder].path
            }
        }
    })
    return foundDirectory
}

const makeRequest = (action, url, next, cache = false) => {
    const cacheExpire = 3600000 // 1 hour

    const date = new Date()
    const currentTime = date.getTime()
    if (cache && state.cachedRequests[url]?.expires > currentTime) {
        next(state.cachedRequests[url].response)
    } else {
        const http = new XMLHttpRequest()
        http.onreadystatechange = function () {
            if (this.readyState === 4 && (this.status === 200 || this.status === 400)) {
                if (cache) {
                    state.cachedRequests[url] = {
                        response: this.response,
                        expires: currentTime + cacheExpire
                    }
                    saveCachedData()
                }
                next(this.response)
            }
        }
        http.open(action, url, true)
        http.send()
    }
}

const getGames = () => {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&format=json&include_appinfo=1&include_played_free_games=1`
    makeRequest('GET', url, (game) => {
        const games = JSON.parse(game)
        state.games = games.response.games
        state.sort = state.savedData.sort
        renderGamesList('sort', state.sort)
    }, true)
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const timeDividers = [100000000, 20000, 10000, 5000, 1000, 500, 250, 100, 50, 20, 10, 5, 1, 0]

const renderGamesList = (method, pick) => {
    const sort1 = document.getElementById('chronological')
    const sort2 = document.getElementById('alphabetic')
    const sort3 = document.getElementById('favorite')
    
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
        } else if (pick === 'favorite') {
            // faves
            // playtime in last 2 weeks
            // playtime all time
            sort1.classList.remove('activeFilter')
            sort2.classList.remove('activeFilter')
            sort3.classList.add('activeFilter')
            // shownGames = []
            const favoritedGames = shownGames.filter(g => state.savedData.favorites.includes(g.appid)).sort((a, b) => {
                if ((a.playtime_2weeks ?? 0) < (b.playtime_2weeks ?? 0)) {
                    return 1
                }
                if ((a.playtime_2weeks ?? 0) > (b.playtime_2weeks ?? 0)) {
                    return -1
                }
                return 0
            })
            const unfavoritedGames = shownGames.filter(g => (!state.savedData.favorites.includes(g.appid) && g.playtime_forever)).sort((a, b) => {
                if (a.playtime_forever < b.playtime_forever) {
                    return 1
                }
                if (a.playtime_forever > b.playtime_forever) {
                    return -1
                }
                return 0
            })

            shownGames = [...favoritedGames, ...unfavoritedGames]

        } else if (pick === 'searchIndex') {
            sort1.classList.remove('activeFilter')
            sort2.classList.remove('activeFilter')
            sort3.classList.remove('activeFilter')
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

        if (pick !== 'searchIndex') {
            state.savedData.sort = pick
            saveUserData()
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

    let currentTimeDivider = 0

    shownGames.forEach((game, i) => {

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

      if (pick === 'favorite') {
        if (i === 0 && state.savedData.favorites.length) {
            createDivider('favoritesDivider', 'Favorites')
        }
        if (i >= state.savedData.favorites.length) {
            const gamePlaytime = Math.round(game.playtime_forever / 60)
            let j = 0
            while (gamePlaytime < timeDividers[j]) {
                j++
            }
            if (j !== currentTimeDivider) {
                currentTimeDivider = j
                if (timeDividers[j] === 0) {
                    createDivider(`favoritesDivider${j}`, 'Less than 1 Hour')
                } else {
                    createDivider(`favoritesDivider${j}`, `${timeDividers[j]}+ Hours`)
                }
            }
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
    const sort3 = document.getElementById('favorite')

    sort1.addEventListener('click', () => { renderGamesList('sort', 'chronological') })
    sort2.addEventListener('click', () => { renderGamesList('sort', 'alphabetic') })
    sort3.addEventListener('click', () => { renderGamesList('sort', 'favorite') })

    const textFilter = document.getElementById('textFilter')
    textFilter.addEventListener('input', (e) => { renderGamesList('filter', e.target.value) })
}

const renderGameTab = (game) => {

    state.selectedGame.appid && document.getElementById('gameLink' + state.selectedGame.appid)?.classList.remove('selectedGame')
    document.getElementById('gameLink' + game.appid).classList.add('selectedGame')

    state.selectedGame = game
    state.tab = 'game'

    if (!state.savedData.gamesSettings[state.selectedGame.appid]) {
        state.savedData.gamesSettings[state.selectedGame.appid] = { ...state.defaultSettings.gamesSettings.default }
    }

    if (!state.selectedGameInfo.appid || state.selectedGameInfo.appid !== state.selectedGame.appid) {
        const url = `http://store.steampowered.com/api/appdetails?appids=${game.appid}&language=English`
        makeRequest('GET', url, (selectedGameInfo) => {
            state.selectedGameInfo = JSON.parse(selectedGameInfo)
            state.selectedGameInfo = { ...state.selectedGame, ...state.selectedGameInfo[game.appid].data }
            renderGameTab(game)
            getAchievements(game.appid)
        }, true)
    } else {
        const backgroundBlur = document.getElementById('backgroundImage')
        const gameBanner = document.getElementById('gameBanner')
        const gameTitle = document.getElementById('gameTitle')
        const playButton = document.getElementById('playButton')
        const playText = document.getElementById('playText')
        const playIcon = document.getElementById('playIcon')
        
        // eslint-disable-next-line eqeqeq
        if (!state.installedGames.find(g => g == game.appid)) {
            playText.innerText = 'INSTALL'
            playIcon.style.display = 'none'
            if (!state.selectedGameInfo.platforms[PLATFORM]) {
                playButton.classList.add('playButtonDisabled')
            } else {
                playButton.classList.remove('playButtonDisabled')
            }
        } else {
            playText.innerText = 'PLAY'
            playIcon.style.display = 'block'
            playButton.classList.remove('playButtonDisabled')
            getLocalGameData()
        }

        const favoriteGameBttn = document.getElementById('favoriteGame')

        if (state.savedData.favorites.includes(game.appid)) {
            favoriteGameBttn.classList.remove('unfavorited')
        } else {
            favoriteGameBttn.classList.add('unfavorited')
        }
    
        backgroundBlur.style.backgroundImage = `url("https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_hero.jpg")`
        gameBanner.style.backgroundImage = `url("https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_hero.jpg")`
        gameTitle.innerText = state.selectedGameInfo.name
        getAchievements(game.appid)
        getFriends()
        renderQuickDetailsPane()
        renderDeveloperUpdatesPane()
    }

}

const getLocalGameData = () => {
    const foundDirectory = getInstalledGames(state.selectedGame.appid)
    ipcRenderer.invoke('getLocalAppData', [foundDirectory, state.selectedGame.appid])
}

const launchGame = (appid = state.selectedGame.appid) => {
    (async () => {
        // const foundDirectory = getInstalledGames(appid)
        // + '/steamapps/common/'
        // console.log(foundDirectory, state)
        // const result = await ipcRenderer.invoke('runApp', [foundDirectory, appid])
        // console.log(result)

        const gameSettings = state.savedData.gamesSettings[appid]

        if (gameSettings.run_without_steam && gameSettings.steamless_binary) {
            await ipcRenderer.invoke('runApp', gameSettings.steamless_binary)
        } else {
            if (gameSettings.args) {
                window.location.href = `steam://run/${appid}//${gameSettings.args}/`
            } else {
                window.location.href = `steam://rungameid/${appid}`
            }
        }

        // basically the same as before - requires steamapp to be running to launch game
        // window.location.href = `steam://run/${appid}//${gameSettings.args}`
        // steam://run/${appid}/${args}
    })()
}

const favoriteGame = (appid = state.selectedGame.appid) => {
    let favorites = [...state.savedData.favorites]
    if (favorites.includes(appid)) {
        favorites = favorites.filter(id => id !== appid)
        document.getElementById('favoriteGame').classList.add('unfavorited')
    } else {
        favorites[favorites.length] = appid
        document.getElementById('favoriteGame').classList.remove('unfavorited')
    }
    state.savedData.favorites = favorites
    if (state.sort === 'favorite') {
        renderGamesList('sort', 'favorite')
    }
    saveUserData()
}

const getFriends = () => {
    const url = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}`
    makeRequest('GET', url, (res) => {
        const response = JSON.parse(res)
        state.friends = response.friendslist.friends
        getFriendsInfo()
    }, true)
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
        const friendsInfo = response.response.players
        state.friends.forEach((friend, i) => {
            const friendInfo = friendsInfo.find(a => a.steamid === friend.steamid) ?? {}
            state.friends[i] = { ...friend, ...friendInfo }
        })
        RenderFriendsPane()
    }, false)
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
        // use classList.add('idle') for online but not playing a game
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
        if (achievements.playerstats.success) {
            getAchievementsInfo()
        } else {
            renderAchievementsPane()
        }
    }, true)
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
        getGlobalAchievmentStats()
    }, true)
}

const getGlobalAchievmentStats = () => {
    const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${state.selectedGame.appid}`
    makeRequest('GET', url, (achievementsResponse) => {
        achievementsResponse = JSON.parse(achievementsResponse)
        const achievementsInfo = achievementsResponse.achievementpercentages?.achievements ?? []
        state.achievements.forEach((achievement, i) => {
            const achievementInfo = achievementsInfo.find(a => a.name === achievement.apiname) ?? {}
            state.achievements[i] = { ...achievement, ...achievementInfo }
        })
        renderAchievementsPane()
    }, true)
}

const renderAchievementsPane = () => {
    let shownAchievements = state.achievements
    const unlockedAchievementsList = document.getElementById('unlockedAchievements')
    const lockedAchievementsList = document.getElementById('lockedAchievements')

    unlockedAchievementsList.innerHTML = ''
    lockedAchievementsList.innerHTML = ''

    state.achievementsRatio = [0, 0]

    const circle = document.getElementById('achievementProgressRing')
    const radius = circle.r.baseVal.value
    const circumference = radius * 2 * Math.PI

    circle.style.strokeDasharray = `${circumference} ${circumference}`
    circle.style.strokeDashoffset = `${circumference}`

    const setProgress = (percent) => {
        const offset = circumference - percent * circumference
        circle.style.strokeDashoffset = offset
    }

    if (!shownAchievements.length) {
        const [complete, incomplete] = state.achievementsRatio
        document.getElementById('achievementsTitle').innerText = `Achievements - ${complete} of ${complete + incomplete} Completed`
        document.getElementById('achievementsSubTitle').innerText = `${incomplete} Achievements Left`
        document.getElementById('achievementPercentage').textContent = '0%'
        document.getElementById('achievementPercentage').style.fill = 'rgb(201, 54, 209)'
        document.getElementById('playButton').classList.remove('goldenPlayButton')
        document.getElementById('playButton').classList.add('playButtonbg')
        
        setProgress(0)
        return false
    }

    shownAchievements = shownAchievements.sort((a, b) => {
        if (a.percent > b.percent) {
            return 1
        }
        if (a.percent < b.percent) {
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
        if (achievement.percent && achievement.achieved && achievement.percent < 10) {
            achivementLinkElement.classList.add('rare')
        }

        const achivementNameElement = document.getElementById('achivementName_' + achievement.name)
        achivementNameElement.innerText = achievement.displayName
        achivementNameElement.classList.add('achievementLinkName')
    })

    const [complete, incomplete] = state.achievementsRatio
    // let [complete, incomplete] = state.achievementsRatio // use if testing animations
    // if (state.selectedGame.appid === 960090) { [complete, incomplete] = [100, 0] } // use if testing animations
    document.getElementById('achievementsTitle').innerText = `Achievements - ${complete} of ${complete + incomplete} Completed`
    document.getElementById('achievementsSubTitle').innerText = `${incomplete} Achievements Left`

    const roundedPercent = Math.round((complete / (complete + incomplete) * 100))

    const red = Math.round((229 - 201) * roundedPercent / 100) + 201
    const green = Math.round((94 - 54) * roundedPercent / 100) + 54
    const blue = Math.round((45 - 209) * roundedPercent / 100) + 209

    document.getElementById('achievementPercentage').style.fill = `rgb(${red}, ${green}, ${blue})`
    document.getElementById('achievementPercentage').textContent = `${roundedPercent}%`
    if (roundedPercent === 100) {
        setProgress(complete / (complete + incomplete))
        circle.style.stroke = 'url(#gold)'
        circle.style.animation = 'goldGlowRing 5s linear 0s infinite forwards'
        document.getElementById('achievementPercentage').style.fill = 'rgb(255, 120, 0)'
        document.getElementById('playButton').classList.add('goldenPlayButton')
        document.getElementById('playButton').classList.remove('playButtonbg')
        setTimeout(() => {
            const [complete, incomplete] = state.achievementsRatio
            // let [complete, incomplete] = state.achievementsRatio // use if testing animations
            // if (state.selectedGame.appid === 960090) { [complete, incomplete] = [100, 0] } // use if testing animations
            const roundedPercentCheck = Math.round((complete / (complete + incomplete) * 100))
            if (roundedPercentCheck === 100) {
                circle.style.strokeDashoffset = 'none'
                circle.style.strokeDasharray = 'none'
            }
        }, 1000)
    } else {
        circle.style.stroke = 'url(#gradient)'
        circle.style.animation = 'none'
        document.getElementById('playButton').classList.remove('goldenPlayButton')
        document.getElementById('playButton').classList.add('playButtonbg')
        setProgress(complete / (complete + incomplete))
    }
}

const renderQuickDetailsPane = () => {
    const selectedGameInfo = state.selectedGameInfo
    document.getElementById('quickDetailsTitle').innerText = `About ${selectedGameInfo.name}`
    document.getElementById('gameDescription').innerHTML = selectedGameInfo.short_description ?? selectedGameInfo.about_the_game
    // https://store.akamai.steamstatic.com/public/images/v6/ico/ico_singlePlayer.png
    // + "_" +

    let developers = ''
    selectedGameInfo.developers.forEach((dev, i) => {
        developers += `${dev}`
        if (i !== selectedGameInfo.developers.length - 1) {
            developers += ', '
        }
    })
    document.getElementById('quickGameDetailDeveloper').innerHTML = `<span>Developer${selectedGameInfo.developers.length > 1 ? 's' : ''}</span> ${developers}`

    let publishers = ''
    selectedGameInfo.publishers.forEach((dev, i) => {
        publishers += `${dev}`
        if (i !== selectedGameInfo.publishers.length - 1) {
            publishers += ', '
        }
    })
    document.getElementById('quickGameDetailPublisher').innerHTML = `<span>Publisher${selectedGameInfo.publishers.length > 1 ? 's' : ''}</span> ${publishers}`

    document.getElementById('quickGameDetailReleaseDate').innerHTML = `<span>Release Date</span> ${selectedGameInfo.release_date.date}`

    document.getElementById('quickGameDetailSupportInfo').innerHTML = `<span>Support Info</span> ${selectedGameInfo.support_info.url || selectedGameInfo.support_info.email}`

    let categories = ''
    selectedGameInfo.categories.forEach((cat, i) => {
        categories += `${cat.description}`
        if (i !== selectedGameInfo.categories.length - 1) {
            categories += ', '
        }
    })
    document.getElementById('quickGameDetailCategories').innerHTML = `<span>Categories</span> ${categories}`

    let platforms = ''
    const validPlatforms = Object.keys(selectedGameInfo.platforms).filter(os => selectedGameInfo.platforms[os])
    validPlatforms.forEach((os, i) => {
        platforms += `${os}`
        if (i !== validPlatforms.length - 1) {
            platforms += ', '
        }
    })
    document.getElementById('quickGameDetailPlatforms').innerHTML = `<span>Platforms</span> ${platforms}`

    document.getElementById('quickGameDetailPrice').innerHTML = `<span>Current Price</span> ${selectedGameInfo?.price_overview?.final_formatted ?? 'N/A'}`
}

const renderDeveloperUpdatesPane = () => {
    const appid = state.selectedGame.appid
    const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=2&maxlength=1000&feeds=steam_community_announcements`
    makeRequest('GET', url, (res) => {
        const updatesResponse = JSON.parse(res)
        const newsItems = updatesResponse?.appnews?.newsitems ?? []
        
        document.getElementById('update1').style.backgroundColor = 'rgba(100,100,100,0.1)'
        document.getElementById('update2').style.display = 'flex'
        document.getElementById('noteDescription1').style.display = 'block'
        document.getElementById('noteImg1').style.display = 'block'

        if (!newsItems.length) {
            document.getElementById('update1').style.backgroundColor = 'rgba(100,100,100,0)'
            document.getElementById('update2').style.display = 'none'
            document.getElementById('noteTitle1').innerText = 'No Updates'
            document.getElementById('noteDescription1').style.display = 'none'
            document.getElementById('noteImg1').style.display = 'none'
            return
        }

        const image1 = getImageFromDescription(newsItems[0].contents)
        const image2 = getImageFromDescription(newsItems[1].contents)

        document.getElementById('noteImg1').style.backgroundImage = `url("${image1[0]}")`
        document.getElementById('noteImg2').style.backgroundImage = `url("${image2[0]}")`
        document.getElementById('noteDescription1').innerHTML = image1[1]
        document.getElementById('noteDescription2').innerHTML = image2[1]

        const post1Date = new Date(newsItems[0].date * 1000)
        const post1Month = post1Date.getMonth()
        const post1Year = post1Date.getFullYear()
        const post1Day = post1Date.getDate()
        document.getElementById('noteTitle1').innerHTML = `${newsItems[0].title} • <span>${months[post1Month]} ${post1Day}, ${post1Year}</span>`

        const post2Date = new Date(newsItems[1].date * 1000)
        const post2Month = post2Date.getMonth()
        const post2Year = post2Date.getFullYear()
        const post2Day = post2Date.getDate()
        document.getElementById('noteTitle2').innerHTML = `${newsItems[1].title} • <span>${months[post2Month]} ${post2Day}, ${post2Year}</span>`

    }, true)
}

const getImageFromDescription = (description) => {
    description = description.replaceAll('{STEAM_CLAN_IMAGE}', STEAM_CLAN_IMAGE)

    const imageEnds = [
            description.search('.png'),
            description.search('.jpg'),
            description.search('.gif')
        ]
        .filter(a => a !== -1)
        .sort((a, b) => {
            if (a > b) {
                return 1
            }
            if (a < b) {
                return -1
            }
            return 0
    })

    // still nothing
    if (!imageEnds.length) {
        return [state.selectedGameInfo.header_image, description]
    }

    const imageEnd = imageEnds[0]

    let start = imageEnd - 4
    let found = false

    while (start >= 0 && !found) {
        if (description.substring(start, start + 4) === 'http') {
            found = true
        } else {
            start--
        }
    }
    
    // bad link
    if (start === -1) {
        return [state.selectedGameInfo.header_image, description]
    }

    const finalURL = description.substring(start, imageEnd + 4)
    const finalDescription = description.replace(finalURL, '')

    return [finalURL, finalDescription]

}

const setStaticButtons = () => {
    const playBttn = document.getElementById('playButton')
    playBttn.addEventListener('click', () => { launchGame() })

    const favoriteGameBttn = document.getElementById('favoriteGame')
    favoriteGameBttn.addEventListener('click', () => { favoriteGame() })
}

const init = () => {
    if (state.domLoaded && state.cacheFilesFetched && state.settingsLoaded && !state.init) {
        state.init = true
        getGames()
        setFilterButtons()
        setStaticButtons()
    }
}

window.addEventListener('DOMContentLoaded', () => {

    state.domLoaded = true
    init()

})
