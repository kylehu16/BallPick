const { matchTimeNumToLocal } = require('../../utils/time')

Page({
  data: {
    statusBarHeight: 0,
    loading: true,
    guessList: [],
    stats: { total: 0, correct: 0, accuracy: 0 }
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight })
    this.loadGuesses()
  },

  onShow() {
    // 每次切到此页面重新加载（提交竞猜后返回时刷新）
    if (!this.data.loading) {
      this.loadGuesses()
    }
  },

  async loadGuesses() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyGuesses' })
      const { data, stats } = res.result
      // 根据 UTC matchTime + 设备时区 计算本地日期展示
      const guessList = (data || []).map(item => {
        const local = matchTimeNumToLocal(item.matchTime)
        return {
          ...item,
          displayDate: local.fullDate,  // 本地时区的完整日期
          displayTime: local.time       // 本地时区的时间
        }
      })
      this.setData({
        guessList,
        stats: stats || { total: 0, correct: 0, accuracy: 0 },
        loading: false
      })
    } catch (err) {
      console.error('加载竞猜记录失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 点击卡片跳转到竞猜详情页（可在详情页修改/删除）
  onCardTap(e) {
    const { matchId, guessType, matchTime, tournament } = e.currentTarget.dataset
    if (!matchId) return

    const url = guessType === '比分竞猜'
      ? `/pages/guessDetailScore/guessDetailScore?matchId=${matchId}&matchTime=${encodeURIComponent(matchTime || '')}&tournament=${encodeURIComponent(tournament || '')}`
      : `/pages/guessDetail/guessDetail?matchId=${matchId}&matchTime=${encodeURIComponent(matchTime || '')}&tournament=${encodeURIComponent(tournament || '')}`

    wx.navigateTo({ url })
  }
})
