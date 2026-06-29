const cloud = require('@cloudbase/node-sdk');

/**
 * 将 yyyyMMddHHmmss 数字格式转为 ISO 8601 UTC 字符串
 * 例如: 20250611200000 → '2025-06-11T20:00:00.000Z'
 * 如果已经是 ISO 字符串则原样返回
 */
function numToISO(value) {
  if (typeof value === 'string') {
    // 已经是字符串，检查是否已经是 ISO 格式
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return value; // 已经是 ISO 格式，不转换
    }
    // 可能是数字字符串，尝试转数字
    const num = Number(value);
    if (isNaN(num)) return value; // 无法识别，保持原样
    value = num;
  }

  if (typeof value !== 'number') return value;

  const str = String(value);

  // yyyyMMddHHmmss (14位)
  if (str.length === 14) {
    const y = parseInt(str.slice(0, 4));
    const m = parseInt(str.slice(4, 6)) - 1; // 月份从0开始
    const d = parseInt(str.slice(6, 8));
    const h = parseInt(str.slice(8, 10));
    const min = parseInt(str.slice(10, 12));
    const s = parseInt(str.slice(12, 14));
    return new Date(Date.UTC(y, m, d, h, min, s)).toISOString();
  }

  // yyyyMMdd (8位) - 默认为当天 00:00:00 UTC
  if (str.length === 8) {
    const y = parseInt(str.slice(0, 4));
    const m = parseInt(str.slice(4, 6)) - 1;
    const d = parseInt(str.slice(6, 8));
    return new Date(Date.UTC(y, m, d, 0, 0, 0)).toISOString();
  }

  // 其他格式：尝试用 new Date 解析
  const dt = new Date(value);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString();
  }

  return value;
}

/**
 * 迁移单个集合的时间字段
 */
async function migrateCollection(db, collectionName, timeFields, options = {}) {
  const { dryRun = false, batchSize = 100 } = options;
  const coll = db.collection(collectionName);
  const stats = {
    collection: collectionName,
    totalDocs: 0,
    updatedDocs: 0,
    fields: {}
  };

  // 初始化各字段统计
  timeFields.forEach(f => { stats.fields[f] = { converted: 0, skipped: 0 }; });

  // 获取总文档数
  const countRes = await coll.count();
  stats.totalDocs = countRes.total;

  if (countRes.total === 0) {
    return stats;
  }

  // 分页遍历
  const totalPages = Math.ceil(countRes.total / batchSize);
  for (let page = 0; page < totalPages; page++) {
    const res = await coll.skip(page * batchSize).limit(batchSize).get();

    for (const doc of res.data) {
      const updateData = {};
      let needUpdate = false;

      for (const field of timeFields) {
        const oldVal = doc[field];
        if (oldVal === undefined || oldVal === null) continue;

        const newVal = numToISO(oldVal);

        if (newVal !== oldVal) {
          updateData[field] = newVal;
          stats.fields[field].converted++;
          needUpdate = true;
        } else {
          stats.fields[field].skipped++;
        }
      }

      if (needUpdate && !dryRun) {
        await coll.doc(doc._id).update(updateData);
        stats.updatedDocs++;
      } else if (needUpdate) {
        stats.updatedDocs++;
      }
    }
  }

  return stats;
}

exports.main = async (event, context) => {
  try {
    const app = cloud.init({});
    const db = app.database();

    const dryRun = event.dryRun !== false; // 默认 dryRun=true，预览模式
    const collections = event.collections || [
      'matches',
      'guesses',
      'users',
      'badges',
      'user_badges',
      'ai_predictions'
    ];

    // 各集合需要迁移的时间字段
    const collectionTimeFields = {
      matches: ['matchTime', 'updatedAt'],
      guesses: ['createdAt', 'updatedAt'],
      users: ['createdAt', 'updatedAt', 'shareTime'],
      badges: ['createdAt'],
      user_badges: ['unlockedAt'],
      ai_predictions: ['createdAt']
    };

    const allResults = [];
    let totalConverted = 0;
    let totalSkipped = 0;

    for (const collName of collections) {
      const timeFields = collectionTimeFields[collName];
      if (!timeFields || timeFields.length === 0) {
        allResults.push({ collection: collName, skipped: true, reason: '未配置时间字段' });
        continue;
      }

      const result = await migrateCollection(db, collName, timeFields, {
        dryRun,
        batchSize: event.batchSize || 100
      });

      allResults.push(result);

      // 汇总
      for (const [field, stats] of Object.entries(result.fields)) {
        totalConverted += stats.converted;
        totalSkipped += stats.skipped;
      }
    }

    return {
      success: true,
      mode: dryRun ? 'DRY_RUN' : 'EXECUTED',
      message: dryRun
        ? '预览模式：请确认结果后传入 { dryRun: false } 执行实际迁移'
        : '迁移完成',
      summary: {
        totalConverted,
        totalSkipped
      },
      results: allResults
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
