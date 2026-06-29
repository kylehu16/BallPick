Page({
  data: {
    statusBarHeight: 0,
    avatarUrl: '',
    nickName: '',
    supportedTeams: '',
    myTeams: []          // 球队对象数组 [{flagUrl, nameZh, _id}]
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight })
    this.loadProfile()
  },

  onShow() {
    this.loadProfile()
  },

  // 通过云函数保存用户信息到云端
  async saveProfile(fields) {
    try {
      await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: fields
      })
    } catch (err) {
      console.error('云端保存用户信息失败:', err)
    }
  },

  // 统一从云函数加载用户数据（本地缓存仅快速占位）
  async loadProfile() {
    // 先用本地缓存快速显示
    const localInfo = wx.getStorageSync('userInfo') || {}
    if (localInfo.nickName || localInfo.avatarUrl) {
      this.setData({
        nickName: localInfo.nickName || '',
        avatarUrl: localInfo.avatarUrl || ''
      })
    }
    const myTeamsLocal = wx.getStorageSync('myTeams') || []
    if (myTeamsLocal.length > 0) {
      this.setData({ myTeams: myTeamsLocal })
    }

    // 通过云函数获取最新数据
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserProfile' })
      if (res.result.code !== 0 || !res.result.data) return

      const profile = res.result.data

      // 恢复头像昵称
      const info = {
        nickName: profile.nickName || localInfo.nickName || '',
        avatarUrl: profile.avatarUrl || localInfo.avatarUrl || ''
      }
      this.setData(info)
      wx.setStorageSync('userInfo', info)

      // 恢复主队
      if (profile.supportedTeams && profile.supportedTeams.length > 0) {
        const countriesRes = await wx.cloud.callFunction({ name: 'getCountries' })
        const allCountries = countriesRes.result.data || []
        const myTeams = allCountries.filter(c => profile.supportedTeams.includes(c._id))
        wx.setStorageSync('myTeams', myTeams)
        this.setData({ myTeams })
        return
      }
      if (profile.supportedTeams && profile.supportedTeams.length === 0) {
        this.setData({ myTeams: [] })
      }
    } catch (err) {
      console.error('从云端加载失败:', err)
    }
  },

  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    this.setData({ avatarUrl: tempPath })

    // 上传头像到云存储，获取永久 fileID
    const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempPath,
      success: res => {
        const permanentUrl = res.fileID
        const localInfo = wx.getStorageSync('userInfo') || {}
        const nickName = this.data.nickName || localInfo.nickName || ''
        this.setData({ avatarUrl: permanentUrl, nickName })
        const userInfo = { avatarUrl: permanentUrl, nickName }
        wx.setStorageSync('userInfo', userInfo)
        this.saveProfile({ avatarUrl: permanentUrl })
      },
      fail: err => {
        console.error('头像上传云存储失败:', err)
        const localInfo = wx.getStorageSync('userInfo') || {}
        const nickName = this.data.nickName || localInfo.nickName || ''
        const userInfo = { avatarUrl: tempPath, nickName }
        wx.setStorageSync('userInfo', userInfo)
      }
    })
  },

  // 选择昵称时即时保存（type="nickname" 从微信选择器选择后触发，非逐字输入）
  onNicknameInput(e) {
    const nickName = e.detail.value
    if (!nickName) return
    this.setData({ nickName })
    const userInfo = { avatarUrl: this.data.avatarUrl, nickName }
    wx.setStorageSync('userInfo', userInfo)
    this.saveProfile({ nickName })
  },

  // 表单提交：用户按"完成"后收集最终昵称（官方推荐方式，避免 blur 异步安全检测清空内容）
  onNicknameSubmit(e) {
    const nickName = e.detail.value.nickname
    if (!nickName) return
    this.setData({ nickName })
    const userInfo = { avatarUrl: this.data.avatarUrl, nickName }
    wx.setStorageSync('userInfo', userInfo)
    this.saveProfile({ nickName })
  },

  onMyTeamTap() {
    wx.navigateTo({ url: '/pages/teamSelect/teamSelect' })
  }
})
