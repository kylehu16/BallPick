# ⚽ 这球怎么猜 — BallPick

基于微信云开发的足球比赛竞猜小程序，用户可以预测 2026 世界杯比赛结果（胜负/比分），赢取积分和徽章。

## 功能概览

- **比赛浏览** — 按状态（即将开赛/进行中/已结束）和赛事分类筛选比赛，支持分页加载
- **胜负竞猜** — 预测主胜、平局、客胜，支持编辑和分享
- **比分竞猜** — 精确预测比赛比分
- **AI 预测** — 调用 CloudBase AI 模型对比赛结果进行智能预测
- **徽章系统** — 10 个成就徽章，达到条件自动解锁
- **个人中心** — 查看/编辑头像、昵称，管理支持的球队，查看竞猜统计

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | 微信小程序原生（WXML + WXSS + JS） |
| 基础库 | 3.3.4+ |
| UI 组件 | 自定义组件（navHeader / matchCard / bottomTab） |
| 后端 | 微信云开发云函数（Node.js） |
| 数据库 | 云开发文档数据库 |
| AI 能力 | CloudBase AI 模型 |
| 外部数据 | OpenFootball API（赛程）、SportScore API（比分） |

## 目录结构

```
BallPick/
├── miniprogram/              # 小程序代码
│   ├── app.js                # App 入口，初始化云开发
│   ├── app.json              # 全局配置（页面路由、全局组件）
│   ├── app.wxss              # 全局样式（CSS 变量）
│   ├── components/           # 自定义组件
│   │   ├── bottomTab/        # 底部导航栏
│   │   ├── matchCard/        # 比赛卡片
│   │   └── navHeader/        # 自定义导航头
│   ├── pages/                # 页面
│   │   ├── index/            # 首页 - 比赛列表
│   │   ├── guess/            # 我的竞猜
│   │   ├── guessDetail/      # 胜负竞猜详情
│   │   ├── guessDetailScore/ # 比分竞猜详情
│   │   ├── badge/            # 徽章墙
│   │   ├── my/               # 个人中心
│   │   └── teamSelect/       # 球队选择
│   └── utils/                # 工具函数
├── cloudfunctions/           # 云函数（20个）
├── assets/                   # 设计资源
├── package.json
├── project.config.json       # 微信小程序项目配置
└── cloudbaserc.json          # 云开发环境配置
```

## 快速开始

### 前提条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 已注册微信小程序并开通云开发

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repo-url>
   cd BallPick
   ```

2. **打开项目**
   - 用微信开发者工具打开项目根目录
   - 工具会自动识别 `miniprogram/` 为小程序根目录

3. **配置 appid**
   - 在 `project.private.config.json` 中填入你的小程序 AppID

4. **初始化数据库**
   - 在开发者工具中上传并运行 `initDatabase` 云函数
   - 上传并运行 `initCountries` 云函数（初始化 48 支参赛球队数据）
   - 详见 [DATABASE_INIT.md](./DATABASE_INIT.md)

5. **拉取赛程数据**
   - 上传并运行 `fetchWorldCupData` 云函数（或等待定时触发器自动执行）

6. **部署所有云函数**
   - 右键每个云函数 → 上传并部署（云端安装依赖）

## 页面路由

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/index/index` | 比赛列表，支持筛选和分页 |
| 我的竞猜 | `pages/guess/guess` | 查看所有竞猜记录和统计 |
| 胜负竞猜 | `pages/guessDetail/guessDetail` | 对比赛进行胜负预测 |
| 比分竞猜 | `pages/guessDetailScore/guessDetailScore` | 对比赛进行比分预测 |
| 徽章墙 | `pages/badge/badge` | 展示徽章及解锁状态 |
| 个人中心 | `pages/my/my` | 编辑头像、昵称、支持球队 |
| 球队选择 | `pages/teamSelect/teamSelect` | 搜索并选择支持的球队 |

## 云函数列表

### 数据类
| 云函数 | 说明 | 触发方式 |
|--------|------|---------|
| `fetchWorldCupData` | 拉取世界杯赛程 | 定时（每3小时） |
| `updateMatchScores` | 更新实时比分 | 定时（每30分钟） |
| `initCountries` | 初始化 48 支参赛球队 | 手动 |
| `initDatabase` | 初始化徽章和集合 | 手动 |

### 竞猜类
| 云函数 | 说明 | 触发方式 |
|--------|------|---------|
| `submitGuess` | 提交竞猜预测 | 客户端调用 |
| `deleteGuess` | 删除竞猜记录 | 客户端调用 |
| `settleGuesses` | 结算竞猜结果 | 定时（每45分钟） |
| `getMyGuesses` | 获取用户竞猜记录 | 客户端调用 |

### 徽章类
| 云函数 | 说明 | 触发方式 |
|--------|------|---------|
| `evaluateBadges` | 评估并解锁徽章 | 定时（每小时） |
| `getBadgeStatus` | 获取用户徽章状态 | 客户端调用 |

### 比赛 & AI
| 云函数 | 说明 | 触发方式 |
|--------|------|---------|
| `getMatchList` | 比赛列表分页查询 | 客户端调用 |
| `getMatchDetail` | 比赛详情查询 | 客户端调用 |
| `aiPredict` | AI 预测比赛结果 | 定时（每1小时） |
| `getAIPrediction` | 获取 AI 预测 | 客户端调用 |
| `getCountries` | 获取参赛国家列表 | 客户端调用 |

### 用户类
| 云函数 | 说明 | 触发方式 |
|--------|------|---------|
| `getUserProfile` | 获取用户信息 | 客户端调用 |
| `updateUserProfile` | 更新用户信息 | 客户端调用 |
| `updateUserTeams` | 更新支持球队 | 客户端调用 |

### 工具类
| 云函数 | 说明 | 触发方式 |
|--------|------|---------|
| `migrateTimeFields` | 迁移时间字段格式 | 手动 |
| `initSportScoreTeams` | 初始化球队 Logo | 手动 |

## 数据库集合

| 集合 | 说明 |
|------|------|
| `matches` | 比赛数据（赛程、比分、状态） |
| `guesses` | 用户竞猜记录 |
| `users` | 用户信息（积分、准确率、支持球队） |
| `countries` | 48 支参赛球队数据 |
| `badges` | 徽章定义（10个） |
| `user_badges` | 用户已解锁的徽章 |
| `ai_predictions` | AI 预测结果 |
| `sportscore_teams` | 球队 Logo 数据 |

## 徽章系统

共 10 个徽章，`evaluateBadges` 云函数每小时自动评估所有用户是否满足条件：

| 徽章 | 条件 |
|------|------|
| 🎯 预言家 | 首次竞猜成功 |
| 💯 百分先生 | 准确率到达 100% |
| 🔥 连胜王者 | 连续正确 5 次 |
| ⚽ 足球新手 | 完成首次竞猜 |
| 🌟 竞猜达人 | 完成 50 次竞猜 |
| 🏅 预测大师 | 准确率超过 80% |
| 💎 钻石会员 | 参加竞猜 100 次 |
| 🎨 全能选手 | 竞猜过所有分组 |
| 🚀 火箭升空 | 单日正确 10 次 |
| 👑 竞猜之王 | 总正确次数超过 100 |

## 设计规范

- **主色**: `#155DFC`（蓝色）
- **导航头**: 渐变蓝色 `linear-gradient(90deg, #155DFC 0%, #193CB8 100%)`
- **卡片**: 白色背景、28rpx 圆角、浅阴影
- **导航方式**: `navigationStyle: "custom"` + 自定义底部 Tab 组件
- **赛事标签**: 黄底黄框（`#FEF9C2` / `#FFDF20`）

## License

MIT
