const cloud = require('@cloudbase/node-sdk');

// 48 支 2026 世界杯国家队数据（从世界杯分组 JSON 提取）
const teamsData = [
  // Group 1
  { team_en: 'Mexico', team_zh: '墨西哥', team_logo: 'https://img.thesports.com/football/team/e399c54b84794822f6e5e3c02c7f3b6e.png', team_slug: 'mexico' },
  { team_en: 'South Korea', team_zh: '韩国', team_logo: 'https://img.thesports.com/football/team/a25c2f76ecf9aa566d943aa4b073627e.png', team_slug: 'south-korea' },
  { team_en: 'Czechia', team_zh: '捷克', team_logo: 'https://img.thesports.com/football/team/254d87f50ceb9708e7ff233328848e23.png', team_slug: 'czechia' },
  { team_en: 'South Africa', team_zh: '南非', team_logo: 'https://img.thesports.com/football/team/35d66916de00f7765f6064e6aaf8bf50.png', team_slug: 'south-africa' },
  // Group 2
  { team_en: 'Canada', team_zh: '加拿大', team_logo: 'https://img.thesports.com/football/team/0c7660683be3429ea77999657fa17d79.png', team_slug: 'canada' },
  { team_en: 'Bosnia and Herzegovina', team_zh: '波黑', team_logo: 'https://img.thesports.com/football/team/7e2715cb1a79a2947617c86e6b17f8e0.png', team_slug: 'bosnia-herzegovina' },
  { team_en: 'Qatar', team_zh: '卡塔尔', team_logo: 'https://img.thesports.com/football/team/a61d3f41d78a6df8bf3a367ed8e6f5a1.png', team_slug: 'qatar' },
  { team_en: 'Switzerland', team_zh: '瑞士', team_logo: 'https://img.thesports.com/football/team/f84be480c54f0ff871b91fab14a36b36.png', team_slug: 'switzerland' },
  // Group 3
  { team_en: 'Brazil', team_zh: '巴西', team_logo: 'https://img.thesports.com/football/team/9b8c6e85157f2c085a4f2e2374b3138c.png', team_slug: 'brazil' },
  { team_en: 'Morocco', team_zh: '摩洛哥', team_logo: 'https://img.thesports.com/football/team/8cb80a922c22b0865fc66c3bf3612cd8.png', team_slug: 'morocco' },
  { team_en: 'Haiti', team_zh: '海地', team_logo: 'https://img.thesports.com/football/team/46470ad68a6d9a6e9b4a0f62103bb02c.crdownload', team_slug: 'haiti' },
  { team_en: 'Scotland', team_zh: '苏格兰', team_logo: 'https://img.thesports.com/football/team/e9adf5a4762d21117d9952483a080618.png', team_slug: 'scotland' },
  // Group 4
  { team_en: 'USA', team_zh: '美国', team_logo: 'https://img.thesports.com/football/team/e8b03b5c083ffa4e9179571b70c1febe.png', team_slug: 'usa' },
  { team_en: 'Paraguay', team_zh: '巴拉圭', team_logo: 'https://img.thesports.com/football/team/a65ccc6bb50e46cef99dd71b9ad92c9f.png', team_slug: 'paraguay' },
  { team_en: 'Australia', team_zh: '澳大利亚', team_logo: 'https://img.thesports.com/football/team/6f289bdffe03a2480ad521dc2c114d56.png', team_slug: 'australia' },
  { team_en: 'Turkiye', team_zh: '土耳其', team_logo: 'https://img.thesports.com/football/team/9830762d173c37ed87f6f8ce99988adb.png', team_slug: 'turkiye' },
  // Group 5
  { team_en: 'Germany', team_zh: '德国', team_logo: 'https://img.thesports.com/football/team/c3eb0fbd35e6085a1f1e8113f5e57fe1.png', team_slug: 'germany' },
  { team_en: 'Curacao', team_zh: '库拉索', team_logo: 'https://img.thesports.com/football/team/f5bdafb8befe218e2318b144e0d35d07.crdownload', team_slug: 'curacao' },
  { team_en: "Cote d'Ivoire", team_zh: '科特迪瓦', team_logo: 'https://img.thesports.com/football/team/db5f54482ae28e132611f4c928b6f672.png', team_slug: 'cote-divoire' },
  { team_en: 'Ecuador', team_zh: '厄瓜多尔', team_logo: 'https://img.thesports.com/football/team/c749200f203be84bd11e6ce5eac2c67f.png', team_slug: 'ecuador' },
  // Group 6
  { team_en: 'Netherlands', team_zh: '荷兰', team_logo: 'https://img.thesports.com/football/team/299e5135f9cf34205563ff2a5a29ff2a.png', team_slug: 'netherlands' },
  { team_en: 'Japan', team_zh: '日本', team_logo: 'https://img.thesports.com/football/team/72894c2f1348cb00b50dbb7940f340a5.png', team_slug: 'japan' },
  { team_en: 'Sweden', team_zh: '瑞典', team_logo: 'https://img.thesports.com/football/team/2ac182a9d4f41b9cc59c7c4c8977528e.png', team_slug: 'sweden' },
  { team_en: 'Tunisia', team_zh: '突尼斯', team_logo: 'https://img.thesports.com/football/team/5de585a438634b088e5734dde6783ffd.png', team_slug: 'tunisia' },
  // Group 7
  { team_en: 'Belgium', team_zh: '比利时', team_logo: 'https://img.thesports.com/football/team/f40763e705743d293364c0056abbc341.png', team_slug: 'belgium' },
  { team_en: 'Egypt', team_zh: '埃及', team_logo: 'https://img.thesports.com/football/team/f31ddd679d7c453f8438244437b8f51f.png', team_slug: 'egypt' },
  { team_en: 'IR Iran', team_zh: '伊朗', team_logo: 'https://img.thesports.com/football/team/58b5d5f352fafb845b4f6755c2d5b724.png', team_slug: 'ir-iran' },
  { team_en: 'New Zealand', team_zh: '新西兰', team_logo: 'https://img.thesports.com/football/team/fc14ea837f002ed47a9d8805b3e7fb11.png', team_slug: 'new-zealand' },
  // Group 8
  { team_en: 'Spain', team_zh: '西班牙', team_logo: 'https://img.thesports.com/football/team/330b1095d20af4bc1f6a415ae5717ba2.png', team_slug: 'spain' },
  { team_en: 'Cabo Verde', team_zh: '佛得角', team_logo: 'https://img.thesports.com/football/team/b78fbb9123ed9633ac77215960a8a7b3.png', team_slug: 'cabo-verde' },
  { team_en: 'Saudi Arabia', team_zh: '沙特阿拉伯', team_logo: 'https://img.thesports.com/football/team/3874dcd109e646cbe7c5e8fb2bd41548.png', team_slug: 'saudi-arabia' },
  { team_en: 'Uruguay', team_zh: '乌拉圭', team_logo: 'https://img.thesports.com/football/team/087731b0d5df3969923ce974f874b453.png', team_slug: 'uruguay' },
  // Group 9
  { team_en: 'France', team_zh: '法国', team_logo: 'https://img.thesports.com/football/team/c25d791bcb75569e9e2538e6c88dcad4.png', team_slug: 'france' },
  { team_en: 'Senegal', team_zh: '塞内加尔', team_logo: 'https://img.thesports.com/football/team/57f8b2f1aba00e1ebe7b4d41ac6d4b11.png', team_slug: 'senegal' },
  { team_en: 'Iraq', team_zh: '伊拉克', team_logo: 'https://img.thesports.com/football/team/85eba6905189dba3b9de6342ede53150.png', team_slug: 'iraq' },
  { team_en: 'Norway', team_zh: '挪威', team_logo: 'https://img.thesports.com/football/team/94776d5c98df60612724f6f03ba36c0a.png', team_slug: 'norway' },
  // Group 10
  { team_en: 'Argentina', team_zh: '阿根廷', team_logo: 'https://img.thesports.com/football/team/e5e5e0f67481324ebdbd65d65890b2b8.png', team_slug: 'argentina' },
  { team_en: 'Algeria', team_zh: '阿尔及利亚', team_logo: 'https://img.thesports.com/football/team/d2d5f2ebbbee1568d330bc53b02aa0e5.png', team_slug: 'algeria' },
  { team_en: 'Austria', team_zh: '奥地利', team_logo: 'https://img.thesports.com/football/team/be70130b180875a576e98a5a33c8238a.png', team_slug: 'austria' },
  { team_en: 'Jordan', team_zh: '约旦', team_logo: 'https://img.thesports.com/football/team/b33db33105c82718034c179607a4fa56.png', team_slug: 'jordan' },
  // Group 11
  { team_en: 'Portugal', team_zh: '葡萄牙', team_logo: 'https://img.thesports.com/football/team/8863b9e186e3580aa6dec29f19155d3a.png', team_slug: 'portugal' },
  { team_en: 'Democratic Republic of the Congo', team_zh: '民主刚果', team_logo: 'https://img.thesports.com/football/team/7f5e0cd419a4b7509e13399efb75056a.png', team_slug: 'democratic-republic-of-the-congo' },
  { team_en: 'Uzbekistan', team_zh: '乌兹别克斯坦', team_logo: 'https://img.thesports.com/football/team/85c15864c8dc45d335bc3720c63cf2a1.png', team_slug: 'uzbekistan' },
  { team_en: 'Colombia', team_zh: '哥伦比亚', team_logo: 'https://img.thesports.com/football/team/e75cc11ef16eb4b01574a92b1487addb.png', team_slug: 'colombia' },
  // Group 12
  { team_en: 'England', team_zh: '英格兰', team_logo: 'https://img.thesports.com/football/team/4ffc223b0e0bbd58f069c2d128298408.png', team_slug: 'england' },
  { team_en: 'Croatia', team_zh: '克罗地亚', team_logo: 'https://img.thesports.com/football/team/29af77da9c86e3580fff75f75f0798fc.png', team_slug: 'croatia' },
  { team_en: 'Ghana', team_zh: '加纳', team_logo: 'https://img.thesports.com/football/team/f63a25999e46016f279bdb8f5caffd33.png', team_slug: 'ghana' },
  { team_en: 'Panama', team_zh: '巴拿马', team_logo: 'https://img.thesports.com/football/team/aef114700ab5fcdc5baa98d53a41761a.png', team_slug: 'panama' }
];

exports.main = async (event, context) => {
  try {
    const app = cloud.init({});
    const db = app.database();
    const collection = db.collection('sport_score_teams');
    const category = 'country';

    // 检查是否已有 country 类别的数据
    const countResult = await collection.where({ category }).count();
    if (countResult.total > 0) {
      return {
        success: true,
        message: `sport_score_teams (country) 数据已初始化，共 ${countResult.total} 条`,
        count: countResult.total
      };
    }

    // 为每条数据添加 category 字段
    const documents = teamsData.map(team => ({
      ...team,
      category
    }));

    // 批量插入
    const result = await collection.add(documents);

    return {
      success: true,
      message: 'sport_score_teams (country) 数据初始化成功',
      inserted: result.ids ? result.ids.length : documents.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
