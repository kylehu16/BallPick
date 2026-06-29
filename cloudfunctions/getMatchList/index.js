const cloud = require('@cloudbase/node-sdk');

const PAGE_SIZE_DEFAULT = 10;

/**
 * 将 matchTime 值统一转为 ISO 8601 UTC 字符串
 * CloudBase 可能将时间存储为 Date 对象，需转为稳定字符串传给前端
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

    const page = Math.max(1, event.page || 1);
    const pageSize = Math.min(50, event.pageSize || PAGE_SIZE_DEFAULT);
    const statusFilter = event.status || ''; // 'upcoming' | 'live' | 'finished' | ''
    const tournamentFilter = event.tournament || ''; // 赛事筛选

    // 读取所有数据（按 matchTime 升序）
    const res = await db.collection('matches')
      .orderBy('matchTime', 'asc')
      .get();

    let all = res.data || [];

    // 保持原始 UTC 数据，前端根据设备时区显示
    all = all.map(m => {
      return {
        _id: m._id,
        tournament: m.tournament || '世界杯',
        homeTeam: m.homeTeam,
        homeShort: m.homeShort,
        homeFlagUrl: m.homeFlagUrl || '',
        homeColor: m.homeColor,
        awayTeam: m.awayTeam,
        awayShort: m.awayShort,
        awayFlagUrl: m.awayFlagUrl || '',
        awayColor: m.awayColor,
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
    });

    // 统计各状态总数
    const counts = [0, 0, 0];
    for (const m of all) {
      if (m.status === 'upcoming') counts[0]++;
      else if (m.status === 'live') counts[1]++;
      else if (m.status === 'finished') counts[2]++;
    }

    // 按状态筛选
    let filtered = all;
    if (statusFilter === 'upcoming') {
      filtered = all.filter(m => m.status === 'upcoming');
    } else if (statusFilter === 'live') {
      filtered = all.filter(m => m.status === 'live');
      filtered.reverse();  // 进行中的比赛：matchTime 倒序，最近开始的在最前
    } else if (statusFilter === 'finished') {
      filtered = all.filter(m => m.status === 'finished');
      filtered.reverse();  // 已完成的比赛：matchTime 倒序，最近结束的在最前
    }

    // 按赛事筛选
    if (tournamentFilter) {
      filtered = filtered.filter(m => m.tournament === tournamentFilter);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
      counts
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
