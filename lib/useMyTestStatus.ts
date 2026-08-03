'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from './personalities';

const BRANCH_PROGRESS_KEY = 'crushxiangjian_branch_progress';

export interface MyTestStatus {
  /** 已完成测试（有人格结果） */
  completed: boolean;
  /** 已完成测试的人格名 */
  personalityName: string | null;
  /** 有未完成的测试进度（半路关闭过） */
  inProgress: boolean;
  /** 当前做到第几题 / 总共几题（inProgress 时才有值） */
  answeredCount: number;
  /** 一共多少题（branch 阶段 7 + calibration 3 = 10） */
  totalCount: number;
}

/**
 * 检测当前用户（同一浏览器 localStorage）的测试状态
 *
 * 三个 key 一起看：
 * - PERSONALITY_ID：有 → 已完成
 * - BRANCH_PROGRESS：有 currentQuestionId → 进行中
 * - 都没有 → 未开始
 *
 * 用于 /shared 页面：
 * - 已完成 → 顶部显示「你是 X」+ 「重新测试」入口
 * - 进行中 → 主 CTA 改文案「继续测试（已答 X/10）」
 * - 未开始 → 主 CTA「我也来测测」
 */
export function useMyTestStatus(): MyTestStatus {
  const [status, setStatus] = useState<MyTestStatus>({
    completed: false,
    personalityName: null,
    inProgress: false,
    answeredCount: 0,
    totalCount: 10,
  });

  useEffect(() => {
    const read = () => {
      try {
        const pid = localStorage.getItem(STORAGE_KEYS.PERSONALITY_ID);
        const progRaw = localStorage.getItem(BRANCH_PROGRESS_KEY);
        let inProgress = false;
        let answeredCount = 0;
        if (progRaw) {
          const parsed = JSON.parse(progRaw) as {
            choices?: string[];
            calibrationChoices?: string[];
          };
          const c = parsed.choices?.length ?? 0;
          const cal = parsed.calibrationChoices?.length ?? 0;
          answeredCount = c + cal;
          inProgress = answeredCount > 0 && !pid;
        }
        setStatus({
          completed: !!pid,
          personalityName: pid,
          inProgress,
          answeredCount,
          totalCount: 10,
        });
      } catch {
        // ignore
      }
    };

    read();
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('focus', read);
    };
  }, []);

  return status;
}

/**
 * 清空所有测试进度（用于「重新测试」按钮）
 * 不清：paidLevel、inviteStatus、qr cache 等付费/邀请信息
 */
export function clearMyTestProgress(): void {
  localStorage.removeItem(BRANCH_PROGRESS_KEY);
  localStorage.removeItem(STORAGE_KEYS.PERSONALITY_ID);
  localStorage.removeItem(STORAGE_KEYS.RADAR_SCORES);
  localStorage.removeItem(STORAGE_KEYS.PATH_LABELS);
  localStorage.removeItem(STORAGE_KEYS.CALIBRATION_CHOICES);
  localStorage.removeItem('crushxiangjian_path_choices');
}