# Zotero-SideAI

一个面向 Zotero 8 的侧边栏 AI 插件实验原型。

## 维护状态

本项目已停止维护。

当前仓库保留为实验原型与实现参考，不再继续开发、发布或扩展功能，也不再以产品化为目标推进。它证明了 Zotero 8 侧边栏聊天插件这条路线是可行的，但在本项目当时采用的后端条件下，无法达到 GPT 网页“上传 PDF 后直接问答”的体验。

## 当前状态

当前仓库已经完成一版可运行的原型验证，主要能力包括：

- Zotero 8 插件可加载
- 侧边栏聊天面板可显示
- 连接设置可保存和恢复
- 条目元数据与 PDF 选区可采集、预览并发送
- AI 返回结果可展示、复制、重试、清空和回看历史
- 支持提示词预设、请求预览、基础 Markdown 渲染和聊天式界面

当前不再将这些能力继续推进为完整产品，只保留为原型和代码参考。

## 为什么停止维护

停止维护的核心原因，不是 Zotero 侧边栏本身做不出来，而是本项目当时采用的技术条件决定了它很难达到 GPT 网页上传 PDF 后问答的完整体验。

本项目当时的约束包括：

- 当前采用的后端只提供普通 OpenAI 兼容 `chat/completions` 文本接口
- 不提供 `embeddings` 接口
- 不支持文件上传
- 不支持服务端文件持有
- 不支持服务端解析和索引
- 不支持围绕单个已上传文件持续进行文件级会话

在这种前提下，插件端最多只能做：

- 本地读取 PDF 或元数据
- 本地切分和检索相关片段
- 每次提问时把片段重新拼进 prompt

这类方案可以做出“接近”的论文问答体验，但在上述前提下，不能等价于 GPT 网页上传 PDF 后的文件级问答体验。因此，这里的上限更适合作为实验原型，而不是继续投入为完整产品。

## 安装说明

当前仓库仍可用于本地运行、阅读和参考，推荐按下面步骤启动：

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

## 接口约定

当前仓库内的请求链路仍采用 OpenAI Chat Completions 兼容接口。

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

## 开发调试说明

当前仓库常用命令仍然可用：

```powershell
npm run start
npm run build
npm test
npm run lint:check
npm run lint:fix
```

其中：

- `npm run start` 用于开发态启动
- `npm run build` 用于构建和类型检查
- `npm test` 用于运行现有测试

这些命令现在更适合作为原型验证和代码参考用途，而不是继续推进正式发布。

## 文档索引

仓库内当前主要文档：

- [README.md](README.md)：项目总览与停止维护说明
- [docs/requirements.md](docs/requirements.md)：需求边界与关键决策
- [docs/structure.md](docs/structure.md)：目录结构说明
- [docs/development.md](docs/development.md)：开发方式、测试命令与验证记录
- [docs/release.md](docs/release.md)：历史 release 说明与构建产物信息

## 仓库说明

当前仓库已停止维护。
