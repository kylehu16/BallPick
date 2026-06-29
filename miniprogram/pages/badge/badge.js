Page({
  data: {
    statusBarHeight: 0,
    badgeList: [],
    unlockedCount: 0,
    totalCount: 10,
    completionPercent: 0,
    loading: true
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight
    });
    this.loadBadgeStatus();
  },

  onShow() {
    // 每次显示时刷新徽章状态
    if (this.data.badgeList.length === 0) {
      this.loadBadgeStatus();
    }
  },

  async loadBadgeStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBadgeStatus'
      });

      if (res.result && res.result.success) {
        const { badgeList, unlockedCount, totalCount, completionPercent } = res.result.data;
        this.setData({
          badgeList,
          unlockedCount,
          totalCount,
          completionPercent,
          loading: false
        });
      } else {
        console.error('获取徽章状态失败:', res.result?.error);
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('调用 getBadgeStatus 失败:', err);
      this.setData({ loading: false });
    }
  }
});
