const cloud = require('@cloudbase/node-sdk');

/**
 * 计算用户统计数据
 * @param {Object} db - 数据库实例
 * @param {string} openId - 用户 openId
 * @returns {Object} userStats
 */
async function calculateUserStats(db, openId) {
  const _ = db.command;

  // 查询该用户所有竞猜记录
  const allGuessesRes = await db.collection('guesses')
    .where({ _openid: openId })
    .orderBy('createdAt', 'desc')
    .get();

  const allGuesses = allGuessesRes.data || [];
  const totalGuesses = allGuesses.length;

  // 正确数
  const correctGuesses = allGuesses.filter(g => g.status === 'correct').length;

  // 准确率
  const accuracy = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0;

  // 连胜次数：从最近一条开始，连续正确的次数
  let consecutiveWins = 0;
  for (const g of allGuesses) {
    if (g.status === 'correct') {
      consecutiveWins++;
    } else {
      break;
    }
  }

  // 积分：从 users 集合获取
  let points = 0;
  try {
    const userRes = await db.collection('users').doc(openId).get();
    const userData = (userRes.data && userRes.data.length > 0) ? userRes.data[0] : null;
    if (userData) {
      points = userData.points || 0;
    }
  } catch (e) {
    // 用户可能还未创建
  }

  // 竞猜过的分组数：从正确竞猜对应的比赛中提取 group 去重
  const correctMatchIds = [...new Set(
    allGuesses.filter(g => g.status === 'correct').map(g => g.matchId)
  )];
  let guessedGroups = 0;
  if (correctMatchIds.length > 0) {
    const matchesRes = await db.collection('matches')
      .where({ _id: _.in(correctMatchIds) })
      .get();
    const groups = new Set();
    (matchesRes.data || []).forEach(m => {
      if (m.group) groups.add(m.group);
    });
    guessedGroups = groups.size;
  }

  // 今日正确次数
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyCorrect = allGuesses.filter(g =>
    g.status === 'correct' && new Date(g.createdAt) >= todayStart
  ).length;

  return {
    totalGuesses,
    correctGuesses,
    accuracy,
    consecutiveWins,
    points,
    guessedGroups,
    dailyCorrect
  };
}

/**
 * 判定徽章条件
 */
function checkBadgeCondition(userStats, badge) {
  const { conditionType, conditionValue } = badge;
  switch (conditionType) {
    case 'firstCorrectGuess':
      return userStats.correctGuesses > 0;
    case 'accuracy':
      return userStats.accuracy >= conditionValue;
    case 'consecutiveWins':
      return userStats.consecutiveWins >= conditionValue;
    case 'totalGuesses':
      return userStats.totalGuesses >= conditionValue;
    case 'points':
      return userStats.points >= conditionValue;
    case 'correctGuesses':
      return userStats.correctGuesses >= conditionValue;
    case 'guessAllGroups':
      return userStats.guessedGroups >= conditionValue;
    case 'dailyCorrect':
      return userStats.dailyCorrect >= conditionValue;
    default:
      return false;
  }
}

/**
 * 颁发徽章（幂等写入）
 */
async function awardBadge(db, openId, badgeId) {
  try {
    const existing = await db.collection('user_badges')
      .where({ _openid: openId, badgeId: badgeId })
      .count();
    if (existing.total > 0) return false;

    await db.collection('user_badges').add({
      _openid: openId,
      badgeId: badgeId,
      unlockedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error(`写入 user_badges 失败 (openId: ${openId}, badgeId: ${badgeId}):`, err.message);
    return false;
  }
}

/**
 * 云函数入口 - 每小时定时触发，全量评估所有用户徽章
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  console.log('========== evaluateBadges 开始执行 ==========');

  try {
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    const db = app.database();

    // 1. 获取所有徽章定义
    const badgesRes = await db.collection('badges').orderBy('sortOrder', 'asc').get();
    const badges = badgesRes.data || [];
    if (badges.length === 0) {
      console.log('徽章集合为空，跳过评估');
      return { success: true, message: '徽章集合为空', evaluatedUsers: 0, newlyAwarded: 0 };
    }
    console.log(`加载 ${badges.length} 个徽章定义`);

    // 2. 获取所有用户的 openId
    const allUserIds = new Set();
    let offset = 0;
    const limit = 200;
    while (true) {
      const guessesRes = await db.collection('guesses')
        .field({ _openid: true })
        .skip(offset)
        .limit(limit)
        .get();
      const data = guessesRes.data || [];
      if (data.length === 0) break;
      data.forEach(g => allUserIds.add(g._openid));
      offset += limit;
    }
    const userIds = [...allUserIds];
    console.log(`找到 ${userIds.length} 个用户`);

    if (userIds.length === 0) {
      console.log('没有用户数据，跳过评估');
      return { success: true, message: '没有用户数据', evaluatedUsers: 0, newlyAwarded: 0 };
    }

    // 3. 遍历每个用户评估徽章
    let totalNewlyAwarded = 0;
    const results = [];

    for (const openId of userIds) {
      try {
        console.log(`评估用户: ${openId}`);

        // 计算统计数据
        const userStats = await calculateUserStats(db, openId);
        console.log(`  统计: 总竞猜${userStats.totalGuesses}, 正确${userStats.correctGuesses}, 准确率${userStats.accuracy}%, 连胜${userStats.consecutiveWins}`);

        // 遍历徽章判定
        const newBadges = [];
        for (const badge of badges) {
          if (checkBadgeCondition(userStats, badge)) {
            const awarded = await awardBadge(db, openId, badge._id);
            if (awarded) {
              newBadges.push(badge._id);
              console.log(`  ✅ 获得徽章: ${badge.name} (${badge._id})`);
            }
          }
        }

        if (newBadges.length > 0) {
          totalNewlyAwarded += newBadges.length;
          results.push({ openId, newBadges });
        }
      } catch (err) {
        console.error(`评估用户 ${openId} 失败:`, err.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`========== evaluateBadges 完成: ${userIds.length} 用户, ${totalNewlyAwarded} 新徽章, 耗时 ${duration}s ==========`);

    return {
      success: true,
      message: `评估 ${userIds.length} 用户，新颁发 ${totalNewlyAwarded} 个徽章`,
      evaluatedUsers: userIds.length,
      newlyAwarded: totalNewlyAwarded,
      duration: `${duration}s`
    };

  } catch (error) {
    console.error('evaluateBadges 执行失败:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
