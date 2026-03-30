# Project Structure

## 目录约定

当前项目采用以下目录结构：

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

## 目录职责

`addon/`

- 放置 Zotero 插件打包相关文件
- 后续可放 `manifest`、构建输出映射、资源文件

`docs/`

- 放置需求说明、结构说明、开发文档

`src/bootstrap/`

- 放置插件入口、生命周期注册、初始化代码

`src/sidebar/`

- 放置 Zotero 侧边栏 UI、视图逻辑、交互处理

`src/services/`

- 放置 AI 请求、上下文读取、prompt 组装等服务层逻辑

`src/settings/`

- 放置配置读取、保存、默认值和校验逻辑

`src/utils/`

- 放置通用工具函数和共享辅助方法

## 当前原则

- 先把目录边界定清楚，再逐步填充实现
- UI、配置、请求逻辑尽量分层，不混写在一个文件里
- Zotero 生命周期代码尽量集中在 `bootstrap`
- 与 AI 请求直接相关的逻辑优先收敛到 `services`

## 后续演进

后续如果项目复杂度增加，可以再细分：

- `src/services/api/`
- `src/services/context/`
- `src/services/prompt/`
- `src/sidebar/components/`
- `src/sidebar/state/`

第一版暂时不提前拆得过细，以免目录复杂度超过实际代码规模。
