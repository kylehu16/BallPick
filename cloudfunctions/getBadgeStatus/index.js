const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * 获取当前用户的徽章状态
 * 前端 badge 页面调用，返回带解锁状态的徽章列表
 */
exports.main = async (event, context) => {
  try {
    const db = cloud.database();

    // 获取调用者 openId
    const { OPENID: openId } = cloud.getWXContext();
    if (!openId) {
      return { success: false, error: '无法获取用户身份' };
    }

    // 1. 查询所有徽章定义，按 sortOrder 排序
    const badgesRes = await db.collection('badges')
      .orderBy('sortOrder', 'asc')
      .get();
    const badges = badgesRes.data || [];

    // 2. 查询当前用户已解锁的徽章
    const userBadgesRes = await db.collection('user_badges')
      .where({ _openid: openId })
      .get();
    const unlockedBadgeIds = new Set(
      (userBadgesRes.data || []).map(ub => ub.badgeId)
    );

    // 3. 合并：为每个徽章添加 unlocked 字段
    const badgeList = badges.map(badge => ({
      _id: badge._id,
      emoji: badge.emoji,
      name: badge.name,
      desc: badge.desc,
      color: badge.color,
      sortOrder: badge.sortOrder,
      unlocked: unlockedBadgeIds.has(badge._id)
    }));

    const unlockedCount = unlockedBadgeIds.size;
    const totalCount = badgeList.length;
    const completionPercent = totalCount > 0
      ? Math.round((unlockedCount / totalCount) * 100)
      : 0;

    return {
      success: true,
      data: {
        badgeList,
        unlockedCount,
        totalCount,
        completionPercent
      }
    };

  } catch (error) {
    console.error('getBadgeStatus 执行失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
