# Development Guide

## 目的

这份文档用于约定 Zotero-SideAI 的开发方式，帮助后续按同一思路继续实现。

当前项目还处于骨架阶段，目标不是一次性把所有功能做完，而是按最小闭环逐步推进。

## 当前开发目标

优先完成以下主链路：

1. Zotero 8 插件可以安装和加载
2. 侧边栏面板可以显示
3. 设置可以保存和读取
4. 当前文本可以采集出来
5. Prompt 可以稳定组装
6. 可以通过自定义 `baseURL` 发起 OpenAI 兼容请求
7. 结果可以在侧边栏中展示

## 推荐开发顺序

建议严格按下面顺序推进，尽量不要跳步：

1. 搭建 Zotero 8 插件最小骨架
2. 注册基础入口和启动逻辑
3. 加入侧边栏空白面板
4. 接入设置存储
5. 接入当前文本采集
6. 接入 Prompt 组装
7. 接入 AI 请求服务
8. 接入结果展示与错误处理

## 目录职责

### `src/bootstrap/`

用于放置：

- 插件入口
- 生命周期注册
- 启动与清理逻辑

要求：

- 与 Zotero 直接耦合的初始化代码优先放这里
- 不要把业务逻辑直接堆在入口文件中

### `src/sidebar/`

用于放置：

- 侧边栏 UI
- 发送按钮和状态展示
- 当前文本预览
- 结果区域

要求：

- UI 层只负责交互和展示
- 请求、配置、上下文读取尽量通过服务层提供

### `src/services/`

用于放置：

- 当前文本采集
- Prompt 组装
- AI 请求
- 响应解析

建议后续继续细分为：

- `context`
- `prompt`
- `api`

### `src/settings/`

用于放置：

- 默认配置
- 配置校验
- 配置保存与读取

### `src/utils/`

用于放置：

- 文本处理
- 截断逻辑
- 通用错误格式化
- 可复用辅助函数

## 当前功能决策

实现时统一遵循这些约束：

- 当前文本：标题 + 摘要 + 全部 note
- 协议：OpenAI Chat Completions 兼容
- 固定提示词：全局单模板
- 发送方式：手动点击发送
- 结果展示：纯文本优先

详细约束见：

- `docs/requirements.md`

## 开发时的实现原则

### 先做稳定闭环

优先做“能跑通”的最小路径，不要一开始追求复杂功能。

例如：

- 先做单次请求，不做多轮会话
- 先做纯文本结果，不做完整 Markdown
- 先做非流式，不做 SSE

### 模块边界要清楚

避免下面这种情况：

- 在 UI 文件里直接写 HTTP 请求
- 在入口文件里直接拼 prompt
- 在多个地方复制配置读取逻辑

推荐做法：

- 配置只从 `settings` 出口读取
- Prompt 只从一个服务函数生成
- AI 请求只从一个服务入口发起

### 错误处理尽量前置

在真正发请求前，优先检查：

- API Key 是否存在
- `baseURL` 是否存在
- `model` 是否存在
- 当前文本是否为空

如果前置条件不满足，应在 UI 直接提示，而不是等到请求失败后再报错。

## 每一步完成后的验证建议

每完成一项最少验证一次：

- 插件是否还能正常加载
- 控制台是否出现新报错
- 新增功能是否真的能从 UI 触发
- 异常路径是否有提示

## 当前最值得先完成的文件

建议下一阶段优先补这些文件：

- `addon/manifest` 相关文件
- `src/bootstrap/index`
- `src/sidebar/panel`
- `src/settings/store`
- `src/services/api`

具体文件名可以等你选定 Zotero 8 插件模板后再定。

## 暂时不要过早实现的能力

在最小版本跑通前，先不要投入这些方向：

- 多模板系统
- 流式输出
- PDF 全文抽取
- 本地模型适配
- 历史会话管理
- 自动写回 Zotero 条目

## 文档协作约定

后续开发过程中：

- 需求变更优先更新 `docs/requirements.md`
- 结构变化优先更新 `docs/structure.md`
- 开发方式变化优先更新本文件
- 执行进度以 `TODO.md` 为准

## 代码风格与命名约定

### 总体原则

- 优先保持简单、稳定、可读
- 一个模块只负责一类事情
- 避免过早抽象
- 命名优先表达职责，不追求缩写

### 文件命名

统一使用小写字母和连字符或语义目录，不使用随意缩写。

建议：

- 普通模块文件：`kebab-case`
- 入口文件：`index`
- 文档文件：`kebab-case`

示例：

- `src/bootstrap/index.ts`
- `src/services/api-client.ts`
- `src/services/prompt-builder.ts`
- `src/settings/config-store.ts`

### 变量与函数命名

- 变量名：`camelCase`
- 函数名：`camelCase`
- 类名：`PascalCase`
- 常量名：`UPPER_SNAKE_CASE`

示例：

- `currentText`
- `buildPrompt`
- `SidebarController`
- `DEFAULT_BASE_URL`

### 布尔值命名

布尔值优先使用可读性强的前缀：

- `is`
- `has`
- `can`
- `should`

示例：

- `isLoading`
- `hasApiKey`
- `canSend`
- `shouldTruncate`

### 事件与处理函数命名

事件处理函数统一使用动作前缀：

- `handle`
- `on`

推荐：

- `handleSendClick`
- `handleSettingsSave`
- `onItemSelectionChange`

### 服务函数命名

服务层函数尽量使用明确动词开头：

- `get`
- `load`
- `save`
- `build`
- `create`
- `send`
- `parse`

示例：

- `getCurrentContext`
- `loadSettings`
- `saveSettings`
- `buildMessages`
- `sendChatCompletion`
- `parseChatResponse`

### Zotero 相关命名

与 Zotero 直接耦合的模块或对象，命名中保留 `zotero` 语义，避免后面难以区分边界。

示例：

- `zotero-pane.ts`
- `zotero-item-context.ts`
- `registerZoteroSidebar`

### 注释约定

- 注释只解释“为什么这样做”或“这里有什么特殊约束”
- 不写逐行翻译式注释
- 如果逻辑已经靠命名表达清楚，就不额外加注释

### 错误消息约定

- 面向用户的错误消息尽量简洁明确
- 面向开发的错误日志尽量保留上下文
- 不要把底层异常原样直接展示给最终用户

建议区分：

- UI 提示：`请先填写 API Key`
- 日志记录：`saveSettings failed: missing apiKey`

### 导出约定

- 一个文件优先只暴露一个主要职责
- 公共能力用命名导出
- 避免默认导出和多种风格混用

### 风格验收标准

后续代码提交时，至少满足：

- 命名风格前后一致
- 模块职责没有明显混乱
- 配置、请求、UI 逻辑没有大面积耦合在一个文件里
