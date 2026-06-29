const config = require('../../config')

Component({
  properties: {
    statusBarHeight: {
      type: Number,
      value: 0
    }
  },
  data: {
    headerBgUrl: ''
  },
  lifetimes: {
    attached() {
      const fileID = config.cloudFileIDs.headerBg
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: res => {
          if (res.fileList && res.fileList.length > 0) {
            this.setData({ headerBgUrl: res.fileList[0].tempFileURL })
          }
        },
        fail: err => {
          console.error('获取云存储图片失败:', err)
        }
      })
    }
  }
})
