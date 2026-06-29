App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })
  },
  globalData: {
    userInfo: null,
    matchList: []
  }
})
