const cloud = require('@cloudbase/node-sdk');

// 徽章定义数据
const badgesData = [
  {"_id":"badge001","emoji":"🎯","name":"预言家","desc":"首次竞猜成功","color":{"from":"#FF6B6B","to":"#FF8E53"},"conditionType":"firstCorrectGuess","conditionValue":1,"sortOrder":1,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge002","emoji":"💯","name":"百分先生","desc":"准确率到达 100%","color":{"from":"#4ECDC4","to":"#44A08D"},"conditionType":"accuracy","conditionValue":100,"sortOrder":2,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge003","emoji":"🔥","name":"连胜王者","desc":"连续正确 5 次","color":{"from":"#FFD700","to":"#FFA500"},"conditionType":"consecutiveWins","conditionValue":5,"sortOrder":3,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge004","emoji":"⚽","name":"足球新手","desc":"完成首次竞猜","color":{"from":"#A8E6CF","to":"#88D8B0"},"conditionType":"totalGuesses","conditionValue":1,"sortOrder":4,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge005","emoji":"🌟","name":"竞猜达人","desc":"完成 50 次竞猜","color":{"from":"#FFB347","to":"#FF6B6B"},"conditionType":"totalGuesses","conditionValue":50,"sortOrder":5,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge006","emoji":"🏅","name":"预测大师","desc":"准确率超过 80%","color":{"from":"#6A5ACD","to":"#8A2BE2"},"conditionType":"accuracy","conditionValue":80,"sortOrder":6,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge007","emoji":"💎","name":"钻石会员","desc":"参加竞猜 100 次","color":{"from":"#B9F2FF","to":"#00BFFF"},"conditionType":"totalGuesses","conditionValue":100,"sortOrder":7,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge008","emoji":"🎨️","name":"全能选手","desc":"竞猜过所有分组","color":{"from":"#FFC0CB","to":"#FF69B4"},"conditionType":"guessAllGroups","conditionValue":12,"sortOrder":8,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge009","emoji":"🚀","name":"火箭升空","desc":"单日正确 10 次","color":{"from":"#FF416C","to":"#FF4B2B"},"conditionType":"dailyCorrect","conditionValue":10,"sortOrder":9,"createdAt":"2026-01-01T00:00:00.000Z"},
  {"_id":"badge010","emoji":"👑","name":"竞猜之王","desc":"总正确次数超过 100","color":{"from":"#FFD700","to":"#FFA500"},"conditionType":"correctGuesses","conditionValue":100,"sortOrder":10,"createdAt":"2026-01-01T00:00:00.000Z"}
];

exports.main = async (event, context) => {
  try {
    const app = cloud.init({});
    const db = app.database();
    
    const actions = event.actions || ['badges', 'matches', 'guesses', 'users', 'user_badges'];
    const results = {};

    // 1. 初始化 badges 集合
    if (actions.includes('badges')) {
      const badgeCount = await db.collection('badges').count();
      if (badgeCount.total === 0) {
        const res = await db.collection('badges').add(badgesData);
        results.badges = { success: true, inserted: res.inserted };
      } else {
        results.badges = { success: true, message: 'Badges already initialized', count: badgeCount.total };
      }
    }

    // 2. 创建各集合的索引（通过插入空文档的方式触发集合创建）
    const collectionsToCreate = ['matches', 'guesses', 'users', 'user_badges'];
    for (const collName of collectionsToCreate) {
      if (actions.includes(collName)) {
        const countRes = await db.collection(collName).count();
        results[collName] = { exists: true, count: countRes.total };
      }
    }

    return {
      success: true,
      message: 'Database initialization completed',
      actions,
      results
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
