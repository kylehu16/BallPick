const cloud = require('wx-server-sdk');

function getISOTime() {
  return new Date().toISOString()
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 检查并创建用户记录
async function ensureUserRecord(openId, db) {
  try {
    const userRes = await db.collection('users').where({ _openid: openId }).get();

    if (!userRes.data || userRes.data.length === 0) {
      const now = getISOTime();
      await db.collection('users').add({
        data: {
          _openid: openId,
          nickName: '',
          avatarUrl: '',
          supportedTeams: [],
          totalGuesses: 0,
          correctGuesses: 0,
          accuracy: 0,
          points: 0,
          consecutiveWins: 0,
          unlockedBadges: [],
          createdAt: now,
          updatedAt: now
        }
      });
      console.log(`用户 ${openId} 记录已创建`);
    }
  } catch (err) {
    console.error('检查用户记录失败:', err);
  }
}

exports.main = async (event, context) => {
  try {
    const db = cloud.database();

    const { matchId, guessType, prediction, predictionScore, predictionText, matchInfo } = event;

    // guessType: 'win'(胜负) 或 'score'(比分)
    if (!matchId || !guessType) {
      return { success: false, error: '缺少必要参数' };
    }

    if (guessType === 'win' && !prediction) {
      return { success: false, error: '缺少预测结果' };
    }

    if (guessType === 'score' && !predictionScore) {
      return { success: false, error: '缺少比分预测' };
    }

    // 获取当前用户 openId（wx-server-sdk 标准 API）
    const { OPENID: openId } = cloud.getWXContext();

    if (!openId) {
      return { success: false, error: '获取用户身份失败' };
    }

    // 检查并创建用户记录
    await ensureUserRecord(openId, db);

    // 统一校验比赛时间（新增和修改都需要）
    const matchRes = await db.collection('matches').doc(matchId).get();
    const match = matchRes.data;
    if (!match || !match._id) {
      return { success: false, error: '比赛不存在' };
    }
    if (match.matchTime) {
      const matchDate = new Date(match.matchTime);
      const diffMs = matchDate.getTime() - Date.now();
      const diffMinutes = diffMs / 60000;

      if (diffMinutes <= 15 && diffMinutes > 0) {
        return { success: false, error: '比赛开始前15分钟内不能提交竞猜' };
      }
      if (diffMinutes <= 0) {
        return { success: false, error: '比赛已开始，不能提交竞猜' };
      }
    }

    // 同时校验比赛状态：只有 upcoming 状态的比赛可以竞猜
    if (match.status && match.status !== 'upcoming') {
      return { success: false, error: '比赛已开始或已结束，不能提交竞猜' };
    }

    // 按 matchId + guessType 查询，两种竞猜类型分开存储
    const existing = await db.collection('guesses')
      .where({
        matchId,
        guessType,
        _openid: openId
      })
      .get();

    const now = getISOTime();

    // 已存在 → 更新
    if (existing.data && existing.data.length > 0) {
      const guessId = existing.data[0]._id;
      const updateData = { updatedAt: now };

      if (guessType === 'win') {
        updateData.prediction = prediction;
        updateData.predictionText = predictionText;
      } else if (guessType === 'score') {
        updateData.predictionScore = predictionScore;
        updateData.predictionText = predictionText;
      }

      await db.collection('guesses').doc(guessId).update({
        data: updateData
      });

      return {
        success: true,
        message: '竞猜已更新',
        isUpdate: true
      };
    } else {
      // 新增（wx-server-sdk 需要用 data 包装）
      // 过滤 matchInfo，不存储 matchTime（避免数据冗余）
      const cleanMatchInfo = matchInfo ? { ...matchInfo } : {};
      delete cleanMatchInfo.matchTime;

      const newData = {
        _openid: openId,
        matchId,
        guessType,  // 区分竞猜类型
        prediction: guessType === 'win' ? prediction : '',
        predictionScore: guessType === 'score' ? predictionScore : '',
        predictionText,
        matchInfo: cleanMatchInfo,
        status: 'pending',
        points: 0,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('guesses').add({
        data: newData
      });

      return {
        success: true,
        message: '竞猜提交成功',
        guessId: result.id,
        isUpdate: false
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};


