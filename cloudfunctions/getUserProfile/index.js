const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, msg: '未获取到用户身份' }
  }

  try {
    const res = await db.collection('users').where({ _openid: openid }).get()
    const userData = res.data[0] || null
    return {
      code: 0,
      data: userData ? {
        nickName: userData.nickName || '',
        avatarUrl: userData.avatarUrl || '',
        supportedTeams: userData.supportedTeams || [],
        points: userData.points || 0,
        accuracy: userData.accuracy || 0,
        totalGuesses: userData.totalGuesses || 0,
        correctGuesses: userData.correctGuesses || 0,
        consecutiveWins: userData.consecutiveWins || 0,
        unlockedBadges: userData.unlockedBadges || []
      } : null
    }
  } catch (err) {
    console.error('getUserProfile error:', err)
    return { code: -1, msg: err.message }
  }
}
