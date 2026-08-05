# 微信内首测自动分流（2026-07-31 18:21）

## Adam 确认后的精确流程

好友收到 `/shared?p=暗流` 链接：

| 设备状态 | 行为 |
|---|---|
| **首次**（localStorage 无 personality_id） | 自动跳 `/question`（跳过对方结果页，直接进自己的测试） |
| **已测过** | 留在 `/shared?p=暗流` 看朋友结果 |
| 测完自己 → /result（自己的人格） | 后续再点同一个分享链接 → 仍看到朋友结果 |

## 实现

### `app/shared/SharedView.tsx`

1. **新增 useEffect（首测自动路由）**
   ```ts
   useEffect(() => {
     if (window.location.search.includes('skip=1')) return; // 调试用：避免回流
     const pid = localStorage.getItem('crushxiangjian_personality_id');
     if (!pid) {
       const inv = personalityName ? `?inv=${encodeInvite(personalityName)}` : '';
       router.replace(`/question${inv}`);
     }
   }, [personalityName, router]);
   ```
   - `router.replace`（不留历史栈）
   - 携带 `?inv=<encoded>` 传给 /question，让问题页可选写入"邀请人"标记
   - `?skip=1` 用于 SSR/调试（直接显示结果页不走分流）

2. **顶部 status bar 改为始终显示**（只要用户已测过）
   - 文案：「你是「暗流」/ 下面是朋友的报告」
   - 「查看我的 →」按钮 → /result
   - 取消"人格必须不一致"的限制（设备维度的判断更稳）

3. **主 CTA 死代码**：「未测过」分支现在永远不会渲染（用户被自动跳走了）。保留作为防御性编程。

## 验证

- 构建 ✅ 4.3s，0 错误
- serve.mjs 已重启
- 路由 200 冒烟：
  - `/shared?p=暗流`（首测用户）→ 200（客户端 replace 跳 /question）
  - `/shared?p=暗流&skip=1`（已测过用户）→ 200（留在结果页）
  - `/result?p=暗流` → 200

## 完整接收方流程

```
【Bob 首次】（localStorage 空）
点 /shared?p=暗流
   ↓ useEffect 检测 pid=null
   ↓ router.replace('/question?inv=暗流')
   ↓ 答完 → /result（自己的人格）
   ↓ 分享给 Adam

【Bob 再点 Adam 的链接】
点 /shared?p=暗流
   ↓ useEffect 检测 pid='X'
   ↓ 留在 /shared
   ↓ 顶部 bar「你是「X」 / 下面是朋友的报告」
   ↓ 可点主 CTA「查看我的」→ /result（自己的）
```

## 不变量

- **朋友的报告永远由 URL `?p=` 决定**——`/shared` 主体 JSX 只读 personalityName，不读 localStorage
- **自己的进度由 localStorage 决定**——点任何链接都不会清空 progress
- **唯一清 localStorage 的入口**：操作区的「重新测试」按钮（confirm 后清）
- **`?inv=<encoded>` 透传**：首测用户跳 /question 时带 inv，问卷完成后可标记邀请来源

## 文件

- `app/shared/SharedView.tsx` —— 2 处编辑：新增 useEffect（首测分流）、顶部 bar 改为始终显示