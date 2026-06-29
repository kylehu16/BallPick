# BallPick 数据库初始化指南

## 已完成的任务

✅ **countries 集合已创建并配置权限**
- 权限：`ADMINWRITE`（所有用户可读，仅管理员可写）
- 初始化数据文件：`cloudfunctions/initCountries/countries-data.json`
- 包含 48 支 2026 世界杯参赛球队数据

## 需要手动完成的任务

### 1. 初始化 countries 集合数据

**方法一：云开发控制台手动导入（推荐）**
1. 打开微信开发者工具，进入"云开发"控制台
2. 选择"数据库"标签
3. 选择 `countries` 集合
4. 点击"导入"按钮
5. 选择 `cloudfunctions/initCountries/countries-data.json` 文件
6. 导入完成

**方法二：部署并运行云函数**
1. 在微信开发者工具中，右键点击 `cloudfunctions/initCountries` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 部署完成后，右键点击 `index.js`
4. 选择"开启云函数本地调试"或直接调用云函数
5. 调用成功后，数据将自动插入 `countries` 集合

### 2. 创建其他集合并配置权限

需要在云开发控制台手动创建以下集合，并配置权限：

| 集合名称 | 权限配置 | 说明 |
|----------|----------|------|
| `matches` | `ADMINWRITE` | 所有用户可读，仅管理员可写 |
| `guesses` | `{ "read": "doc._openid == auth.uid", "write": "doc._openid == auth.uid" }` | 用户仅可读写自己的记录 |
| `users` | `{ "read": "doc._openid == auth.uid", "write": "doc._openid == auth.uid" }` | 用户仅可读写自己的信息 |
| `badges` | `ADMINWRITE` | 所有用户可读，仅管理员可写 |
| `user_badges` | `{ "read": "doc._openid == auth.uid", "write": "doc._openid == auth.uid" }` | 用户仅可读写自己的记录 |

### 3. 创建索引

在云开发控制台的"数据库"标签中，为每个集合创建以下索引：

**matches 集合：**
- `{ "status": 1, "date": 1 }`
- `{ "groupId": 1 }`
- `{ "matchTime": 1 }`

**guesses 集合：**
- `{ "userId": 1, "matchId": 1 }`
- `{ "userId": 1, "status": 1 }`

**users 集合：**
- `{ "_openid": 1 }`
- `{ "points": -1 }` (用于排行榜)

**countries 集合：**
- `{ "nameEn": 1 }`
- `{ "isParticipating": 1 }`

**user_badges 集合：**
- `{ "userId": 1, "badgeId": 1 }`

### 4. 初始化 badges 集合数据

`badges` 集合需要预先插入 10 条徽章定义数据，包含以下字段：
- `_id`: 徽章 ID
- `name`: 徽章名称
- `description`: 徽章描述
- `icon`: 徽章图标（emoji 或图片 URL）
- `condition`: 解锁条件（JSON 对象）
- `sortOrder`: 排序号

示例数据：
```json
[
  { "_id": "badge001", "name": "预言家", "description": "首次竞猜成功", "icon": "🎯", "condition": { "type": "firstCorrectGuess" }, "sortOrder": 1 },
  { "_id": "badge002", "name": "百分先生", "description": "准确率到达 100%", "icon": "💯", "condition": { "type": "accuracy", "value": 100 }, "sortOrder": 2 }
]
```

## 集合字段说明

### matches 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 比赛 ID |
| `tournament` | string | 赛事名称（"世界杯"） |
| `homeTeam` | string | 主队中文名称 |
| `homeShort` | string | 主队缩写 |
| `homeColor` | object | { from, to } 渐变色 |
| `awayTeam` | string | 客队中文名称 |
| `awayShort` | string | 客队缩写 |
| `awayColor` | object | { from, to } 渐变色 |
| `date` | string | 比赛日期（"06月11日"） |
| `time` | string | 比赛时间（"13:00"） |
| `status` | string | upcoming/ongoing/finished |
| `homeScore` | number | 主队得分 |
| `awayScore` | number | 客队得分 |
| `stadium` | string | 体育场名称 |
| `group` | string | 小组（"A"-"L"） |
| `round` | string | 赛事阶段 |
| `matchTime` | string | 比赛 UTC 时间（ISO 8601，如 "2026-06-11T12:00:00.000Z"） |
| `createdAt` | string | 创建时间（ISO 8601） |
| `updatedAt` | string | 更新时间（ISO 8601） |

### guesses 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 竞猜记录 ID |
| `userId` | string | 用户 openid |
| `matchId` | string | 关联比赛 ID |
| `guessType` | string | win/score |
| `prediction` | string | 预测内容 |
| `actual` | string | 实际结果 |
| `isCorrect` | boolean | 是否正确 |
| `points` | number | 获得积分 |
| `status` | string | pending/correct/wrong |
| `createdAt` | string | 创建时间（ISO 8601） |

### users 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 用户 openid |
| `nickName` | string | 昵称 |
| `avatarUrl` | string | 头像 URL |
| `supportedTeams` | array | 支持的球队 |
| `totalGuesses` | number | 总竞猜次数 |
| `correctGuesses` | number | 正确次数 |
| `accuracy` | number | 准确率 |
| `points` | number | 当前积分 |
| `consecutiveWins` | number | 连续正确次数 |
| `unlockedBadges` | array | 已解锁徽章 ID |
| `createdAt` | string | 注册时间（ISO 8601） |
| `updatedAt` | string | 更新时间（ISO 8601） |

### badges 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 徽章 ID |
| `emoji` | string | 徽章图标 |
| `name` | string | 徽章名称 |
| `desc` | string | 描述 |
| `color` | object | { from, to } 渐变色 |
| `conditionType` | string | 条件类型 |
| `conditionValue` | number | 条件阈值 |
| `sortOrder` | number | 排序号 |
| `createdAt` | string | 创建时间（ISO 8601） |

### user_badges 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 记录 ID |
| `userId` | string | 用户 openid |
| `badgeId` | string | 徽章 ID |
| `unlockedAt` | string | 解锁时间（ISO 8601） |

## 后续步骤

完成数据库初始化后，需要：
1. 创建云函数 `fetchWorldCupData` 获取世界杯数据
2. 配置定时触发器，每 6 小时更新比赛结果
3. 测试云函数，验证数据获取和队名转换

## 注意事项

- 请确保已安装 `@cloudbase/node-sdk` 依赖
- 云函数运行时建议使用 `Nodejs18.15`
- 国旗 URL 使用 `flagcdn.com` 的 CDN 服务，无需额外存储
- 如需添加更多国家数据，请参考 `countries-data.json` 格式
