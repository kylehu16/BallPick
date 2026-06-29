const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const STATUS_TEXT_MAP = {
  pending: '待开赛',
  live: '进行中',
  finished: '待结算',
  correct: '✓ 预测正确',
  wrong: '✗ 预测错误'
};

exports.main = async (event, context) => {
  try {
    const db = cloud.database();
    const { OPENID: openId } = cloud.getWXContext();

    if (!openId) {
      return { success: false, error: '获取用户身份失败' };
    }

    // 读取当前用户的所有竞猜
    const guessRes = await db.collection('guesses')
      .where({ _openid: openId })
      .orderBy('createdAt', 'desc')
      .get();

    const guesses = guessRes.data || [];

    if (guesses.length === 0) {
      return {
        success: true,
        data: [],
        stats: { total: 0, correct: 0, accuracy: 0 }
      };
    }

    // 批量获取对应比赛的实际比分（仅用于展示 actual 字段，不参与状态判定）
    const matchIds = guesses.map(g => g.matchId);
    const matchRes = await db.collection('matches')
      .where({
        _id: db.command.in(matchIds)
      })
      .get();
    const matchMap = {};
    for (const m of matchRes.data || []) {
      matchMap[m._id] = m;
    }

    // 优先根据 match.status 判定状态，仅在 match finished 时参考 guess.status 结算结果
    let correctCount = 0;
    const data = guesses.map(g => {
      const match = matchMap[g.matchId];

      let status;
      if (match) {
        if (match.status === 'upcoming') {
          status = 'pending';
        } else if (match.status === 'live') {
          status = 'live';
        } else if (match.status === 'finished') {
          // 比赛已结束，查看竞猜是否已结算
          status = g.status || 'pending';
        } else {
          status = g.status || 'pending';
        }
      } else {
        status = g.status || 'pending';
      }

      const statusText = STATUS_TEXT_MAP[status] || '待开赛';

      if (status === 'correct') {
        correctCount++;
      }

      // 实际比分（仅展示用）
      let actual = '';
      if (match) {
        const hasScore = match.homeScore !== null && match.homeScore !== undefined
          && match.awayScore !== null && match.awayScore !== undefined;
        if (hasScore) {
          actual = `${match.homeScore}:${match.awayScore}`;
        }
      }

      // 比赛队名和国旗
      const home = (g.matchInfo && g.matchInfo.homeTeam) || (match && match.homeTeam) || '';
      const away = (g.matchInfo && g.matchInfo.awayTeam) || (match && match.awayTeam) || '';
      const homeFlagUrl = (g.matchInfo && g.matchInfo.homeFlagUrl) || (match && match.homeFlagUrl) || '';
      const awayFlagUrl = (g.matchInfo && g.matchInfo.awayFlagUrl) || (match && match.awayFlagUrl) || '';
      const matchName = home && away ? `${home} vs ${away}` : '';
      const tournament = (g.matchInfo && g.matchInfo.tournament) || (match && match.tournament) || '世界杯';
      const matchTime = match ? match.matchTime : '';
      let date = '';

      const guessTypeText = g.guessType === 'score' ? '比分竞猜' : '胜负竞猜';
      const predictionDisplay = g.predictionText || '';

      return {
        _id: g._id,
        matchId: g.matchId,
        tournament,
        guessType: guessTypeText,
        matchName,
        homeTeam: home,
        awayTeam: away,
        homeFlagUrl,
        awayFlagUrl,
        prediction: predictionDisplay,
        actual,
        date,
        matchTime,
        status,
        statusText
      };
    });

    const total = data.length;
    // 已结算的竞猜场次数（correct + wrong），准确率基于已结算场次计算
    const settledCount = data.filter(d => d.status === 'correct' || d.status === 'wrong').length;
    const accuracy = settledCount > 0 ? Math.round((correctCount / settledCount) * 100) : 0;

    return {
      success: true,
      data,
      stats: { total, correct: correctCount, accuracy }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
