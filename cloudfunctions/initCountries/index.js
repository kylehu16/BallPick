const cloud = require('@cloudbase/node-sdk');

// 48 支 2026 世界杯参赛球队数据
const countriesData = [
  { _id: 'MEX', code: 'MEX', nameZh: '墨西哥', nameEn: 'Mexico', nameShort: '墨西哥', flagUrl: 'https://flagcdn.com/w320/mx.png', isParticipating: true, group: 'A' },
  { _id: 'KOR', code: 'KOR', nameZh: '韩国', nameEn: 'South Korea', nameShort: '韩国', flagUrl: 'https://flagcdn.com/w320/kr.png', isParticipating: true, group: 'A' },
  { _id: 'RSA', code: 'RSA', nameZh: '南非', nameEn: 'South Africa', nameShort: '南非', flagUrl: 'https://flagcdn.com/w320/za.png', isParticipating: true, group: 'A' },
  { _id: 'CZE', code: 'CZE', nameZh: '捷克', nameEn: 'Czech Republic', nameShort: '捷克', flagUrl: 'https://flagcdn.com/w320/cz.png', isParticipating: true, group: 'A' },
  { _id: 'CAN', code: 'CAN', nameZh: '加拿大', nameEn: 'Canada', nameShort: '加拿大', flagUrl: 'https://flagcdn.com/w320/ca.png', isParticipating: true, group: 'B' },
  { _id: 'SUI', code: 'SUI', nameZh: '瑞士', nameEn: 'Switzerland', nameShort: '瑞士', flagUrl: 'https://flagcdn.com/w320/ch.png', isParticipating: true, group: 'B' },
  { _id: 'QAT', code: 'QAT', nameZh: '卡塔尔', nameEn: 'Qatar', nameShort: '卡塔尔', flagUrl: 'https://flagcdn.com/w320/qa.png', isParticipating: true, group: 'B' },
  { _id: 'BIH', code: 'BIH', nameZh: '波黑', nameEn: 'Bosnia and Herzegovina', nameShort: '波黑', flagUrl: 'https://flagcdn.com/w320/ba.png', isParticipating: true, group: 'B' },
  { _id: 'BRA', code: 'BRA', nameZh: '巴西', nameEn: 'Brazil', nameShort: '巴西', flagUrl: 'https://flagcdn.com/w320/br.png', isParticipating: true, group: 'C' },
  { _id: 'MAR', code: 'MAR', nameZh: '摩洛哥', nameEn: 'Morocco', nameShort: '摩洛哥', flagUrl: 'https://flagcdn.com/w320/ma.png', isParticipating: true, group: 'C' },
  { _id: 'SCO', code: 'SCO', nameZh: '苏格兰', nameEn: 'Scotland', nameShort: '苏格兰', flagUrl: 'https://flagcdn.com/w320/gb.png', isParticipating: true, group: 'C' },
  { _id: 'HAI', code: 'HAI', nameZh: '海地', nameEn: 'Haiti', nameShort: '海地', flagUrl: 'https://flagcdn.com/w320/ht.png', isParticipating: true, group: 'C' },
  { _id: 'USA', code: 'USA', nameZh: '美国', nameEn: 'USA', nameShort: '美国', flagUrl: 'https://flagcdn.com/w320/us.png', isParticipating: true, group: 'D' },
  { _id: 'PAR', code: 'PAR', nameZh: '巴拉圭', nameEn: 'Paraguay', nameShort: '巴拉圭', flagUrl: 'https://flagcdn.com/w320/py.png', isParticipating: true, group: 'D' },
  { _id: 'AUS', code: 'AUS', nameZh: '澳大利亚', nameEn: 'Australia', nameShort: '澳大利亚', flagUrl: 'https://flagcdn.com/w320/au.png', isParticipating: true, group: 'D' },
  { _id: 'TUR', code: 'TUR', nameZh: '土耳其', nameEn: 'Turkiye', nameShort: '土耳其', flagUrl: 'https://flagcdn.com/w320/tr.png', isParticipating: true, group: 'D' },
  { _id: 'GER', code: 'GER', nameZh: '德国', nameEn: 'Germany', nameShort: '德国', flagUrl: 'https://flagcdn.com/w320/de.png', isParticipating: true, group: 'E' },
  { _id: 'ECU', code: 'ECU', nameZh: '厄瓜多尔', nameEn: 'Ecuador', nameShort: '厄瓜多尔', flagUrl: 'https://flagcdn.com/w320/ec.png', isParticipating: true, group: 'E' },
  { _id: 'CIV', code: 'CIV', nameZh: '科特迪瓦', nameEn: "Cote d'Ivoire", nameShort: '科特迪瓦', flagUrl: 'https://flagcdn.com/w320/ci.png', isParticipating: true, group: 'E' },
  { _id: 'CUW', code: 'CUW', nameZh: '库拉索', nameEn: 'Curacao', nameShort: '库拉索', flagUrl: 'https://flagcdn.com/w320/cw.png', isParticipating: true, group: 'E' },
  { _id: 'NED', code: 'NED', nameZh: '荷兰', nameEn: 'Netherlands', nameShort: '荷兰', flagUrl: 'https://flagcdn.com/w320/nl.png', isParticipating: true, group: 'F' },
  { _id: 'JPN', code: 'JPN', nameZh: '日本', nameEn: 'Japan', nameShort: '日本', flagUrl: 'https://flagcdn.com/w320/jp.png', isParticipating: true, group: 'F' },
  { _id: 'TUN', code: 'TUN', nameZh: '突尼斯', nameEn: 'Tunisia', nameShort: '突尼斯', flagUrl: 'https://flagcdn.com/w320/tn.png', isParticipating: true, group: 'F' },
  { _id: 'SWE', code: 'SWE', nameZh: '瑞典', nameEn: 'Sweden', nameShort: '瑞典', flagUrl: 'https://flagcdn.com/w320/se.png', isParticipating: true, group: 'F' },
  { _id: 'BEL', code: 'BEL', nameZh: '比利时', nameEn: 'Belgium', nameShort: '比利时', flagUrl: 'https://flagcdn.com/w320/be.png', isParticipating: true, group: 'G' },
  { _id: 'IRN', code: 'IRN', nameZh: '伊朗', nameEn: 'Iran', nameShort: '伊朗', flagUrl: 'https://flagcdn.com/w320/ir.png', isParticipating: true, group: 'G' },
  { _id: 'EGY', code: 'EGY', nameZh: '埃及', nameEn: 'Egypt', nameShort: '埃及', flagUrl: 'https://flagcdn.com/w320/eg.png', isParticipating: true, group: 'G' },
  { _id: 'NZL', code: 'NZL', nameZh: '新西兰', nameEn: 'New Zealand', nameShort: '新西兰', flagUrl: 'https://flagcdn.com/w320/nz.png', isParticipating: true, group: 'G' },
  { _id: 'ESP', code: 'ESP', nameZh: '西班牙', nameEn: 'Spain', nameShort: '西班牙', flagUrl: 'https://flagcdn.com/w320/es.png', isParticipating: true, group: 'H' },
  { _id: 'URU', code: 'URU', nameZh: '乌拉圭', nameEn: 'Uruguay', nameShort: '乌拉圭', flagUrl: 'https://flagcdn.com/w320/uy.png', isParticipating: true, group: 'H' },
  { _id: 'KSA', code: 'KSA', nameZh: '沙特阿拉伯', nameEn: 'Saudi Arabia', nameShort: '沙特', flagUrl: 'https://flagcdn.com/w320/sa.png', isParticipating: true, group: 'H' },
  { _id: 'CPV', code: 'CPV', nameZh: '佛得角', nameEn: 'Cape Verde', nameShort: '佛得角', flagUrl: 'https://flagcdn.com/w320/cv.png', isParticipating: true, group: 'H' },
  { _id: 'FRA', code: 'FRA', nameZh: '法国', nameEn: 'France', nameShort: '法国', flagUrl: 'https://flagcdn.com/w320/fr.png', isParticipating: true, group: 'I' },
  { _id: 'SEN', code: 'SEN', nameZh: '塞内加尔', nameEn: 'Senegal', nameShort: '塞内加尔', flagUrl: 'https://flagcdn.com/w320/sn.png', isParticipating: true, group: 'I' },
  { _id: 'NOR', code: 'NOR', nameZh: '挪威', nameEn: 'Norway', nameShort: '挪威', flagUrl: 'https://flagcdn.com/w320/no.png', isParticipating: true, group: 'I' },
  { _id: 'IRQ', code: 'IRQ', nameZh: '伊拉克', nameEn: 'Iraq', nameShort: '伊拉克', flagUrl: 'https://flagcdn.com/w320/iq.png', isParticipating: true, group: 'I' },
  { _id: 'ARG', code: 'ARG', nameZh: '阿根廷', nameEn: 'Argentina', nameShort: '阿根廷', flagUrl: 'https://flagcdn.com/w320/ar.png', isParticipating: true, group: 'J' },
  { _id: 'ALG', code: 'ALG', nameZh: '阿尔及利亚', nameEn: 'Algeria', nameShort: '阿尔及利亚', flagUrl: 'https://flagcdn.com/w320/dz.png', isParticipating: true, group: 'J' },
  { _id: 'AUT', code: 'AUT', nameZh: '奥地利', nameEn: 'Austria', nameShort: '奥地利', flagUrl: 'https://flagcdn.com/w320/at.png', isParticipating: true, group: 'J' },
  { _id: 'JOR', code: 'JOR', nameZh: '约旦', nameEn: 'Jordan', nameShort: '约旦', flagUrl: 'https://flagcdn.com/w320/jo.png', isParticipating: true, group: 'J' },
  { _id: 'POR', code: 'POR', nameZh: '葡萄牙', nameEn: 'Portugal', nameShort: '葡萄牙', flagUrl: 'https://flagcdn.com/w320/pt.png', isParticipating: true, group: 'K' },
  { _id: 'COL', code: 'COL', nameZh: '哥伦比亚', nameEn: 'Colombia', nameShort: '哥伦比亚', flagUrl: 'https://flagcdn.com/w320/co.png', isParticipating: true, group: 'K' },
  { _id: 'UZB', code: 'UZB', nameZh: '乌兹别克斯坦', nameEn: 'Uzbekistan', nameShort: '乌兹别克', flagUrl: 'https://flagcdn.com/w320/uz.png', isParticipating: true, group: 'K' },
  { _id: 'COD', code: 'COD', nameZh: '民主刚果', nameEn: 'DR Congo', nameShort: '民主刚果', flagUrl: 'https://flagcdn.com/w320/cd.png', isParticipating: true, group: 'K' },
  { _id: 'ENG', code: 'ENG', nameZh: '英格兰', nameEn: 'England', nameShort: '英格兰', flagUrl: 'https://flagcdn.com/w320/gb.png', isParticipating: true, group: 'L' },
  { _id: 'CRO', code: 'CRO', nameZh: '克罗地亚', nameEn: 'Croatia', nameShort: '克罗地亚', flagUrl: 'https://flagcdn.com/w320/hr.png', isParticipating: true, group: 'L' },
  { _id: 'GHA', code: 'GHA', nameZh: '加纳', nameEn: 'Ghana', nameShort: '加纳', flagUrl: 'https://flagcdn.com/w320/gh.png', isParticipating: true, group: 'L' },
  { _id: 'PAN', code: 'PAN', nameZh: '巴拿马', nameEn: 'Panama', nameShort: '巴拿马', flagUrl: 'https://flagcdn.com/w320/pa.png', isParticipating: true, group: 'L' }
];

exports.main = async (event, context) => {
  try {
    const app = cloud.init({});
    const db = app.database();
    
    // 检查是否已有数据
    const countResult = await db.collection('countries').count();
    if (countResult.total > 0) {
      return { success: true, message: 'Countries data already initialized', count: countResult.total };
    }
    
    // 批量插入数据
    const result = await db.collection('countries').add(countriesData);
    
    return {
      success: true,
      message: 'Countries data initialized successfully',
      inserted: result.inserted
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
