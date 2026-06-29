const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = app.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { matchIds } = event;

  if (!matchIds || !Array.isArray(matchIds) || matchIds.length === 0) {
    return { success: true, predictions: {} };
  }

  try {
    const predictions = {};

    // 对每个 matchId 查询最新的预测记录
    const queries = matchIds.map(async (matchId) => {
      try {
        const res = await db.collection('ai_predictions')
          .where({ matchId })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (res.data && res.data.length > 0) {
          const p = res.data[0];
          predictions[matchId] = {
            _id: p._id,
            matchId: p.matchId,
            prediction: p.prediction || null,
            createdAt: p.createdAt,
            status: p.status
          };
        } else {
          predictions[matchId] = null; // 无预测记录
        }
      } catch (err) {
        console.error(`查询比赛 ${matchId} 预测失败:`, err.message);
        predictions[matchId] = null;
      }
    });

    await Promise.all(queries);

    return {
      success: true,
      predictions
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
