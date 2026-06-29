const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    const db = cloud.database();
    const { guessId, matchId } = event;

    if (!guessId || !matchId) {
      return { success: false, error: '缺少必要参数' };
    }

    const { OPENID: openId } = cloud.getWXContext();

    if (!openId) {
      return { success: false, error: '获取用户身份失败' };
    }

    // 查询竞猜记录，确认归属
    const guessRes = await db.collection('guesses').doc(guessId).get();
    const guess = guessRes.data;

    if (!guess || !guess._id) {
      return { success: false, error: '竞猜记录不存在' };
    }

    if (guess._openid !== openId) {
      return { success: false, error: '无权删除该竞猜' };
    }

    // 查询比赛信息，校验是否离开始不足15分钟
    const matchRes = await db.collection('matches').doc(matchId).get();
    const match = matchRes.data;

    if (match && match._id && match.matchTime) {
      // matchTime 是 ISO 8601 字符串（UTC时间），直接用 new Date() 解析
      const matchDate = new Date(match.matchTime);
      const diffMs = matchDate.getTime() - Date.now();
      const diffMinutes = diffMs / 60000;

      if (diffMinutes <= 15 && diffMinutes > 0) {
        return { success: false, error: '比赛开始前15分钟内不能删除竞猜' };
      }

      if (diffMinutes <= 0) {
        return { success: false, error: '比赛已开始，不能删除竞猜' };
      }
    }

    // 删除竞猜记录
    await db.collection('guesses').doc(guessId).remove();

    return {
      success: true,
      message: '竞猜已删除'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
