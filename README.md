# Zotero-SideAI

一个面向 Zotero 8 的侧边栏 AI 插件项目。

当前目标是做出一个最小可用版本，支持在 Zotero 侧边栏中读取当前文献文本，拼接固定提示词，并通过自定义 `baseURL` 调用 OpenAI 兼容接口获取结果。

## 当前状态

当前仓库已经完成 MVP 主闭环：

- Zotero 8 插件可加载
- 侧边栏面板可显示
- 设置可保存和恢复
- 当前文本可采集、预览并发送
- AI 返回结果可展示、复制、重试、清空和回看历史

当前仍处于开发中，重点已经从“功能打通”进入“稳定性验证 + 发布准备”阶段。

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
- 支持在 Zotero 侧边栏展示 AI 返回结果

## MVP 约束

当前已经确定的第一版约束如下：

- 当前文本范围：标题 + 摘要 + 全部 note 文本
- 接口协议：OpenAI Chat Completions 兼容格式
- 固定提示词策略：全局单模板
- 交互方式：手动点击发送
- 结果展示：纯文本优先，不做完整 Markdown 渲染

详细决策见：

- [docs/requirements.md](docs/requirements.md)

## 当前已实现能力

目前已经落地的能力包括：

- Zotero 8 Item Pane 侧边栏集成
- API Key、`baseURL`、模型名、固定提示词的本地保存与恢复默认值
- 标题、摘要、全部 note 的统一上下文采集
- 发送前最终请求预览
- OpenAI Chat Completions 兼容请求
- 成功结果、错误结果、复制、重试、清空
- Markdown 基础渲染、代码块轻量高亮、最近会话历史
- 超长上下文截断、超时处理、错误 `baseURL` / 错误 API Key / 快速重复发送等稳定性验证

当前不在第一版范围内的能力：

- 多轮会话
- 流式输出
- Responses API
- PDF 全文抽取
- OCR
- 自动写回 Zotero 条目

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

注意：

- 在插件里填写 `baseURL` 时，应填写到 `/v1` 这一层
- 不要把 `/chat/completions` 再手动填进去

例如：

- 正确：`http://127.0.0.1:8000/v1`
- 错误：`http://127.0.0.1:8000/v1/chat/completions`

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

## 文档索引

仓库内当前主要文档：

- [README.md](README.md)：项目总览
- [TODO.md](TODO.md)：按阶段推进的任务清单
- [docs/requirements.md](docs/requirements.md)：需求边界与关键决策
- [docs/structure.md](docs/structure.md)：目录结构说明
- [docs/development.md](docs/development.md)：开发方式、测试命令与验证记录

## 安装说明

当前仓库更适合开发态安装和本地调试，推荐按下面步骤启动：

1. 准备环境

- 安装 Node.js
- 安装 Zotero 8
- 确认本机可以直接启动 Zotero 可执行文件

2. 获取代码并安装依赖

```powershell
git clone https://github.com/dyingjie/Zotero-SideAI.git
cd Zotero-SideAI
npm install
```

3. 指定本机 Zotero 路径

Windows 示例：

```powershell
$env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH='C:\Program Files\Zotero\zotero.exe'
```

4. 开发态加载插件

```powershell
npm run start
```

开发态下，脚手架会自动构建并把插件以 temporary add-on 的方式安装到 Zotero 8。

5. 验证插件是否加载成功

- 打开 Zotero 8
- 选中一个文献条目
- 在右侧 Item Pane 中确认是否出现 `SideAI` section

如果你只想验证当前构建和测试链路，也可以直接运行：

```powershell
npm test
```

如果你需要先生成构建产物，再自行检查打包结果，可以运行：

```powershell
npm run build
```

## 配置说明

当前侧边栏配置区主要包含 4 个核心字段：

### `API Key`

- 用于请求你的 OpenAI 兼容服务
- 不会写死在仓库代码中
- 由插件保存在本地 Zotero 配置里
- 为空时会阻止发送

### `Base URL`

- 用于指定兼容接口的服务根地址
- 当前默认值是 `https://api.openai.com/v1`
- 插件会自动在后面拼接 `/chat/completions`
- 因此这里应填写到 `/v1` 为止，而不是完整接口路径

例如：

- 可填写：`https://api.openai.com/v1`
- 可填写：`http://10.8.133.161:8317/v1`
- 不要填写：`http://10.8.133.161:8317/v1/chat/completions`

### `Model`

- 用于指定发送时透传给服务端的模型名
- 当前默认值是 `gpt-4.1-mini`
- 这里不会做供应商绑定校验，插件会按你填写的值原样发送

### `Fixed Prompt`

- 会作为 `system` 消息参与请求
- 当前默认值是一段英文的学术阅读助手提示词
- 支持基础变量替换，例如：
  - `{{title}}`
  - `{{abstractText}}`
  - `{{notesText}}`
  - `{{currentText}}`

当前固定提示词的默认值为：

```text
You are an academic reading assistant. Summarize the selected paper content clearly and faithfully.
```

### 保存与恢复默认值

- 点击 `Save Settings` 会把当前配置保存到本地
- 点击 `Restore Defaults` 会恢复默认 `baseURL`、默认模型名和默认固定提示词
- 如果 `API Key` 为空，发送时会直接提示而不会发请求

## 已知限制

当前版本仍有以下已知限制：

- 当前仅面向 Zotero 8，未承诺兼容更早版本
- 当前接口只支持 OpenAI Chat Completions 兼容格式，不支持 Responses API
- 当前只支持手动点击发送，不支持自动发送
- 当前不支持流式输出，结果会在请求结束后一次性显示
- 当前文本范围只包含标题、摘要和全部 note，不包含 PDF 全文、选区文本、OCR 或附件全文抽取
- 当前只提供全局单模板固定提示词，不支持多模板切换
- 当前历史记录只保留在当前侧边栏会话中，不做跨重启持久化
- 当前上下文过长时会直接截断，不做分块发送或更复杂的长度调度
- 当前代码块高亮是轻量实现，不等同于完整 Markdown 渲染器或专业高亮库
- 当前主要在 Windows + Zotero 8 环境完成验证，macOS 和不同窗口尺寸还需要继续补测
- 当前不会自动把结果写回 Zotero 条目、笔记或附件

## 开发调试说明

当前仓库常用的开发命令如下：

```powershell
npm run start
npm run build
npm test
npm run lint:check
npm run lint:fix
```

### `npm run start`

- 用于开发态启动和热重载
- 会调用 `zotero-plugin serve`
- 会自动构建并把插件安装为 Zotero temporary add-on

推荐先设置：

```powershell
$env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH='C:\Program Files\Zotero\zotero.exe'
```

开发态下通常可以关注这些信号：

- `Server Ready!`
- `.scaffold/build/addon` 被安装为 temporary add-on
- 文件变更后出现 `changed`
- 随后出现 `Reloading...`

### `npm run build`

- 用于生成当前构建产物
- 会先执行 `zotero-plugin build`
- 然后执行 `tsc --noEmit` 做 TypeScript 类型检查

适合在提交前快速确认：

- 构建是否成功
- 类型是否有回归

### `npm test`

- 用于在 Zotero 8 测试环境中运行当前测试集
- 会构建插件、启动测试资源并执行现有测试
- 当前是最推荐的主流程回归入口

### `npm run lint:check` / `npm run lint:fix`

- 基于 Prettier 检查或修复格式
- 适合在整理文档和调整 UI 文本后快速统一风格

### 调试建议

- 如果插件没有显示，先确认 `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` 是否指向本机真实 Zotero 8 路径
- 如果请求失败，先检查侧边栏里的 `Base URL` 是否只填到 `/v1`
- 如果看不到结果，先确认当前条目是否真的有标题、摘要或 note 可发送
- 如果怀疑改动没有生效，优先重新执行 `npm run start` 或 `npm test`

更详细的开发约定、主流程验证记录和风格约定见：

- [docs/development.md](docs/development.md)

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

目前已经包含最小插件骨架文件：

- `package.json`
- `tsconfig.json`
- `zotero-plugin.config.ts`
- `addon/bootstrap.js`
- `addon/manifest.json`
- `src/index.ts`
- `src/addon.ts`
- `src/hooks.ts`

当前还包含一个可用的 Zotero Item Pane 面板，已经具备以下状态：

- 启动后会在 Zotero 条目侧边栏注册 `SideAI` section
- 当前已经包含配置区、上下文区、输出区、历史区、操作区
- 当前已经具备 `empty`、`ready`、`loading`、`error` 的基础状态
- 当前 `Copy` 按钮已经接入，可复制输出区文本
- 当前已处理窄侧边栏下的按钮换行、长文本滚动和区块宽度收缩
- 当前模型配置区域已包含 `baseURL`、`model`、`API Key` 表单
- 当前固定提示词编辑区已包含在配置卡片中
- 当前配置区已支持保存 `API Key`、`baseURL`、模型名和固定提示词
- 当前插件启动后会自动加载已保存配置，并支持恢复默认值
- 当前面板已能跟随 Zotero 当前选中条目刷新，并处理未选中条目的空状态
- 当前文本采集已能提取标题、摘要和全部 note 内容
- 当前文本采集内部已整理为统一上下文对象，便于 Prompt 组装和请求发送
- 当前文本预览区域已显示将要发送的标题、摘要和 notes 预览内容
- 当前侧边栏已在发送前显示最终请求预览，便于开发期调试 `system/user` 消息
- 当前服务层已封装统一的 Chat Completions POST 请求入口
- 当前请求服务已支持自定义 `baseURL`、自定义模型名、超时控制、错误处理和 OpenAI 兼容响应解析
- 当前 `Send` 按钮已接入真实请求链路，成功时会在 Output 区显示模型返回结果
- 当前结果区域已区分正常结果与错误状态，并同步更新状态标记
- 当前成功响应已支持基础 Markdown 渲染，包含段落和 fenced code block
- 当前代码块已支持轻量高亮，并显示语言标签
- 当前侧边栏已记录最近几次会话结果，可点击回看历史输出
- 当前 `Copy` 按钮可复制结果区文本，并在无内容时给出提示
- 当前在请求失败后仍可直接点击 `Send` 重试
- 当前 `Clear` 按钮可清空当前会话输出，不影响配置和上下文预览
- 当前发送逻辑已在 `loading` 状态下拒绝重复请求，避免快速连点重复发送

## 开发验证

当前推荐的开发验证入口：

```powershell
$env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH='C:\Program Files\Zotero\zotero.exe'
npm test
```

当前这条命令已覆盖：

- Zotero 8 测试环境启动与插件加载
- 设置持久化
- Prompt 组装
- 请求服务与错误处理
- 输出渲染与历史记录
- 空文本、异常文本、长文本截断、错误 `baseURL`、错误 API Key、网络超时、快速重复发送等稳定性边界测试

更详细的开发约定和验证记录见：

- [docs/development.md](docs/development.md)

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

- 补充安装说明
- 补充配置说明
- 补充已知限制
- 补充开发调试说明
- 准备首个 release
