# serve.mjs 重启与依赖修复（2026-07-31 17:38）

## 现象

Adam 反馈「预览链接打不开」。

冒烟：`Get-NetTCPConnection -LocalPort 3456 -State Listen` → DEAD  
进程列表里没有 serve.mjs 的 node 进程。

## 根因

Waffo 集成时引入的 `http-proxy-agent` 引用没装入 package.json。serve.mjs 启动时直接 `ERR_MODULE_NOT_FOUND` 退出。重启时同样的报错。

实际上 `proxyRequest()` 完全不需要 agent（loopback 请求），移除 import 即可。

## 修复

**`serve.mjs`**：
1. `import { createProxyAgent } from 'http-proxy-agent'` → 改用 Node 内置
2. `import { createServer } from 'node:http'` → 增加 `request as httpRequest`
3. `async function proxyRequest` 内 `const http = await import('node:http')` → 直接用顶层 import 的 `httpRequest`

未新增依赖，package.json 不动。

## 验证

冒烟 6 个路由 localhost + LAN IP 双路径全 200：

| 路由 | localhost | 192.168.10.15 |
|---|---|---|
| / | 200 30769B | 200 30769B |
| /question | 200 15679B | 200 15679B |
| /result?p=暗流 | 200 12931B | 200 12931B |
| /preview | 200 11527B | 200 11527B |
| /friend?inv=暗流 | 200 11820B | 200 11820B |
| /shared?p=暗流 | 200 11820B | 200 11820B |

## 已知遗留

- API 反向代理依赖 `next start` 进程在 :3457，目前未启动，支付链路暂不可用；静态 6 路由全可用
- 移动端实际访问请保持手机与 `192.168.10.x` 同一网段
