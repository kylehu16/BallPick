const { matchTimeNumToMs, matchTimeNumToLocal } = require('../../utils/time')

Page({
  data: {
    statusBarHeight: 0,
    match: null,
    homeScore: 0,
    awayScore: 0,
    submitting: false,
    isEditing: false,   // 是否是修改模式
    matchTime: 0,       // 比赛开始时间（ISO 8601 字符串）
    canEdit: true,      // 比赛是否可编辑（仅 upcoming 状态允许）
    from: '',           // 分享来源：friend / timeline
    currentGuessId: '', // 当前已提交的竞猜 ID（编辑模式时使用）
    sharerPrediction: '', // 分享者的预测文本
    sharerNickname: ''   // 分享者的昵称
  },

  onLoad(options) {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight })

    const matchId = options.matchId
    const matchTime = decodeURIComponent(options.matchTime || '')

    // 提取分享来源和分享者预测信息
    this.setData({
      matchTime,
      from: options.from || '',
      sharerPrediction: decodeURIComponent(options.sharerPrediction || ''),
      sharerNickname: decodeURIComponent(options.sharerNickname || '')
    })

    if (matchId) {
      this.loadMatch(matchId)
      this.loadExistingGuess(matchId)
    }
  },

  // 加载已有比分竞猜，恢复比分输入
  async loadExistingGuess(matchId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyGuesses'
      })
      const guesses = res.result.data || []
      const existing = guesses.find(g => g.matchId === matchId && g.guessType === '比分竞猜')
      if (existing && existing.prediction) {
        const scoreMatch = existing.prediction.match(/(\d+):(\d+)/)
        if (scoreMatch) {
          this.setData({
            homeScore: parseInt(scoreMatch[1]) || 0,
            awayScore: parseInt(scoreMatch[2]) || 0,
            isEditing: true,
            currentGuessId: existing._id
          })
        }
      }
    } catch (err) {
      // 忽略加载失败，视为新增
    }
  },

  async loadMatch(matchId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMatchDetail',
        data: { matchId }
      })
      if (res.result && res.result.success) {
        const match = res.result.data
        // 根据 UTC matchTime + 设备时区 计算本地日期时间展示
        if (match && match.matchTime) {
          const local = matchTimeNumToLocal(match.matchTime)
          match.date = local.date
          match.time = local.time
        }
        // 仅 upcoming 状态且未到开赛时间的比赛可以修改/删除竞猜
        const canEdit = match && match.status === 'upcoming' && match.matchTime && new Date(match.matchTime).getTime() > Date.now()
        this.setData({ match, canEdit })
      } else {
        throw new Error(res.result.error || '加载失败')
      }
    } catch (err) {
      console.error('加载比赛失败:', err)
      wx.showToast({ title: '比赛数据加载失败', icon: 'none' })
    }
  },

  onScoreChange(e) {
    const field = e.currentTarget.dataset.field
    const action = e.currentTarget.dataset.action
    let value = this.data[field]

    if (action === 'plus' && value < 20) {
      value += 1
    } else if (action === 'minus' && value > 0) {
      value -= 1
    }

    this.setData({ [field]: value })
  },

  onInputScore(e) {
    const field = e.currentTarget.dataset.field
    let value = parseInt(e.detail.value) || 0
    if (value > 20) value = 20
    if (value < 0) value = 0
    this.setData({ [field]: value })
  },

  async onSubmit() {
    const { homeScore, awayScore, match, matchTime } = this.data

    // 校验是否离比赛开始不足15分钟（matchTime 是 ISO 8601 字符串，转为 ms 再比较）
    const matchTimeMs = matchTimeNumToMs(matchTime);
    if (matchTimeMs) {
      const diffMs = matchTimeMs - Date.now();
      const diffMinutes = diffMs / 60000;

      if (diffMinutes <= 15 && diffMinutes > 0) {
        wx.showToast({ title: '比赛开始前15分钟内不能修改竞猜', icon: 'none' })
        return
      }

      if (diffMinutes <= 0) {
        wx.showToast({ title: '比赛已开始，不能修改竞猜', icon: 'none' })
        return
      }
    }

    this.setData({ submitting: true })

    try {
      const predictionScore = `${homeScore}:${awayScore}`
      const predictionText = `${match.homeTeam} ${homeScore}:${awayScore} ${match.awayTeam}`

      const result = await wx.cloud.callFunction({
        name: 'submitGuess',
        data: {
          matchId: match._id,
          guessType: 'score',
          prediction: '',
          predictionScore,
          predictionText,
          matchInfo: {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            tournament: match.tournament,
            date: match.date,
            time: match.time
          }
        }
      })

      if (result.result && result.result.success) {
        const wasEditing = this.data.isEditing
        this.setData({ submitting: false, isEditing: true })

        // 如果是通过分享链接进入且首次提交竞猜，写入来源信息
        const { from, match } = this.data
        if (from) {
          try {
            await wx.cloud.callFunction({
              name: 'updateUserProfile',
              data: {
                createOnly: true,
                shareFrom: from,
                shareMatchId: match._id,
                shareTime: new Date().toISOString()
              }
            })
          } catch (err) {
            // 写入来源失败不影响竞猜流程
            console.error('写入来源失败:', err)
          }
        }

        const tip = wasEditing ? '竞猜修改成功！' : '竞猜提交成功！'
        wx.showToast({ title: tip, icon: 'success' })
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/guess/guess',
            fail: () => {
              this.setData({ submitting: false })
            }
          })
        }, 1500)
      } else {
        throw new Error(result.result.error || '提交失败')
      }
    } catch (err) {
      console.error('提交竞猜失败:', err)
      // 显示具体错误信息（云函数返回的错误或异常信息）
      const errMsg = (err.message && err.message !== '提交失败' && err.message !== 'submitGuess:fail') 
        ? err.message 
        : (err.result && err.result.error) || '提交失败，请重试'
      wx.showToast({ title: errMsg, icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  onBack() {
    wx.navigateBack()
  },

  // 分享给好友
  onShareAppMessage() {
    const { match, matchTime, isEditing, homeScore, awayScore } = this.data
    if (!match) return { title: '快来一起猜球！', path: '/pages/index/index' }

    let path = `/pages/guessDetailScore/guessDetailScore?matchId=${match._id}&matchTime=${encodeURIComponent(matchTime)}&from=friend`

    // 如果已提交预测，附上分享者的预测信息
    if (isEditing) {
      const app = getApp()
      const nickName = (app.globalData.userInfo && app.globalData.userInfo.nickName) || '好友'
      const predictionText = `${match.homeTeam} ${homeScore}:${awayScore} ${match.awayTeam}`
      path += `&sharerPrediction=${encodeURIComponent(predictionText)}&sharerNickname=${encodeURIComponent(nickName)}`
    }

    return {
      title: `${match.homeTeam} vs ${match.awayTeam} | 快来一起猜`,
      path,
      imageUrl: ''
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { match, matchTime, isEditing, homeScore, awayScore } = this.data
    if (!match) return { title: '快来一起猜球！', query: '' }

    let query = `matchId=${match._id}&matchTime=${encodeURIComponent(matchTime)}&from=timeline`

    if (isEditing) {
      const app = getApp()
      const nickName = (app.globalData.userInfo && app.globalData.userInfo.nickName) || '好友'
      const predictionText = `${match.homeTeam} ${homeScore}:${awayScore} ${match.awayTeam}`
      query += `&sharerPrediction=${encodeURIComponent(predictionText)}&sharerNickname=${encodeURIComponent(nickName)}`
    }

    return {
      title: `${match.homeTeam} vs ${match.awayTeam} | 快来一起猜`,
      query
    }
  },

  // 删除竞猜
  onDeleteGuess() {
    const { currentGuessId, match } = this.data
    if (!currentGuessId || !match) return

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条竞猜记录吗？',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            const result = await wx.cloud.callFunction({
              name: 'deleteGuess',
              data: { guessId: currentGuessId, matchId: match._id }
            })
            wx.hideLoading()

            if (result.result && result.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              setTimeout(() => {
                wx.navigateBack()
              }, 1000)
            } else {
              wx.showToast({ title: (result.result && result.result.error) || '删除失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('删除竞猜失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
