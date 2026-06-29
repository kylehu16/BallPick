const PAGE_SIZE = 20

Page({
  data: {
    statusBarHeight: 0,
    searchKey: '',
    allCountries: [],
    displayList: [],
    selectedIds: [],
    selectedMap: {},
    selectedCount: 0,
    page: 1,
    totalPages: 1,
    loading: false
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight })

    this.loadMyTeamsFromCloud()
    this.loadCountries()
  },

  async loadMyTeamsFromCloud() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserProfile' })
      if (res.result.code === 0 && res.result.data && res.result.data.supportedTeams) {
        const ids = res.result.data.supportedTeams
        this.setData({
          selectedIds: ids,
          selectedMap: ids.reduce((m, id) => { m[id] = true; return m }, {}),
          selectedCount: ids.length
        })
        return
      }
    } catch (err) {
      console.error('从云端加载主队失败:', err)
    }

    // fallback: 从本地缓存读取
    const myTeams = wx.getStorageSync('myTeams') || []
    const ids = myTeams.map(t => t._id)
    this.setData({
      selectedIds: ids,
      selectedMap: ids.reduce((m, id) => { m[id] = true; return m }, {}),
      selectedCount: ids.length
    })
  },

  async loadCountries() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCountries'
      })

      const countries = (res.result.data || []).sort((a, b) =>
        a.nameEn.localeCompare(b.nameEn, 'en')
      )

      this.setData({
        allCountries: countries,
        totalPages: Math.ceil(countries.length / PAGE_SIZE),
        loading: false
      })
      this.goPage(1)
    } catch (err) {
      console.error('加载国家数据失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 获取当前数据源（搜索过滤或全部）
  getSource() {
    const { searchKey, allCountries } = this.data
    if (!searchKey) return allCountries
    return allCountries.filter(c =>
      c.nameZh.toLowerCase().includes(searchKey) ||
      c.nameEn.toLowerCase().includes(searchKey)
    )
  },

  // 跳转到指定页
  goPage(p) {
    const source = this.getSource()
    const total = Math.ceil(source.length / PAGE_SIZE)
    const start = (p - 1) * PAGE_SIZE
    this.setData({
      displayList: source.slice(start, start + PAGE_SIZE),
      page: p,
      totalPages: Math.max(1, total)
    })
  },

  // 上一页
  onPrev() {
    if (this.data.page > 1) {
      this.goPage(this.data.page - 1)
    }
  },

  // 下一页
  onNext() {
    if (this.data.page < this.data.totalPages) {
      this.goPage(this.data.page + 1)
    }
  },

  // 搜索
  onSearchInput(e) {
    const key = e.detail.value.trim().toLowerCase()
    this.setData({ searchKey: key })
    this.goPage(1)
  },

  // 清除搜索
  onClear() {
    this.setData({ searchKey: '' })
    this.goPage(1)
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    let selected = [...this.data.selectedIds]
    const idx = selected.indexOf(id)

    if (idx > -1) {
      selected.splice(idx, 1)
    } else {
      selected.push(id)
    }

    const selectedMap = selected.reduce((m, id) => { m[id] = true; return m }, {})
    this.setData({
      selectedIds: selected,
      selectedMap: selectedMap,
      selectedCount: selected.length
    })
  },

  async onConfirm() {
    const selected = this.data.allCountries.filter(c =>
      this.data.selectedIds.includes(c._id)
    )

    // 保存到本地缓存
    wx.setStorageSync('myTeams', selected)

    // 保存到云数据库
    try {
      await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: { teamIds: this.data.selectedIds }
      })
    } catch (err) {
      console.error('云端保存主队失败:', err)
    }

    wx.showToast({ title: `已选择 ${selected.length} 支球队`, icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  },

  onBack() {
    wx.navigateBack()
  }
})
