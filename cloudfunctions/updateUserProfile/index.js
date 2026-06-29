const cloud = require('wx-server-sdk')

function getISOTime() {
  return new Date().toISOString()
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { nickName, avatarUrl, teamIds, createOnly, shareFrom, shareMatchId, shareTime } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, msg: '未获取到用户身份' }
  }

  try {
    const existing = await db.collection('users').where({ _openid: openid }).get()
    const now = getISOTime()

    // createOnly 模式：仅新建，已存在则跳过
    if (createOnly && existing.data.length > 0) {
      return { code: 0, msg: '用户已存在，跳过' }
    }

    if (existing.data.length > 0) {
      const updateData = {}
      if (nickName !== undefined) updateData.nickName = nickName
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
      if (teamIds !== undefined) updateData.supportedTeams = teamIds
      updateData.updatedAt = now
      await db.collection('users').doc(existing.data[0]._id).update({ data: updateData })
    } else {
      await db.collection('users').add({
        data: {
          _openid: openid,
          nickName: nickName || '',
          avatarUrl: avatarUrl || '',
          supportedTeams: teamIds || [],
          shareFrom: shareFrom || '',
          shareMatchId: shareMatchId || '',
          shareTime: shareTime || '',
          totalGuesses: 0,
          correctGuesses: 0,
          accuracy: 0,
          points: 0,
          consecutiveWins: 0,
          unlockedBadges: [],
          createdAt: now,
          updatedAt: now
        }
      })
    }

    return { code: 0, msg: createOnly && existing.data.length === 0 ? '用户创建成功' : '更新成功' }
  } catch (err) {
    console.error('updateUserProfile error:', err)
    return { code: -1, msg: err.message }
  }
}
