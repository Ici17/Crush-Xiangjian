"use client";

/**
 * 后台「内容配置」面板（L1 展示文案）
 *
 * 只列出已经接进前端的 key —— 配了但没接线等于零效果，不如不显示。
 * 写入走 /api/admin/content（复用后台 HMAC cookie 鉴权），即时生效、不用发版。
 */

import { useCallback, useEffect, useState } from "react";

const INK = "#2C1810";
const GOLD = "#A8884E";
const SOFT = "rgba(168,136,78,0.28)";

type Entry = {
  key: string;
  scope: "copy" | "config";
  value: unknown;
  version: number;
  published: boolean;
  note?: string | null;
  updated_at?: string;
};

const FIELDS = [
  { key: "copy.home.hero_subtitle", label: "首页主视觉副标题", hint: "两句话，衬线体下方；不要写功效或命理承诺" },
  { key: "copy.home.cost_line", label: "首页主 CTA 下方成本说明", hint: "例如「N 分钟 · N 种灵魂人格 · 免费」，数字请按当前题库填" },
  { key: "copy.footer.disclaimer", label: "页脚娱乐性免责声明", hint: "合规底线，别删空" },
] as const;

export default function ContentConfigPanel() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [storeReady, setStoreReady] = useState(false);
  const [tableReady, setTableReady] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/content", { cache: "no-store" });
      const d = (await res.json()) as {
        ok: boolean; storeReady?: boolean; tableReady?: boolean; copy?: Record<string, Entry>;
      };
      if (d.ok) {
        setEntries(d.copy ?? {});
        setStoreReady(!!d.storeReady);
        setTableReady(!!d.tableReady);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (key: string, value: string, version: number, published: boolean) => {
    setSaving(key);
    setMsg("");
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, scope: "copy", value, version, published }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string };
      setMsg(d.ok ? `已保存 ${key}${published ? "（已发布，最多 60 秒后生效）" : "（草稿）"}` : (d.error ?? "保存失败"));
      if (d.ok) void load();
    } catch {
      setMsg("保存失败：网络异常");
    } finally {
      setSaving("");
    }
  };

  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: SOFT, background: "#fff" }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm" style={{ fontFamily: "Noto Serif SC, serif", color: INK }}>内容配置 · 展示文案</h2>
        <span style={{ fontSize: 11, color: tableReady ? "#3B6D11" : "#A08D72" }}>
          {!storeReady
            ? "未配置 Supabase 凭据，写入不生效"
            : tableReady
              ? "存储已连接"
              : "凭据已配置，但 cx_content_config 表尚未创建"}
        </span>
      </div>
      <p className="mt-2 mb-5" style={{ fontSize: 11, color: "#A08D72", lineHeight: 1.7 }}>
        这里只放不进推荐算法的展示文案，改完即时生效、不用发版；未填写的字段自动用代码里的原文。
      </p>

      <div className="space-y-5">
        {FIELDS.map((f) => {
          const e = entries[f.key];
          return (
            <FieldEditor
              key={f.key}
              field={f}
              entry={e}
              saving={saving === f.key}
              onSave={save}
            />
          );
        })}
      </div>

      {msg && (
        <p className="mt-4 mb-0" style={{ fontSize: 11, color: GOLD }} role="status">{msg}</p>
      )}
    </section>
  );
}

function FieldEditor({
  field, entry, saving, onSave,
}: {
  field: { key: string; label: string; hint: string };
  entry?: Entry;
  saving: boolean;
  onSave: (key: string, value: string, version: number, published: boolean) => void;
}) {
  const [value, setValue] = useState(typeof entry?.value === "string" ? entry.value : "");
  const [version, setVersion] = useState(entry?.version ?? 1);
  const [published, setPublished] = useState(entry?.published ?? false);

  useEffect(() => {
    setValue(typeof entry?.value === "string" ? entry.value : "");
    setVersion(entry?.version ?? 1);
    setPublished(entry?.published ?? false);
  }, [entry?.value, entry?.version, entry?.published]);

  return (
    <div className="rounded-xl p-4" style={{ border: `0.5px solid ${SOFT}` }}>
      <div className="flex items-baseline justify-between gap-2">
        <span style={{ fontSize: 12, color: INK }}>{field.label}</span>
        <code style={{ fontSize: 10, color: "#A08D72" }}>{field.key}</code>
      </div>
      <p className="mt-1 mb-2" style={{ fontSize: 10.5, color: "#A08D72" }}>{field.hint}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="留空 = 用代码里的原文"
        className="w-full rounded-lg px-3 py-2"
        style={{ border: `0.5px solid ${SOFT}`, fontSize: 12, color: INK, background: "#FFFCF7", resize: "vertical" }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5" style={{ fontSize: 11, color: "#8A7355" }}>
          版本
          <input
            type="number"
            min={1}
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
            className="w-14 rounded px-2 py-1"
            style={{ border: `0.5px solid ${SOFT}`, background: "#FFFCF7", color: INK }}
          />
        </label>
        <label className="flex items-center gap-1.5" style={{ fontSize: 11, color: "#8A7355" }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          发布（勾选后线上生效）
        </label>
        <button
          onClick={() => onSave(field.key, value, version, published)}
          disabled={saving}
          className="rounded-full px-4 py-1.5"
          style={{ background: INK, color: "#FAF3EA", fontSize: 11, cursor: saving ? "wait" : "pointer" }}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
