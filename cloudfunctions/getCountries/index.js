const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = app.database();

exports.main = async (event, context) => {
  try {
    const res = await db.collection('countries')
      .where({ isParticipating: true })
      .limit(100)
      .get();

    const countries = (res.data || []).sort((a, b) =>
      a.nameZh.localeCompare(b.nameZh, 'zh')
    );

    return {
      success: true,
      data: countries,
      total: countries.length
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
