/**
 * lib/ai/client.ts —— provider 无关的 OpenAI 兼容客户端
 *
 * 为什么长这样：
 * DeepSeek（https://api.deepseek.com）与 OpenRouter（https://openrouter.ai/api/v1）
 * **都是 OpenAI 兼容的**，端点同为 `<base>/chat/completions`、请求体同形。
 * 所以「换供应商」应该只是改 3 个环境变量，**业务代码一个字都不用动**。
 *
 * ⚠️ 三条硬约定：
 *  1. 只用于**服务端**（离线生成脚本 / 未来的服务端 Agent）。
 *     任何 key 都不许加 NEXT_PUBLIC_ 前缀 —— 加了就会被打进前端 bundle。
 *  2. 模型名只认别名 `fast` / `smart`，业务代码不出现厂商名。
 *  3. **必须读回响应里的实际模型名**（`chatMeta()` 返回它）。
 *     《暂行办法》要求公示模型名称 + 备案号，一旦供应商偷偷换了模型而你还公示旧的，
 *     就是虚假公示。这也是为什么我们只在编排层换模型、不让 Agent 自己挑。
 *
 * 依赖：只用原生 fetch，不引任何 SDK。
 */

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 800;
const MAX_RETRIES = 2;

export type ModelAlias = "fast" | "smart";

export interface ChatOptions {
  /** 模型别名（不写厂商名） */
  model?: ModelAlias;
  system: string;
  prompt: string;
  /** 要求模型只输出 JSON（DeepSeek 与 OpenRouter 都支持 response_format json_object） */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  text: string;
  /** 我们请求时用的模型名 */
  requestedModel: string;
  /** 供应商实际使用的模型名 —— 公示与计费都要以它为准 */
  actualModel: string;
  /** 两者不一致时必须警觉：说明供应商做了映射/降级，公示要以 actualModel 为准 */
  modelMismatch: boolean;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    /** DeepSeek 思考模式的推理 token（思考开着时可能占掉大半配额） */
    reasoningTokens?: number;
  };
}

/**
 * 供应商风味，从 base URL 推断。
 * 为什么需要：有些参数是厂商私有的（如 DeepSeek 的 thinking），
 * 发给了不认识的供应商轻则被忽略、重则报 400。所以只在对应 flavor 下才带。
 */
function flavor(): "deepseek" | "generic" {
  return env("AI_BASE_URL").includes("deepseek") ? "deepseek" : "generic";
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function endpoint(): { base: string; key: string } {
  const base = env("AI_BASE_URL");
  const key = env("AI_API_KEY");
  if (!base || !key) {
    throw new Error(
      "缺少 AI_BASE_URL / AI_API_KEY。请在 .env.local 里配置（该文件已被 .gitignore 忽略）。",
    );
  }
  return { base: base.replace(/\/+$/, ""), key };
}

function modelName(alias: ModelAlias): string {
  const v = alias === "smart" ? env("CRUSH_SMART_MODEL") : env("CRUSH_FAST_MODEL");
  if (!v) {
    throw new Error(
      `缺少 CRUSH_${alias === "smart" ? "SMART" : "FAST"}_MODEL。请在 .env.local 里配置模型名。`,
    );
  }
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 单次请求；429 / 5xx 会退避重试，其余错误直接抛 */
async function once(body: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  const { base, key } = endpoint();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

interface ChatResponseJson {
  choices?: { message?: { content?: string; reasoning_content?: string } }[];
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = modelName(opts.model ?? "fast");

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
    stream: false,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  // ⚠️ 默认给足 token：DeepSeek v4 系列**默认开思考模式**，推理本身就要吃掉几十上百 token。
  // 实测同一句话：思考开着 144 token（其中 87 是推理）、关掉只要 27 —— 差 5 倍。
  // 批量生成几百条时这是实打实的钱，所以默认关思考、并把上限给足。
  body.max_tokens = typeof opts.maxTokens === "number" ? opts.maxTokens : DEFAULT_MAX_TOKENS;
  if (flavor() === "deepseek" && env("AI_THINKING") !== "on") {
    body.thinking = { type: "disabled" };
  }

  let lastErr = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await once(body, timeoutMs);
    // 429 / 5xx 才重试；400 类（参数错、模型名错）重试没意义，直接把报错抛出来
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(800 * (attempt + 1));
      continue;
    }
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`AI 请求失败 ${res.status}：${raw.slice(0, 300)}`);
    }
    let data: ChatResponseJson;
    try {
      data = JSON.parse(raw) as ChatResponseJson;
    } catch {
      throw new Error(`AI 返回不是合法 JSON：${raw.slice(0, 300)}`);
    }
    if (data.error?.message) throw new Error(`AI 返回错误：${data.error.message}`);
    const msg = data.choices?.[0]?.message;
    const text = (msg?.content ?? "").trim();
    if (!text) {
      // 思考模式下很容易「推理用光额度、content 为空」。这个提示要说到点子上，
      // 否则只会看到一句干巴巴的「空内容」，不知道该怎么修。
      const reasoning = (msg?.reasoning_content ?? "").trim();
      throw new Error(
        "AI 返回空内容。" +
          (reasoning
            ? "看起来 token 全被推理吃掉了（DeepSeek v4 默认开思考模式）—— 请确认 AI_THINKING 未设成 on，或调大 maxTokens。"
            : "请检查 maxTokens 是否过小，或供应商是否返回了异常结构。"),
      );
    }
    const actual = data.model ?? model;
    return {
      text,
      requestedModel: model,
      actualModel: actual,
      modelMismatch: actual !== model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
            reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens,
          }
        : undefined,
    };
  }
  throw new Error(`AI 请求重试 ${MAX_RETRIES} 次仍失败：${lastErr}`);
}

/** 要求 JSON 输出并解析；解析失败会把原文一起抛出来，便于定位 prompt 问题 */
export async function chatJson<T>(opts: ChatOptions): Promise<{ data: T } & ChatResult> {
  const r = await chat({ ...opts, jsonMode: true });
  const cleaned = r.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return { data: JSON.parse(cleaned) as T, ...r };
  } catch {
    throw new Error(`AI 返回的不是合法 JSON（模型=${r.actualModel}）：${cleaned.slice(0, 300)}`);
  }
}

/** 配置自检：不发起请求，只看 env 齐不齐 */
export function aiConfig(): { ready: boolean; base: string; fast: string; smart: string; missing: string[] } {
  const missing: string[] = [];
  for (const k of ["AI_BASE_URL", "AI_API_KEY", "CRUSH_FAST_MODEL", "CRUSH_SMART_MODEL"]) {
    if (!env(k)) missing.push(k);
  }
  return {
    ready: missing.length === 0,
    base: env("AI_BASE_URL"),
    fast: env("CRUSH_FAST_MODEL"),
    smart: env("CRUSH_SMART_MODEL"),
    missing,
  };
}
