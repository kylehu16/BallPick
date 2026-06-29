const cloud = require('wx-server-sdk')

function getISOTime() {
  return new Date().toISOString()
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { teamIds } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, msg: '未获取到用户身份' }
  }

  try {
    // 查找用户记录是否存在
    const existing = await db.collection('users').where({ _openid: openid }).get()

    const now = getISOTime()
    const data = {
      supportedTeams: teamIds || [],
      updatedAt: now
    }

    if (existing.data.length > 0) {
      // 更新已有记录
      await db.collection('users').doc(existing.data[0]._id).update({ data })
    } else {
      // 新建用户记录
      await db.collection('users').add({
        data: {
          ...data,
          _openid: openid,
          totalGuesses: 0,
          correctGuesses: 0,
          accuracy: 0,
          points: 0,
          consecutiveWins: 0,
          unlockedBadges: [],
          createdAt: now
        }
      })
    }

    return { code: 0, msg: '更新成功' }
  } catch (err) {
    console.error('updateUserTeams error:', err)
    return { code: -1, msg: err.message }
  }
}
