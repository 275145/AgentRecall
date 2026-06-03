# 设计:在设置中可隐藏 Codex / Claude Code 剩余额度

日期:2026-06-03
分支:`feat/hide-quota`

## 背景与动机

"剩余额度"面板默认同时展示 Codex 和 Claude Code 两张卡。但有的用户只订阅了其中一个,另一个根本没用——空卡 / 报错卡是噪音,Codex 那张还会白跑一次 HTTP 请求。需要在设置里能分别隐藏其中任意一个,默认两个都展示。

## 目标

- 设置中提供两个开关,分别隐藏 Codex / Claude Code 额度。
- 被隐藏的额度**不加载**(Codex 不发 HTTP、Claude 不读本地文件),也**不在面板渲染**。
- 默认两者都显示(开关默认关)。
- 切换开关后额度面板立即反映。

## 非目标

- 不做"自动检测有没有订阅"。是否隐藏完全由用户决定。
- 不改变额度数据的解析逻辑。

## 方案

数据源头过滤:被隐藏的额度从一开始就不加载、不进 `providers` 数组。(备选"只在 renderer 过滤渲染"会白跑一次加载,排除。)

## 改动详情

### 1. `AppSettings`(`src/core/platform.ts`)

新增两个布尔,默认 `false`:

```ts
hideCodexQuota: boolean;   // 默认 false(显示)
hideClaudeQuota: boolean;  // 默认 false(显示)
```

`defaultSettings` 同步补上 `hideCodexQuota: false` / `hideClaudeQuota: false`。

### 2. `loadUsageQuotaSnapshot`(`src/core/quota.ts`)

`UsageQuotaLoadOptions` 增加可选 `hideCodexQuota?: boolean` / `hideClaudeQuota?: boolean`。

加载逻辑:被隐藏的跳过对应 `loadCodexQuotaCard` / `loadClaudeQuotaCard` 调用;`providers` 只放未隐藏的卡,保持原顺序(codex 在前、claude 在后)。两个都隐藏时 `providers` 为空数组。

### 3. main 进程(`src/main/index.ts`)

`quota:get` 把设置传入:

```ts
ipcMain.handle("quota:get", () => loadUsageQuotaSnapshot({
  hideCodexQuota: getSettings().hideCodexQuota,
  hideClaudeQuota: getSettings().hideClaudeQuota,
}));
```

### 4. 设置 UI(`src/renderer/src/App.tsx`)

在设置面板的额度/用量区,沿用现有 `settings-toggle` 复选框样式,加两个:

- 「在剩余额度中隐藏 Codex」/ "Hide Codex usage"
- 「在剩余额度中隐藏 Claude Code」/ "Hide Claude Code usage"

`onChange` 调 `updateSettings({ hideCodexQuota: ... })`。`updateSettings` 检测到这两个键发生变化时,额外调用一次 `loadQuotas()`,让被隐藏的卡立即消失 / 重新出现。

## 边界情况

- **两个都隐藏**:`providers` 为空 → 复用面板已有空态文案("额度不可用")。可接受。

## 测试

`src/core/quota.test.ts` 新增:

- `hideCodexQuota: true` → `providers` 不含 codex 卡,且传入的 `codexFetcher` 不被调用(证明确实跳过加载)。
- `hideClaudeQuota: true` → `providers` 不含 claude-code 卡。
- 都不隐藏(默认)→ 两张卡都在,顺序 codex、claude。
