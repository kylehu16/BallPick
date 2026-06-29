# Countries 集合初始化指南

## 数据说明
`countries-data.json` 包含 48 支 2026 年世界杯参赛球队的数据，字段说明：
- `_id`: FIFA 3 字母代码（主键）
- `code`: FIFA 代码
- `nameZh`: 中文名称
- `nameEn`: 英文名称
- `nameShort`: 中文简称
- `flagUrl`: 国旗图片 URL
- `isParticipating`: 是否参加 2026 世界杯
- `group`: 分组（A-L）

## 初始化方法

### 方法一：云开发控制台手动导入（推荐）

1. 打开微信开发者工具，进入"云开发"控制台
2. 选择"数据库"标签
3. 选择 `countries` 集合
4. 点击"导入"按钮
5. 选择 `cloudfunctions/initCountries/countries-data.json` 文件
6. 导入完成

### 方法二：部署并运行云函数

1. 在微信开发者工具中，右键点击 `cloudfunctions/initCountries` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 部署完成后，右键点击 `index.js`
4. 选择"开启云函数本地调试"或直接调用云函数
6. 调用成功后，数据将自动插入 `countries` 集合

### 方法三：本地脚本初始化

1. 安装依赖：
   ```bash
   cd cloudfunctions/initCountries
   npm install
   ```

2. 配置环境变量（在微信开发者工具中设置云开发环境 ID）

3. 运行脚本：
   ```bash
   node init-script.js
   ```

## 注意事项

- 请确保已创建 `countries` 集合并配置权限为"所有用户可读，仅管理员可写"
- 如果集合中已有数据，云函数会自动跳过初始化
- 国旗 URL 使用 `flagcdn.com` 的 CDN 服务，无需额外存储
