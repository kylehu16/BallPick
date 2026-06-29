const cloud = require('@cloudbase/node-sdk');

function getISOTime() {
  return new Date().toISOString()
}

function toISOTime(date) {
  return date.toISOString()
}

const app = cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV,
  timeout: 60000  // AI生成可能耗时较长，建议设置较长超时时间
});
const db = app.database();
const ai = app.ai();
const _ = db.command;

// 云函数入口
exports.main = async (event, context) => {
  // 参数处理：支持 matchId 参数
  const { matchId } = event;
  
  let matches = [];
  
  if (matchId) {
    // 如果指定了 matchId，则只查询该比赛
    console.log(`指定比赛ID: ${matchId}，只预测该比赛`);
    const matchRes = await db.collection('matches').doc(matchId).get();
    if (matchRes.data && matchRes.data.length > 0) {
      matches = matchRes.data;
    } else {
      return { success: false, error: `未找到比赛: ${matchId}` };
    }
  } else {
    // 如果没有指定 matchId，则查询所有未开赛的比赛
    console.log('未指定比赛ID，预测所有未开赛的比赛');
    const twentyMinutesLater = new Date(Date.now() + 20 * 60 * 1000);
    const twentyMinutesLaterIso = toISOTime(twentyMinutesLater);
    
    const matchesRes = await db.collection('matches')
      .where({
        status: 'upcoming',
        matchTime: _.gt(twentyMinutesLaterIso)
      })
      .get();
    
    matches = matchesRes.data || [];
  }
  
  console.log(`找到 ${matches.length} 场比赛需要预测`);
  
  // 遍历比赛，进行预测（每3场并发，最大化 60s 内处理量）
  const results = {
    total: matches.length,
    success: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  const BATCH_SIZE = 3;
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(match => processOneMatch(match, db, ai, _, !!matchId)));
    for (const r of batchResults) {
      results[r.status]++
      results.details.push(r)
    }
  }
  
  return {
    success: true,
    results
  };
};

// 单场比赛预测处理（供并发调用）
async function processOneMatch(match, db, ai, _, forcePredict) {
  try {
    // 去重：批量模式（无 matchId）下，只预测从未预测过或最近一次超过 6 小时的比赛
    // 指定 matchId 时（forcePredict=true），不做去重直接预测
    if (!forcePredict) {
      const sixHoursAgoMs = Date.now() - 6 * 60 * 60 * 1000;
      const threshold = toISOTime(new Date(sixHoursAgoMs));
      const recentRes = await db.collection('ai_predictions')
        .where({ matchId: match._id, createdAt: _.gte(threshold) })
        .limit(1)
        .get();
      
      if (recentRes.data && recentRes.data.length > 0) {
        console.log(`比赛 ${match._id} 最近6小时内已有预测记录，跳过`);
        return { matchId: match._id, status: 'skipped', reason: '6小时内已有预测' };
      }
    }
    
    // 调用 AI 模型进行预测
    const { response, tokenUsage, prompt } = await callAIModel(match, ai);
    
    // 解析 AI 响应
    const parsed = parseAIResponse(response);
    if (!parsed) {
      console.error(`比赛 ${match._id} AI 响应解析失败`);
      return { matchId: match._id, status: 'failed', reason: 'AI 响应解析失败' };
    }
    
    // 存储预测结果
    await db.collection('ai_predictions').add({
      matchId: match._id,
      matchInfo: {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeTeamEn: match.homeTeamEn,
        awayTeamEn: match.awayTeamEn,
        matchTime: match.matchTime,
        tournament: match.tournament
      },
      prediction: {
        winner: parsed.winner,
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        oddsAnalysis: parsed.oddsAnalysis || '',
        kellyAnalysis: parsed.kellyAnalysis || '',
        altitudeImpact: parsed.altitudeImpact || '',
        weatherImpact: parsed.weatherImpact || '',
        lineupNotes: parsed.lineupNotes || ''
      },
      tokenUsage: {
        inputTokens: tokenUsage?.inputTokens || 0,
        outputTokens: tokenUsage?.outputTokens || 0
      },
      prompt: {
        system: prompt?.system || '',
        user: prompt?.user || ''
      },
      rawResponse: response,
      status: 'completed',
      createdAt: getISOTime()
    });
    
    console.log(`比赛 ${match._id} 预测成功`);
    return { matchId: match._id, status: 'success' };
    
  } catch (err) {
    console.error(`比赛 ${match._id} 预测失败:`, err);
    return { matchId: match._id, status: 'failed', error: err.message };
  }
}

// 调用 AI 模型
async function callAIModel(match, ai) {
  const model = ai.createModel("hunyuan-v3");  // 使用"hunyuan-v3"模型组
  
  const stadium = match.stadium || '未知';
  
  const systemPrompt = `你是专业的足球比赛预测专家。请严格按照以下三个维度进行分析，最终给出预测。

【核心原则：基本面为主，赔率与凯利指数为辅】
- 基本面分析（维度一）是预测的绝对核心，占决策权重的 70%
- 竞彩赔率分析（维度二）和凯利指数分析（维度三）各占 15%，仅用于辅助验证和微调
- 当赔率/凯利指数方向与基本面结论冲突时，以基本面为准，并在 reasoning 中说明冲突原因

═══════════════════════════════════════
维度一：基本面分析（主维度，决策权重 70%）
═══════════════════════════════════════
搜索并分析以下信息：

1. 双方首发阵容及替补球员（优先搜索）
   - 优先搜索两队当天比赛的实际首发11人及替补名单
   - 若当天首发尚未公布，则根据两队最近10场比赛的出场记录推断预计首发及替补，标注推断依据
   - 阵型安排（4-3-3、4-4-2、3-5-2、4-2-3-1 等）

2. 踢球风格
   - 主队战术风格（控球传控、快速反击、高位逼抢、防守反击、长传冲吊等）
   - 客队战术风格
   - 风格相克关系（如高位逼抢克制后场传控，密集防守克制阵地进攻）

3. 伤病与禁赛
   - 核心球员伤病情况及缺阵影响评估
   - 禁赛球员信息
   - 阵容完整度对比（核心缺阵影响远大于普通轮换）

4. 比赛环境因素
   - 比赛场馆所在地当天的天气预报（温度、降雨、风速、湿度）
   - 天气对比赛节奏和体能的具体影响（高温消耗体能、雨战利好防守方、大风影响长传精度、寒冷影响技术发挥）
   - 海拔高度影响（高海拔对低海拔地区球队的体能影响显著，需对比两队主场所在地的海拔差异）

5. 主客场判定
   - 俱乐部联赛/杯赛：主队天然拥有主场优势（熟悉场地、球迷支持、减少旅途疲劳）
   - 国家队锦标赛（世界杯、欧洲杯、亚洲杯、美洲杯等）：仅东道主球队享有主场优势；场馆所在国与某队所属国一致则该队有主场优势
   - 国家队预选赛：主队在其本国主场有优势
   - 国家队友谊赛/中立场地：两队均无主场优势
   - 将主场优势量化到后续预测中

6. 赛事规则分析
   - 搜索该赛事的具体规则：
     · 世界杯/欧洲杯/亚洲杯等国家队杯赛：淘汰赛均为单回合决胜，90分钟打平进入加时赛（30分钟），加时仍平则点球大战
     · 俱乐部杯赛（欧冠、亚冠、解放者杯等）：淘汰赛多为双回合制（主客场各一场），需关注客场进球规则
     · 联赛：单循环/双循环，积分制无淘汰赛
   - 分析当前轮次对两队战术心态的影响：
     · 小组赛末轮：需算分出线形势，部分球队必须取胜或争取净胜球
     · 淘汰赛单回合：两队都会全力以赴，爆冷概率高，平局后拼加时/点球
     · 淘汰赛双回合首回合：客队可能保守求平，主队力争优势
     · 淘汰赛双回合次回合：落后方必然猛攻，领先方可能偏守
   - 换人名额规则（3人/5人），影响阵容深度利用和体能分配
   - 红黄牌停赛规则（累计黄牌是否带入下一阶段），影响球员战意和拼抢强度
   - 排名规则（积分→净胜球→进球数→相互战绩），判断球队是否需要刷净胜球

═══════════════════════════════════════
维度二：竞彩赔率分析（辅维度，决策权重 15%）
═══════════════════════════════════════
搜索并分析以下信息：

1. 赔率数据
   - 列出初盘赔率（主胜/平/客胜）和即时赔率
   - 让球盘口及水位（如有）
   - 常见比分赔率

2. 概率计算
   - 计算隐含概率（1/赔率）并归一化（扣除博彩公司利润率），得到市场预估概率
   - 比较初盘与即时赔率的变化幅度，分析资金流向和市场态度变化

3. 风险评估
   - 凯利指数：低于 0.95 的选项更安全
   - 离散度：离散度小的结果被机构一致看好
   - 识别诱盘、热度陷阱等非理性因素

4. 偏差判断
   - 结合基本面，判断市场概率与真实概率是否存在显著偏差
   - 若市场概率显著低于基本面判断，标记为「有价值选项」

═══════════════════════════════════════
维度三：凯利指数深度分析（辅维度，决策权重 15%）
═══════════════════════════════════════
凯利指数 = 赔率 × 机构隐含概率 - 1，核心用途是衡量赔率是否被高估，发现"价值投注"机会。

1. 多机构凯利指数采集
   - 搜索竞彩官方、澳彩、Bet365、威廉希尔、立博等至少 3-5 家主流机构的凯利指数
   - 分别列出主胜/平局/客胜三个方向的凯利指数值
   - 标注各机构计算凯利指数所用的返还率基准

2. 凯利指数横向对比
   - 对比各家机构在同一结果上的凯利指数差异，差异越大表明机构分歧越大
   - 若某家机构的凯利指数明显高于其他机构（偏离 > 0.05），分析该机构是否掌握特殊信息
   - 主胜/平局/客胜三个方向的凯利指数排序，锁定凯利指数最高的方向

3. 凯利指数值域判定
   - 凯利指数 > 1.0：赔率定高，机构认为该结果实际概率高于赔率隐含概率，存在价值投注
   - 凯利指数 = 1.0：赔率与概率完全匹配，公平定价
   - 凯利指数 < 1.0：赔率定低，机构防范该结果发生，该方向大概率打出
   - 凯利指数 < 0.90：机构极度防范，该结果为市场共识的"安全选项"
   - 若三个方向的凯利指数均 < 0.90：机构整体防范冷门，比赛不确定性极高，需大幅降低预测置信度

4. 凯利指数变化趋势
   - 对比初盘凯利指数与即时凯利指数的变化方向和幅度
   - 凯利指数持续上升：市场对该结果预期升温，资金流入
   - 凯利指数持续下降：机构在打压该结果，防范意图明显
   - 剧烈波动（变化 > 0.10）：可能存在重大突发信息（核心球员伤缺、天气突变等）

5. 凯利指数与赔付率交叉验证
   - 结合凯利指数离散度：同一结果多家机构凯利指数标准差越小，机构共识度越高
   - 若凯利指数离散度 < 0.03 且方向一致，该方向可信度显著提升
   - 若离散度 > 0.08，机构分歧大，比赛走势不确定

═══════════════════════════════════════
综合预测
═══════════════════════════════════════
1. 以基本面分析为主结论，用赔率和凯利指数进行辅助验证和微调
2. 若赔率/凯利方向与基本面一致，可适当提升该方案置信度（+5~10）
3. 若赔率/凯利方向与基本面冲突，维持基本面判断，下调置信度（-5~10）并在 reasoning 中说明冲突
4. 生成 10 个不同的预测方案（不同的比分和胜负组合），方案应覆盖多种可能赛果（主胜/平局/客胜）
5. 为每个方案计算置信度（0-100）
6. 只返回置信度最高的那一个预测结果

必须只返回一个 JSON 对象，格式如下：
{
  "winner": "home/draw/away",
  "homeScore": 2,
  "awayScore": 1,
  "confidence": 75,
  "oddsAnalysis": "赔率维度总结：主胜赔率1.85隐含概率51%，平赔3.50客胜4.20，市场倾向主队...",
  "kellyAnalysis": "凯利指数分析：竞彩主胜凯利0.94、平局0.88、客胜0.97，Bet365主胜凯利0.96、平局0.86、客胜0.98，三家机构客胜凯利均>0.95离散度0.02，客队方向有投注价值...",
  "altitudeImpact": "海拔影响分析（无高海拔差异则填'无'）",
  "weatherImpact": "天气影响分析",
  "lineupNotes": "基本面维度阵容总结：双方阵型、核心球员状态、伤病禁赛及风格分析",
  "reasoning": "以基本面主结论为核心，赔率与凯利指数辅助验证：解释为何该方案置信度最高，若三维度有冲突在此说明"
}`;

  const userPrompt = `请预测以下比赛：

═══════════════════════════════════════
比赛信息
═══════════════════════════════════════
主队：${match.homeTeam}（${match.homeTeamEn} / ${match.homeShort || ''}）
客队：${match.awayTeam}（${match.awayTeamEn} / ${match.awayShort || ''}）
赛事：${match.tournament}
阶段：${match.round || '未知'}
时间：${match.date} ${match.time}
场馆：${stadium}
分组：${match.group || '无（淘汰赛/非小组赛）'}

请严格按照系统指令中的「基本面分析 → 赔率分析 → 凯利指数分析 → 综合预测」流程，搜索以上比赛的全面信息，生成10个不同的预测方案，只返回置信度最高的 JSON 结果。`;
  
  // 非流式调用，一次性返回完整结果
  const result = await model.generateText({
    model: "hy3-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });
  
  const response = result.text || '';
  
  // 直接从 result 获取 token 使用量（非流式，usage 非 Promise）
  let inputTokens = 0;
  let outputTokens = 0;
  
  if (result.usage) {
    inputTokens = result.usage.input_tokens || result.usage.prompt_tokens || 0;
    outputTokens = result.usage.output_tokens || result.usage.completion_tokens || 0;
  }
  
  return {
    response,
    tokenUsage: {
      inputTokens,
      outputTokens
    },
    prompt: {
      system: systemPrompt,
      user: userPrompt
    }
  };
}

// 解析 AI 响应
function parseAIResponse(response) {
  try {
    // 尝试直接解析 JSON
    return JSON.parse(response);
  } catch (err) {
    // 如果失败，尝试提取 JSON 部分
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (err2) {
        console.error('解析 AI 响应失败:', err2.message);
        return null;
      }
    }
    return null;
  }
}
