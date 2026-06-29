const cloud = require('@cloudbase/node-sdk');

/**
 * 将 matchTime 值统一转为 ISO 8601 UTC 字符串
 */
function normalizeMatchTime(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    const str = String(value)
    // 14 位 yyyyMMddHHmmss 格式（如 20260611190000）
    if (str.length === 14) {
      const y = parseInt(str.slice(0, 4))
      const m = parseInt(str.slice(4, 6)) - 1
      const d = parseInt(str.slice(6, 8))
      const h = parseInt(str.slice(8, 10))
      const min = parseInt(str.slice(10, 12))
      const s = parseInt(str.slice(12, 14))
      return new Date(Date.UTC(y, m, d, h, min, s)).toISOString()
    }
    // 8 位 yyyyMMdd 格式
    if (str.length === 8) {
      const y = parseInt(str.slice(0, 4))
      const m = parseInt(str.slice(4, 6)) - 1
      const d = parseInt(str.slice(6, 8))
      return new Date(Date.UTC(y, m, d, 0, 0, 0)).toISOString()
    }
    // 10 位 Unix 秒时间戳
    if (str.length === 10) {
      return new Date(value * 1000).toISOString()
    }
    // 13 位 Unix 毫秒时间戳
    if (str.length === 13) {
      return new Date(value).toISOString()
    }
    // 兜底
    return new Date(value).toISOString()
  }
  return String(value)
}

exports.main = async (event, context) => {
  try {
    const app = cloud.init();
    const db = app.database();

    const { matchId } = event;
    if (!matchId) {
      return { success: false, error: '缺少 matchId' };
    }

    // 使用 where + limit(1) 替代 doc().get()，兼容 @cloudbase/node-sdk v2 返回格式
    const res = await db.collection('matches').where({ _id: matchId }).limit(1).get();
    const data = res.data || [];
    const m = Array.isArray(data) ? data[0] : data;
    if (!m) {
      return { success: false, error: '比赛不存在' };
    }

    // 由前端根据 matchTime + 设备时区计算本地时间展示
    const match = {
      _id: m._id || matchId,
      tournament: m.tournament || '世界杯',
      homeTeam: m.homeTeam || '',
      homeShort: m.homeShort || '',
      homeFlagUrl: m.homeFlagUrl || '',
      homeColor: m.homeColor || { from: '#155DFC', to: '#193CB8' },
      awayTeam: m.awayTeam || '',
      awayShort: m.awayShort || '',
      awayFlagUrl: m.awayFlagUrl || '',
      awayColor: m.awayColor || { from: '#155DFC', to: '#193CB8' },
      date: '',    // 由前端根据 matchTime + 设备时区计算
      time: '',    // 由前端根据 matchTime + 设备时区计算
      status: m.status || 'upcoming',
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      stadium: m.stadium || '',
      group: m.group || '',
      round: m.round || '',
      matchTime: normalizeMatchTime(m.matchTime)  // 标准化为 ISO 8601 字符串
    };

    return { success: true, data: match };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
