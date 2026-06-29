const cloud = require('@cloudbase/node-sdk');
const axios = require('axios');

const API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

function getISOTime() {
  return new Date().toISOString()
}

// 带重试的 axios GET
async function axiosGetWithRetry(url, retries = 3, timeout = 30000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { timeout });
      return res;
    } catch (err) {
      console.log(`请求失败(${i + 1}/${retries}):`, err.message);
      if (i === retries - 1) throw err;
      // 等待后重试
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

const TEAM_NAME_MAP = {
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Ivory Coast': "Cote d'Ivoire",
  'Curaçao': 'Curacao',
  'DR Congo': 'DR Congo',
  'USA': 'USA',
  'Korea Republic': 'South Korea',
  'Turkey': 'Turkiye',
};

exports.main = async (event, context) => {
  try {
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    const db = app.database();
    const isReset = event.reset === true;

    // 重置模式：分页删除所有旧数据
    if (isReset) {
      let deleted = 0;
      while (true) {
        const page = await db.collection('matches').limit(100).get();
        const docs = page.data || [];
        if (docs.length === 0) break;
        for (const d of docs) {
          await db.collection('matches').doc(d._id).remove();
          deleted++;
        }
        console.log(`已删除 ${deleted} 条`);
      }
      console.log(`清空完成，共删除 ${deleted} 条`);
    }

    // 1. 获取国家数据
    const countriesRes = await db.collection('countries').get();
    const countries = countriesRes.data || [];
    const countryMap = {};
    for (const c of countries) {
      countryMap[c.nameEn] = c;
    }

    // 2. 获取 API 数据（带重试）
    const response = await axiosGetWithRetry(API_URL);
    const data = response.data;
    const apiMatches = data.matches || [];

    console.log(`API 返回比赛总数: ${apiMatches.length}`);
    if (apiMatches.length > 0) {
      console.log('样例比赛:', JSON.stringify(apiMatches[0]));
      console.log('样例比赛2:', JSON.stringify(apiMatches[Math.min(80, apiMatches.length - 1)]));
    }

    if (apiMatches.length === 0) {
      return { success: true, message: 'API 未返回比赛数据' };
    }

    // 3. 筛选有效比赛
    const isPlaceholder = (name) => /^\d+[A-Z]$/.test(name) || /^[WL]\d+$/.test(name);
    const validMatches = apiMatches.filter(m => {
      const t1 = normalizeTeamName(m.team1);
      const t2 = normalizeTeamName(m.team2);
      return t1 && t2 && !isPlaceholder(t1) && !isPlaceholder(t2);
    });

    console.log(`有效比赛数: ${validMatches.length}, 过滤掉: ${apiMatches.length - validMatches.length}`);

    // 4. 构造文档，使用确定性 ID 实现去重
    const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
    console.log(`countries 数据条数: ${countries.length}`);

    for (const match of validMatches) {
      const team1 = normalizeTeamName(match.team1);
      const team2 = normalizeTeamName(match.team2);
      const normTeam1 = TEAM_NAME_MAP[team1] || team1;
      const normTeam2 = TEAM_NAME_MAP[team2] || team2;
      const homeData = countryMap[normTeam1];
      const awayData = countryMap[normTeam2];
      const group = match.group ? match.group.replace('Group ', '') : (match.num ? `M${match.num}` : '');
      const { timeFormatted, timeUTC } = parseMatchTime(match.date, match.time);

      // 确定性 ID：match_{赛事英文}_{日期}_{分组}_{主队}_{客队}
      const matchId = `match_fifa_world_cup_${match.date}_${group}_${team1}_${team2}`
        .replace(/[^a-zA-Z0-9_]/g, '_');

      // 先检查是否已存在：finish/live 状态的比赛跳过不更新
      let isExisting = false;

      try {
        const existingDoc = await db.collection('matches').doc(matchId).get();
        // 文档不存在时返回 { data: [] }，存在时 { data: [{...}] }，data 始终是数组
        const dataArr = existingDoc.data;
        const doc = (dataArr && dataArr.length > 0) ? dataArr[0] : null;
        if (doc) {

          // 直接根据 status 字段判断，跳过已完成或进行中的比赛
          if (doc.status === 'finished' || doc.status === 'live') {
            stats.skipped++;
            continue;
          }

          // upcoming 比赛，比赛时间和场地没变也跳过
          const stadium = match.ground || '';
          if (doc.matchTime === timeUTC && doc.stadium === stadium) {
            stats.skipped++;
            continue;
          }

          isExisting = true;
        }
      } catch (err) {
        // 文档不存在，将新增
      }

      try {
        if (isExisting) {
          // 已有文档：只更新信息字段，绝不覆盖 status/homeScore/awayScore
          const updateData = {
            tournament: '世界杯',
            homeTeam: homeData ? homeData.nameZh : team1,
            homeTeamEn: homeData ? homeData.nameEn : team1,
            homeShort: homeData ? homeData.nameShort : team1,
            homeFlagUrl: homeData ? homeData.flagUrl : '',
            homeColor: homeData ? { from: homeData.colorFrom || '#5B86E5', to: homeData.colorTo || '#36D1DC' } : { from: '#5B86E5', to: '#36D1DC' },
            awayTeam: awayData ? awayData.nameZh : team2,
            awayTeamEn: awayData ? awayData.nameEn : team2,
            awayShort: awayData ? awayData.nameShort : team2,
            awayFlagUrl: awayData ? awayData.flagUrl : '',
            awayColor: awayData ? { from: awayData.colorFrom || '#5B86E5', to: awayData.colorTo || '#36D1DC' } : { from: '#5B86E5', to: '#36D1DC' },
            date: formatDisplayDate(match.date),
            time: timeFormatted,
            stadium: match.ground || '',
            group,
            round: match.round,
            matchTime: timeUTC,
            updatedAt: getISOTime()
          };
          await db.collection('matches').doc(matchId).update(updateData);
          stats.updated++;
        } else {
          // 新文档：全量写入，包括 status/homeScore/awayScore
          const docData = {
            tournament: '世界杯',
            homeTeam: homeData ? homeData.nameZh : team1,
            homeTeamEn: homeData ? homeData.nameEn : team1,
            homeShort: homeData ? homeData.nameShort : team1,
            homeFlagUrl: homeData ? homeData.flagUrl : '',
            homeColor: homeData ? { from: homeData.colorFrom || '#5B86E5', to: homeData.colorTo || '#36D1DC' } : { from: '#5B86E5', to: '#36D1DC' },
            awayTeam: awayData ? awayData.nameZh : team2,
            awayTeamEn: awayData ? awayData.nameEn : team2,
            awayShort: awayData ? awayData.nameShort : team2,
            awayFlagUrl: awayData ? awayData.flagUrl : '',
            awayColor: awayData ? { from: awayData.colorFrom || '#5B86E5', to: awayData.colorTo || '#36D1DC' } : { from: '#5B86E5', to: '#36D1DC' },
            date: formatDisplayDate(match.date),
            time: timeFormatted,
            status: 'upcoming',
            homeScore: null,
            awayScore: null,
            stadium: match.ground || '',
            group,
            round: match.round,
            matchTime: timeUTC,
            updatedAt: getISOTime()
          };
          await db.collection('matches').doc(matchId).set(docData);
          stats.inserted++;
        }
      } catch (err) {
        console.log(`处理比赛失败 ${team1} vs ${team2}: ${err.message}`);
        stats.errors++;
      }
    }

    // 5. 验证数据库实际条数
    const verifyRes = await db.collection('matches').count();
    const totalInDB = verifyRes.total || 0;
    console.log(`处理完成: 新增 ${stats.inserted}, 更新 ${stats.updated}, 跳过 ${stats.skipped}, 错误 ${stats.errors}`);
    console.log(`数据库 matches 集合实际文档数: ${totalInDB}`);

    return {
      success: true,
      message: `处理完成，共 ${validMatches.length} 场比赛，数据库现有 ${totalInDB} 条`,
      stats,
      dbCount: totalInDB
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};

function normalizeTeamName(name) {
  return name ? name.trim() : '';
}

function parseMatchTime(dateStr, timeStr) {
  if (!dateStr) return { timeFormatted: '', timeUTC: '' };
  let timePart = timeStr || '00:00';
  let utcOffset = 0;
  const utcMatch = timeStr ? timeStr.match(/UTC([+-]\d+)/) : null;
  if (utcMatch) {
    timePart = timeStr.split('UTC')[0].trim();
    utcOffset = parseInt(utcMatch[1], 10);
  }
  try {
    const localTimeStr = `${dateStr}T${timePart}:00`;
    const localDate = new Date(localTimeStr);
    if (isNaN(localDate.getTime())) return { timeFormatted: timePart, timeUTC: '' };
    // UTC 时间 = 本地时间 - UTC偏移
    const utcMs = localDate.getTime() - utcOffset * 3600000;
    const utcDate = new Date(utcMs);
    return { timeFormatted: timePart, timeUTC: utcDate.toISOString() };
  } catch {
    return { timeFormatted: timePart, timeUTC: '' };
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}年${month}月${day}日`;
}
