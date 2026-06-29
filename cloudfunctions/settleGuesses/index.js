const cloud = require('@cloudbase/node-sdk');

function getISOTime() {
  return new Date().toISOString()
}

/**
 * 判断竞猜是否正确
 * @param {Object} guess - 竞猜记录
 * @param {Object} match - 比赛记录
 * @returns {boolean} - 是否正确
 */
function isGuessCorrect(guess, match) {
  if (guess.guessType === 'score') {
    // 比分竞猜：准确预测比分
    return guess.predictionScore === `${match.homeScore}:${match.awayScore}`;
  } else {
    // 胜负竞猜：预测胜负平
    const homeWin = match.homeScore > match.awayScore;
    const draw = match.homeScore === match.awayScore;
    
    let actualResult = '';
    if (homeWin) actualResult = 'home';
    else if (draw) actualResult = 'draw';
    else actualResult = 'away';
    
    return guess.prediction === actualResult;
  }
}

/**
 * 更新用户统计数据
 * @param {Object} db - 数据库实例
 * @param {string} openId - 用户OpenID
 * @param {boolean} isCorrect - 是否猜对
 */
async function updateUserStats(db, openId, isCorrect) {
  try {
    const userRes = await db.collection('users').doc(openId).get();
    const userData = (userRes.data && userRes.data.length > 0) ? userRes.data[0] : null;

    if (userData) {
      // 更新现有记录
      const updateField = isCorrect ? 'correctCount' : 'wrongCount';
      await db.collection('users').doc(openId).update({
        [updateField]: db.command.inc(1),
        updatedAt: getISOTime()
      });
    } else {
      // 创建新记录
      await db.collection('users').doc(openId).set({
        _id: openId,
        correctCount: isCorrect ? 1 : 0,
        wrongCount: isCorrect ? 0 : 1,
        createdAt: getISOTime(),
        updatedAt: getISOTime()
      });
    }
  } catch (err) {
    console.error(`更新用户统计失败 (openId: ${openId}):`, err.message);
    throw err;
  }
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  try {
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    const db = app.database();
    const _ = db.command;
    
    console.log('开始执行竞猜结算...');
    
    // 1. 查询已结束的比赛
    const matchesRes = await db.collection('matches')
      .where({
        status: 'finished'
      })
      .get();
    
    const matches = matchesRes.data || [];
    
    if (matches.length === 0) {
      console.log('没有已结束的比赛');
      return {
        success: true,
        message: '没有已结束的比赛',
        settled: 0
      };
    }
    
    console.log(`找到 ${matches.length} 场已结束的比赛`);
    
    // 构建比赛ID列表和比赛数据映射
    const matchIds = matches.map(m => m._id);
    const matchMap = {};
    matches.forEach(m => {
      matchMap[m._id] = m;
    });
    
    // 2. 查询这些比赛的待结算竞猜记录
    const guessesRes = await db.collection('guesses')
      .where({
        matchId: _.in(matchIds),
        status: 'pending'
      })
      .get();
    
    const guesses = guessesRes.data || [];
    
    if (guesses.length === 0) {
      console.log('没有待结算的竞猜记录');
      return {
        success: true,
        message: '没有待结算的竞猜记录',
        settled: 0
      };
    }
    
    console.log(`找到 ${guesses.length} 条待结算的竞猜记录`);
    
    // 3. 遍历竞猜记录并结算
    let correctCount = 0;
    let wrongCount = 0;
    let errorCount = 0;
    
    for (const guess of guesses) {
      try {
        const match = matchMap[guess.matchId];
        
        if (!match) {
          console.log(`竞猜 ${guess._id} 对应的比赛不存在`);
          errorCount++;
          continue;
        }
        
        // 判断竞猜是否正确
        const isCorrect = isGuessCorrect(guess, match);
        
        // 更新竞猜记录状态
        await db.collection('guesses').doc(guess._id).update({
          status: isCorrect ? 'correct' : 'wrong',
          updatedAt: getISOTime()
        });
        
        // 更新用户统计
        await updateUserStats(db, guess._openid, isCorrect);
        
        if (isCorrect) {
          correctCount++;
          console.log(`竞猜 ${guess._id} 结算成功：正确`);
        } else {
          wrongCount++;
          console.log(`竞猜 ${guess._id} 结算成功：错误`);
        }
        
      } catch (err) {
        console.error(`结算竞猜 ${guess._id} 失败:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`结算完成：正确 ${correctCount}，错误 ${wrongCount}，失败 ${errorCount}`);
    
    return {
      success: true,
      message: `结算完成：正确 ${correctCount}，错误 ${wrongCount}，失败 ${errorCount}`,
      settled: correctCount + wrongCount,
      correct: correctCount,
      wrong: wrongCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
