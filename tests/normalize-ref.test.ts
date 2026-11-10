/**
 * normalizeRef 纯函数单测。
 *
 * 第一次分发前补的归因 A：微信里打开分享链接时 document.referrer 常为空，
 * 只看 referrer 会把分享来客全记成「直接访问」，分发效果无法评估。
 * 这条测试锁住「分享参数/路径优先于 referrer」的优先级，防止以后被改回去。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRef } from "../lib/analytics/events";

test("分享参数优先于空 referrer（微信内打开分享链接）", () => {
  assert.equal(normalizeRef("", "/", "?src=wx"), "好友分享");
  assert.equal(normalizeRef("", "/friend", "?inv=abc123"), "好友分享");
  assert.equal(normalizeRef("", "/shared", "?p=eyJpZCI6"), "好友分享");
  // 即使 referrer 是别的渠道，带分享参数仍算分享
  assert.equal(normalizeRef("https://baidu.com", "/", "?src=wx"), "好友分享");
});

test("/friend 与 /shared 路径本身即分享入口", () => {
  assert.equal(normalizeRef("", "/friend", ""), "好友分享");
  assert.equal(normalizeRef("", "/shared", ""), "好友分享");
});

test("无 referrer 时区分直接访问与内部直达", () => {
  assert.equal(normalizeRef("", "/", ""), "直接访问");
  assert.equal(normalizeRef(undefined, "/", ""), "直接访问");
  assert.equal(normalizeRef("", "/result", ""), "内部直达");
  assert.equal(normalizeRef("", "/discover", ""), "内部直达");
});

test("常见外部渠道按域名归类", () => {
  const cases: Array<[string, string]> = [
    ["https://mp.weixin.qq.com/s/abc", "微信"],
    ["https://www.xiaohongshu.com/explore/1", "小红书"],
    ["https://v.douyin.com/abc", "抖音"],
    ["https://weibo.com/u/1", "微博"],
    ["https://www.baidu.com/s?wd=x", "百度"],
    ["https://www.google.com/", "Google"],
    ["https://www.zhihu.com/question/1", "知乎"],
    ["https://www.bilibili.com/video/1", "B 站"],
  ];
  for (const [ref, expected] of cases) {
    assert.equal(normalizeRef(ref, "/", ""), expected, ref);
  }
});

test("站内跳转与未知来源", () => {
  assert.equal(normalizeRef("https://crushxiangjian.com/discover", "/result", ""), "站内");
  assert.equal(normalizeRef("https://www.example.org/page", "/", ""), "example.org");
  assert.equal(normalizeRef("not-a-url", "/", ""), "其他");
});

test("search 字符串异常时不能抛错，退回 referrer 逻辑", () => {
  // URLSearchParams 对畸形字符串通常容错；这里确认不会破坏 referrer 分支
  assert.equal(normalizeRef("https://www.google.com/", "/", "%%%"), "Google");
});
