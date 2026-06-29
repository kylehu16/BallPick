const cloud = require('@cloudbase/node-sdk');
const axios = require('axios');

const API_BASE = 'https://sportscore.com/api/widget/match/';
const AXIO_TIMEOUT = 10000;

function getISOTime() {
  return new Date().toISOString()
}

// 有效的状态值
const VALID_STATUS = ['upcoming', 'live', 'finished'];

/**
 * 检查比赛是否为2026年世界杯
 */
function is2026WorldCup(match) {
  // matchTime 是 ISO 8601 字符串，解析年份
  if (match.matchTime) {
    const year = new Date(match.matchTime).getUTCFullYear();
    return year === 2026;
  }
  
  // 检查 date 字段是否包含 2026
  if (match.date && match.date.includes('2026')) {
    return true;
  }
  
  return false;
}

/**
 * 检查 API 返回的比赛是否为 2026 年世界杯
 */
function isApiMatch2026WorldCup(apiMatch) {
  // 检查 competition 字段
  if (apiMatch.competition && !apiMatch.competition.includes('World Cup')) {
    return false;
  }
  
  // 检查 time 字段的年份
  if (apiMatch.time) {
    const matchDate = new Date(apiMatch.time);
    if (!isNaN(matchDate.getTime())) {
      const year = matchDate.getUTCFullYear();
      return year === 2026;
    }
  }
  
  return true; // 如果无法判断，默认认为是
}

/**
 * 调用 API 获取比赛数据
 * API 返回格式：{ sport: "football", match: {...}, updated: "..." }
 */
async function fetchMatchFromApi(slug) {
  try {
    const url = `${API_BASE}?sport=football&slug=${slug}`;
    const res = await axios.get(url, { timeout: AXIO_TIMEOUT });
    
    // API 直接返回数据，match 字段包含比赛信息
    if (res.data && res.data.match) {
      return res.data;
    }
    return null;
  } catch (err) {
    console.log(`API 请求失败 (${slug}):`, err.message);
    return null;
  }
}

exports.main = async (event, context) => {
  try {
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    const db = app.database();
    
    // 1. 查询需要更新比分的比赛（排除已完成 finished 的比赛）
    //    - upcoming 且已到/过了开赛时间：仍未更新状态的比赛
    //    - live：进行中的比赛，需要持续刷新实时比分
    const nowIso = getISOTime();
    const matchesRes = await db.collection('matches')
      .where(db.command.or([
        {
          status: 'upcoming',
          matchTime: db.command.lte(nowIso)
        },
        {
          status: 'live'
        }
      ]))
      .get();
    
    const matches = matchesRes.data || [];
    
    if (matches.length === 0) {
      return {
        success: true,
        message: '没有需要更新的比赛',
        updated: 0
      };
    }
    
    // 2. 过滤出 2026 年世界杯的比赛
    const worldCup2026Matches = matches.filter(m => is2026WorldCup(m));
    
    if (worldCup2026Matches.length === 0) {
      return {
        success: true,
        message: '没有需要更新的 2026 年世界杯比赛',
        updated: 0
      };
    }
    
    console.log(`找到 ${worldCup2026Matches.length} 场需要更新的 2026 年世界杯比赛`);
    
    // 3. 遍历比赛，调用 API 更新数据
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const match of worldCup2026Matches) {
      try {
        // 通过中文队名在 sport_score_teams 集合中查找 team_slug
        const homeDoc = await db.collection('sport_score_teams')
          .where({ team_zh: match.homeTeam, category: 'country' })
          .get();
        const awayDoc = await db.collection('sport_score_teams')
          .where({ team_zh: match.awayTeam, category: 'country' })
          .get();

        if (homeDoc.data.length === 0 || awayDoc.data.length === 0) {
          console.log(`比赛 ${match._id} 无法在 sport_score_teams 中找到队伍: ${match.homeTeam}(${homeDoc.data.length}) 或 ${match.awayTeam}(${awayDoc.data.length})`);
          skippedCount++;
          continue;
        }

        const homeSlug = homeDoc.data[0].team_slug;
        const awaySlug = awayDoc.data[0].team_slug;
        const slug = `${homeSlug}-vs-${awaySlug}`;
        console.log(`正在更新比赛: ${match.homeTeam}(${homeSlug}) vs ${match.awayTeam}(${awaySlug}), slug: ${slug}`);

        // 调用 API
        let apiData = await fetchMatchFromApi(slug);

        // 如果没找到，互换主客队位置再查
        if (!apiData || !apiData.match) {
          const swappedSlug = `${awaySlug}-vs-${homeSlug}`;
          console.log(`原始 slug 未找到: ${slug}, 尝试互换主客队: ${swappedSlug}`);
          apiData = await fetchMatchFromApi(swappedSlug);
        }

        if (!apiData || !apiData.match) {
          console.log(`API 返回数据为空（已尝试正向和互换）: ${slug}`);
          errorCount++;
          continue;
        }
        
        const apiMatch = apiData.match;
        
        // 检查是否为 2026 年世界杯
        if (!isApiMatch2026WorldCup(apiMatch)) {
          console.log(`比赛 ${slug} 不是 2026 年世界杯，跳过`);
          skippedCount++;
          continue;
        }
        
        // 4. 更新数据库
        const updateData = {
          updatedAt: getISOTime()
        };
        
        // 更新比分
        if (apiMatch.home_score !== undefined) {
          updateData.homeScore = apiMatch.home_score;
        }
        
        if (apiMatch.away_score !== undefined) {
          updateData.awayScore = apiMatch.away_score;
        }
        
        // 更新状态（直接使用 API 返回的 status：upcoming/live/finished）
        if (apiMatch.status && VALID_STATUS.includes(apiMatch.status)) {
          updateData.status = apiMatch.status;
        }
        
        // 保存到数据库
        await db.collection('matches').doc(match._id).update(updateData);
        
        console.log(`已更新比赛 ${match._id}: ${match.homeTeam} ${updateData.homeScore || 0} - ${updateData.awayScore || 0} ${match.awayTeam}, 状态: ${updateData.status}`);
        updatedCount++;
        
        // 避免 API 限流，延迟 1 秒
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (err) {
        console.error(`更新比赛 ${match._id} 失败:`, err.message);
        errorCount++;
      }
    }
    
    return {
      success: true,
      message: `更新完成：成功 ${updatedCount} 场，跳过 ${skippedCount} 场，失败 ${errorCount} 场`,
      updated: updatedCount,
      skipped: skippedCount,
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
