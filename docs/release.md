# Release Notes

## 首个版本

- 版本：`0.1.0`
- 发布定位：Zotero 8 侧边栏 AI 插件 MVP 首版

## 本版包含能力

- Zotero 8 Item Pane 侧边栏集成
- API Key、`baseURL`、模型名、固定提示词本地保存
- 标题、摘要、全部 note 的统一上下文采集
- 请求前最终消息预览
- OpenAI Chat Completions 兼容请求
- 成功结果、错误结果、复制、重试、清空
- Markdown 基础渲染
- 代码块轻量高亮
- 当前侧边栏会话历史
- 超长文本截断
- 错误 `baseURL`
- 错误 API Key
- 网络超时
- 快速重复发送保护

## 本版未包含能力

- Responses API
- 流式输出
- 多轮会话
- PDF 全文抽取
- OCR
- 自动写回 Zotero 条目

## 发布前验证

已使用以下命令完成当前版本验证：

```powershell
$env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH='C:\Program Files\Zotero\zotero.exe'
npm test
npm run build
```

## 构建产物

当前构建完成后，可在以下目录查看打包结果：

```text
.scaffold/build/addon
```

主要文件包括：

- `bootstrap.js`
- `manifest.json`
- `content/scripts/sideai.js`

## 发布说明建议

发布仓库首个 release 时，建议说明以下信息：

- 当前版本为 `0.1.0`
- 当前面向 Zotero 8
- 当前仅支持 OpenAI Chat Completions 兼容接口
- `baseURL` 需要填写到 `/v1`
- 当前仍属于 MVP 首版，后续会继续补充兼容性和发布细节
