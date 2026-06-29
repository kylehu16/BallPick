const PAGE_SIZE = 10

Page({
  data: {
    currentTab: 0,
    currentCategory: 0,
    categories: ['全部', '世界杯'],
    isEmpty: false,
    loading: true,
    loadingMore: false,
    noMore: false,
    matchList: [],       // 已加载的全部数据
    filteredMatches: [], // 当前筛选后的展示数据
    tabCounts: [0, 0, 0],
    currentPage: 1,
    aiPredictionMap: {}  // matchId → aiPrediction
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight })
    this.fetchMatches(1, true)
  },

  // 获取比赛数据
  async fetchMatches(page, reset = false) {
    const { currentTab, currentCategory, categories } = this.data

    if (reset) {
      this.setData({ loading: true, currentPage: 1, matchList: [], noMore: false })
    }

    // 映射 tab → status 过滤
    const statusMap = ['upcoming', 'live', 'finished']
    const status = statusMap[currentTab] || ''

    // 赛事筛选：index 0 = '全部'，不传 tournament；其他传具体赛事名
    const tournament = currentCategory > 0 ? categories[currentCategory] : ''

    try {
      const res = await wx.cloud.callFunction({
        name: 'getMatchList',
        data: { page, pageSize: PAGE_SIZE, status, tournament }
      })

      const { data, counts, hasMore } = res.result
      const newMatches = data || []

      if (reset) {
        this.setData({
          matchList: newMatches,
          tabCounts: counts || [0, 0, 0],
          currentPage: 1,
          loading: false,
          noMore: !hasMore,
          isEmpty: newMatches.length === 0
        })
      } else {
        this.setData({
          matchList: [...this.data.matchList, ...newMatches],
          currentPage: page,
          loadingMore: false,
          noMore: !hasMore
        })
      }
      this.setData({ filteredMatches: this.data.matchList })
      // 获取 AI 预测数据
      this.fetchAIPredictions()
    } catch (err) {
      console.error('获取比赛数据失败:', err)
      wx.showToast({ title: '数据加载失败', icon: 'none' })
      this.setData({ loading: false, loadingMore: false, isEmpty: true })
    }
  },

  // 获取当前页面匹配的 AI 预测
  async fetchAIPredictions() {
    const { matchList } = this.data;
    const matchIds = matchList.map(m => m._id).filter(Boolean);
    if (matchIds.length === 0) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'getAIPrediction',
        data: { matchIds }
      });

      const { predictions } = res.result || {};
      if (predictions) {
        this.setData({ aiPredictionMap: predictions });
      }
    } catch (err) {
      console.error('获取AI预测失败:', err);
      // 不影响比赛列表展示，静默失败
    }
  },

  // 滚动到底部加载更多
  onScrollToLower() {
    const { loadingMore, noMore } = this.data
    if (loadingMore || noMore) return

    this.setData({ loadingMore: true })
    const nextPage = this.data.currentPage + 1
    this.fetchMatches(nextPage, false)
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ currentTab: index, currentCategory: 0 })
    this.fetchMatches(1, true)
  },

  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index
    if (index === this.data.currentCategory) return
    this.setData({ currentCategory: index })
    // 切换分类后重新从第1页获取数据
    this.fetchMatches(1, true)
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '这球怎么猜 - 预测世界杯比赛结果，赢取徽章',
      path: '/pages/index/index?from=friend',
      imageUrl: ''
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '这球怎么猜 - 预测世界杯比赛结果，赢取徽章',
      query: 'from=timeline'
    }
  }
})
