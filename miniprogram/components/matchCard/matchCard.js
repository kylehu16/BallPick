const { matchTimeNumToLocal } = require('../../utils/time')

Component({
  properties: {
    match: {
      type: Object,
      value: {}
    },
    aiPrediction: {
      type: Object,
      value: null
    }
  },

  observers: {
    'match': function (match) {
      // 根据 UTC matchTime 计算本地时区的日期和时间展示
      if (match && match.matchTime) {
        console.log('[matchCard] matchTime 原始值:', match.matchTime, '类型:', typeof match.matchTime)
        const local = matchTimeNumToLocal(match.matchTime)
        console.log('[matchCard] 转换后:', local.date, local.time)
        this.setData({
          displayDate: local.date,
          displayTime: local.time
        })
      } else {
        console.log('[matchCard] matchTime 为空，match:', match ? match._id : 'null')
        this.setData({
          displayDate: '',
          displayTime: ''
        })
      }
    },

    'aiPrediction': function (prediction) {
      if (prediction && prediction.prediction) {
        const p = prediction.prediction;
        const winnerMap = { home: '主队胜', draw: '平局', away: '客队胜' };
        this.setData({
          aiWinnerText: winnerMap[p.winner] || p.winner || '',
          aiScore: (p.homeScore != null && p.awayScore != null) ? `${p.homeScore}:${p.awayScore}` : '',
          aiConfidence: p.confidence != null ? `${p.confidence}%` : '',
          aiReasoning: p.reasoning || ''
        });
      } else {
        this.setData({
          aiWinnerText: '',
          aiScore: '',
          aiConfidence: '',
          aiReasoning: ''
        });
      }
    }
  },

  data: {
    aiWinnerText: '',
    aiScore: '',
    aiConfidence: '',
    aiReasoning: '',
    displayDate: '',
    displayTime: ''
  },

  methods: {
    onGuessClick(e) {
      const type = e.currentTarget.dataset.type
      const match = this.properties.match

      if (type === 'win') {
        // 跳转到胜负竞猜页面
        wx.navigateTo({
          url: `/pages/guessDetail/guessDetail?matchId=${match._id}&matchTime=${encodeURIComponent(match.matchTime || '')}&tournament=${encodeURIComponent(match.tournament || '')}`
        })
      } else if (type === 'score') {
        // 跳转到比分竞猜页面
        wx.navigateTo({
          url: `/pages/guessDetailScore/guessDetailScore?matchId=${match._id}&matchTime=${encodeURIComponent(match.matchTime || '')}&tournament=${encodeURIComponent(match.tournament || '')}`
        })
      }
    }
  }
})
