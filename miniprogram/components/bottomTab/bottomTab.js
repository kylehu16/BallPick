Component({
  properties: {
    current: {
      type: String,
      value: 'index'
    }
  },

  methods: {
    onTabTap(e) {
      const page = e.currentTarget.dataset.page
      if (page === this.properties.current) return
      
      const pages = {
        'index': '/pages/index/index',
        'guess': '/pages/guess/guess',
        'badge': '/pages/badge/badge',
        'my': '/pages/my/my'
      }
      
      wx.reLaunch({
        url: pages[page]
      })
    }
  }
})
