# Zotero-SideAI Requirements

## 当前文本范围决策

`当前文本` 在 MVP 第一版中的定义固定为：

- 当前选中文献条目的标题
- 当前选中文献条目的摘要
- 当前选中文献条目下的全部 note 文本

不纳入第一版范围的内容：

- 当前选中的 note 单独作为唯一来源
- PDF 全文抽取
- PDF 选区文本
- OCR 文本
- 附件全文索引

## 选择这个范围的原因

- 比只读 note 更通用，适合大多数文献条目
- 比直接做 PDF 全文抽取更容易稳定落地
- 能覆盖“文献摘要 + 自己笔记”这一核心使用场景
- 便于后续继续扩展更多上下文来源

## 组装规则

发送给模型前，将当前文本整理成统一结构：

```text
Title:
<title>

Abstract:
<abstract>

Notes:
<merged note content>
```

规则说明：

- 标题为空时省略 `Title` 段
- 摘要为空时省略 `Abstract` 段
- 没有 note 时省略 `Notes` 段
- 多个 note 按 Zotero 返回顺序拼接，中间使用空行分隔
- 如果最终没有任何可用文本，则禁止发送并提示用户

## 长度策略

第一版先支持基础截断，不做复杂分块：

- 先完整拼接标题、摘要、notes
- 超过预设长度时优先保留标题和摘要
- 对 notes 在尾部截断
- 在 UI 中提示“当前文本过长，已截断”

## 验收标准

满足以下条件即可认为该项完成：

- 已选中文献条目时，插件能得到一个统一的文本上下文
- 缺失标题、摘要或 note 时不会报错
- 完全没有可用文本时，插件不会发送空请求
- 后续开发统一以此文档作为 MVP 的“当前文本”定义

## 接口协议决策

MVP 第一版固定采用 `OpenAI Chat Completions` 兼容协议发送请求。

第一版请求目标：

- 支持可配置 `baseURL`
- 支持可配置模型名
- 支持 `Authorization: Bearer <API_KEY>`
- 请求体使用 `messages` 结构
- 返回结果优先从 `choices[0].message.content` 读取

第一版不纳入范围：

- OpenAI `Responses API`
- 多协议自动探测
- 流式 SSE 渲染
- 非 OpenAI 兼容的私有协议适配

## 请求格式约定

请求方法：

- `POST`

请求路径：

- `<baseURL>/chat/completions`

请求头：

```text
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

请求体最小结构：

```json
{
  "model": "<model>",
  "messages": [
    {
      "role": "system",
      "content": "<fixed prompt>"
    },
    {
      "role": "user",
      "content": "<current text>"
    }
  ]
}
```

响应读取规则：

- 成功时读取 `choices[0].message.content`
- 如果 `choices` 为空，则视为协议错误
- 如果 HTTP 非 2xx，则显示服务端状态码和错误消息
- 如果返回体不是预期 JSON，则显示“响应格式不兼容”

## 选择这个协议的原因

- 大多数支持自定义 `baseURL` 的 AI 服务都兼容该格式
- 与你当前“固定提示词 + 当前文本上传”的场景匹配度最高
- 结构简单，便于 Zotero 插件内先做稳定闭环
- 后续如要扩展 `Responses API`，可以在现有 `api` 模块上继续演进

## 实现边界

第一版只保证以下能力：

- 手动点击发送一次请求
- 发送固定提示词和当前文本
- 展示一次完整响应或报错

第一版不保证：

- 多轮上下文记忆
- 工具调用
- 图片输入
- 流式增量输出
- 自动重试与请求队列

## 协议验收标准

满足以下条件即可认为该项完成：

- 文档中已明确第一版协议为 `OpenAI Chat Completions` 兼容格式
- 已明确请求路径、请求头、请求体和响应读取规则
- 已明确不在第一版范围内的协议能力
- 后续实现统一以此协议约定为准
