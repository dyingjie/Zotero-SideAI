# Zotero-SideAI

一个面向 Zotero 8 的侧边栏 AI 插件项目。

当前目标是做出一个最小可用版本，支持在 Zotero 侧边栏中读取当前文献文本，拼接固定提示词，并通过自定义 `baseURL` 调用 OpenAI 兼容接口获取结果。

## 项目目标

第一版核心能力：

- 支持 Zotero 8
- 兼容 Zotero 侧边栏
- 支持配置 API Key
- 支持配置 `baseURL`
- 支持配置模型名
- 支持保存固定提示词
- API Key 由用户本地配置，不写死在插件代码中
- 支持自动读取当前文本
- 支持手动点击发送
- 支持在侧边栏展示 AI 返回结果

## MVP 约束

当前已经确定的第一版约束如下：

- 当前文本范围：标题 + 摘要 + 全部 note 文本
- 接口协议：OpenAI Chat Completions 兼容格式
- 固定提示词策略：全局单模板
- 交互方式：手动点击发送
- 结果展示：纯文本优先，不做完整 Markdown 渲染

详细决策见：

- [docs/requirements.md](docs/requirements.md)

## 计划中的使用流程

1. 用户在 Zotero 8 中打开插件侧边栏
2. 配置 API Key、`baseURL`、模型名和固定提示词
3. 插件读取当前选中文献的标题、摘要和 note
4. 用户点击发送
5. 插件按 OpenAI 兼容接口发起请求
6. 侧边栏展示返回结果或错误信息

## 当前文本定义

第一版发送给模型的上下文固定为：

- 当前条目的标题
- 当前条目的摘要
- 当前条目的全部 note 文本

发送前会整理为统一文本结构，缺失字段时自动省略。

## 接口约定

第一版固定采用 OpenAI Chat Completions 兼容接口。

请求约定：

- 方法：`POST`
- 路径：`<baseURL>/chat/completions`
- 认证：`Authorization: Bearer <API_KEY>`
- 请求体包含 `model` 和 `messages`

## 开发阶段

当前开发路线按以下顺序推进：

1. 方案定稿
2. 仓库基础初始化
3. Zotero 8 插件骨架
4. 侧边栏 UI 集成
5. 设置与持久化
6. 当前文本采集
7. Prompt 组装
8. AI 请求服务
9. 结果展示与交互
10. 稳定性与兼容性
11. 发布准备

详细任务清单见：

- [TODO.md](TODO.md)

## 当前仓库状态

当前仓库主要包含：

- `README.md`：项目说明
- `TODO.md`：按阶段拆分的开发清单
- `docs/requirements.md`：MVP 需求与关键决策
- `docs/structure.md`：项目目录结构说明
- `docs/development.md`：开发说明文档

当前目录骨架：

```text
addon/
docs/
src/
  bootstrap/
  services/
  settings/
  sidebar/
  utils/
```

目前还没有正式的 Zotero 插件代码骨架，接下来会先完成基础项目结构与插件入口搭建。

目前已经包含最小插件骨架文件：

- `package.json`
- `tsconfig.json`
- `zotero-plugin.config.ts`
- `addon/bootstrap.js`
- `addon/manifest.json`
- `src/index.ts`
- `src/addon.ts`
- `src/hooks.ts`

当前还包含一个最小可见的 Zotero Item Pane 面板：

- 启动后会在 Zotero 条目侧边栏注册 `SideAI` section
- 当前已经包含配置区、上下文区、输出区、操作区四个基础区块
- 当前已经具备 `empty`、`ready`、`loading`、`error` 的基础状态壳子
- 当前 `Copy` 按钮已经接入，可复制输出区文本
- 当前已处理窄侧边栏下的按钮换行、长文本滚动和区块宽度收缩
- 当前模型配置区域已包含 `baseURL`、`model`、`API Key` 表单骨架
- 当前固定提示词编辑区已包含在配置卡片中
- 当前配置区已支持保存 `API Key`、`baseURL`、模型名和固定提示词
- 当前插件启动后会自动加载已保存配置，并支持恢复默认值
- 当前面板已能跟随 Zotero 当前选中条目刷新，并处理未选中条目的空状态
- 当前文本采集已能提取条目标题，并在缺失时回退到默认标题文案
- 当前文本采集已能读取条目摘要，并在存在内容时加入预览上下文
- 当前文本采集已能合并全部 note 内容，不再只显示前两个片段
- 当前文本采集内部已整理为统一上下文对象，便于后续 Prompt 组装和请求发送
- 当前文本预览区域已显示将要发送的标题、摘要和 notes 预览内容
- 当前服务层已定义 OpenAI Chat Completions 请求消息结构
- 当前固定提示词已定义为 `system` 消息来源
- 当前统一上下文文本已可拼接为 `user` 消息内容
- 当前固定提示词已支持基础变量替换，如 `{{title}}`、`{{abstractText}}`、`{{notesText}}`
- 当前侧边栏已在发送前显示最终请求预览，便于开发期调试 `system/user` 消息
- 当前服务层已封装统一的 Chat Completions POST 请求入口
- 当前请求服务已支持从自定义 `baseURL` 组装 `/chat/completions` 地址
- 当前请求服务已支持透传自定义模型名到请求体
- 当前请求服务已支持超时控制，并通过 `AbortSignal` 终止请求
- 当前请求服务已统一处理超时、网络异常和 HTTP 非 2xx 错误
- 当前请求服务已支持解析 OpenAI Chat Completions 兼容响应
- 当前 AI 请求服务当前仅实现 OpenAI Chat Completions 兼容接口
- 当前 `Send` 按钮已接入真实请求链路，成功时会在 Output 区显示模型返回结果
- 当前响应结果区域已包含结果标题、状态标记和独立输出容器
- 当前结果区域已区分正常结果与错误状态，并同步更新状态标记
- 当前成功响应已支持基础 Markdown 渲染，包含段落和 fenced code block
- 当前代码块已支持轻量高亮，并显示语言标签
- 当前侧边栏已记录最近几次会话结果，可点击回看历史输出
- 当前 `Copy` 按钮可复制结果区文本，并在无内容时给出提示
- 当前在请求失败后仍可直接点击 `Send` 重试
- 当前 `Clear` 按钮可清空当前会话输出，不影响配置和上下文预览
- 当前 `npm test` 已在 Zotero 8 测试环境验证主流程启动、设置、请求链路和会话历史
- 后续会在这个面板里继续接入设置、上下文预览和发送按钮

## 开发原则

第一版优先目标不是功能堆积，而是先把主闭环做稳：

- 插件能在 Zotero 8 中加载
- 侧边栏能正常显示
- 当前文本能稳定采集
- Prompt 组装逻辑清晰
- AI 请求能稳定返回
- 错误状态可理解、可恢复

## 暂不纳入第一版

以下能力暂不作为 MVP 范围：

- 多轮会话
- 流式输出
- Responses API
- PDF 全文抽取
- OCR
- 向量检索
- 多模板系统
- 自动写回 Zotero 条目

## 下一步

接下来优先完成：

- 补齐配置校验与错误提示
- 接入真实 Prompt 组装逻辑
- 接入真实 AI 请求服务
