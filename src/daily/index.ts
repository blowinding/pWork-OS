/**
 * Daily Log Module
 * Daily Log 的创建、编辑、查询、关联项目/GitHub
 */

import { format, parseISO, isValid } from 'date-fns';
import type {
  DailyLog,
  DailyMeta,
  DailyQuery,
  CreateDailyInput,
} from '../core/schema.js';
import {
  getDailyFilePath,
  listDailyFiles,
  findDailyFilesByDateRange,
  exists,
  readFile,
  writeFile,
  deleteFile,
} from '../core/fs.js';
import { parseDaily, serializeDaily } from '../core/parser.js';
import {
  renderDailyTemplate,
  generateDateVariables,
} from '../template/engine.js';

// ============================================
// Date Utilities
// ============================================

/**
 * 格式化日期为 YYYY-MM-DD
 * @param date 日期对象或字符串
 * @returns 格式化的日期字符串
 */
export function formatDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return format(d, 'yyyy-MM-dd');
}

/**
 * 验证日期字符串格式
 * @param dateStr 日期字符串
 * @returns 是否有效
 */
export function isValidDateString(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  const d = parseISO(dateStr);
  return isValid(d);
}

/**
 * Get current date string (YYYY-MM-DD)
 * @returns Current date string
 */
export function getCurrentDate(): string {
  return formatDate(new Date());
}

/**
 * Get current week string (YYYY-Www)
 * @returns Current week string
 */
export function getCurrentWeek(): string {
  const now = new Date();
  const year = format(now, 'yyyy');
  const week = format(now, 'II');
  return `${year}-W${week}`;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 创建新的 Daily Log
 * @param workspacePath workspace 路径
 * @param input 创建参数
 * @returns 创建的 DailyLog 对象
 */
export async function createDaily(
  workspacePath: string,
  input: CreateDailyInput = {}
): Promise<DailyLog> {
  const date = input.date ? formatDate(input.date) : formatDate();
  const filePath = getDailyFilePath(workspacePath, date);

  // 检查是否已存在
  if (await exists(filePath)) {
    throw new Error(`Daily log already exists for ${date}`);
  }

  // 使用模板渲染初始内容
  const content = await renderDailyTemplate(workspacePath, date);

  // 解析渲染后的内容
  const daily = parseDaily(content, filePath);

  // 应用额外的输入参数
  if (input.projects && input.projects.length > 0) {
    daily.meta.projects = input.projects;
  }
  if (input.tags && input.tags.length > 0) {
    daily.meta.tags = input.tags;
  }

  // 写入文件
  await writeFile(filePath, serializeDaily(daily));

  return daily;
}

/**
 * 获取指定日期的 Daily Log
 * @param workspacePath workspace 路径
 * @param date 日期
 * @returns DailyLog 对象，如果不存在则返回 null
 */
export async function getDaily(
  workspacePath: string,
  date: string
): Promise<DailyLog | null> {
  const dateStr = formatDate(date);
  const filePath = getDailyFilePath(workspacePath, dateStr);

  if (!(await exists(filePath))) {
    return null;
  }

  const content = await readFile(filePath);
  return parseDaily(content, filePath);
}

/**
 * 获取今天的 Daily Log
 * @param workspacePath workspace 路径
 * @returns DailyLog 对象，如果不存在则返回 null
 */
export async function getTodayDaily(
  workspacePath: string
): Promise<DailyLog | null> {
  return getDaily(workspacePath, formatDate());
}

/**
 * 获取或创建今天的 Daily Log
 * @param workspacePath workspace 路径
 * @param input 创建参数（仅在创建时使用）
 * @returns DailyLog 对象
 */
export async function getOrCreateTodayDaily(
  workspacePath: string,
  input: CreateDailyInput = {}
): Promise<DailyLog> {
  const today = formatDate();
  const existing = await getDaily(workspacePath, today);

  if (existing) {
    return existing;
  }

  return createDaily(workspacePath, { ...input, date: today });
}

/**
 * 更新 Daily Log
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param updates 更新内容
 * @returns 更新后的 DailyLog
 */
export async function updateDaily(
  workspacePath: string,
  date: string,
  updates: Partial<{ meta: Partial<DailyMeta>; content: string }>
): Promise<DailyLog> {
  const dateStr = formatDate(date);
  const daily = await getDaily(workspacePath, dateStr);

  if (!daily) {
    throw new Error(`Daily log not found for ${dateStr}`);
  }

  // 应用更新
  if (updates.meta) {
    daily.meta = { ...daily.meta, ...updates.meta };
  }
  if (updates.content !== undefined) {
    daily.content = updates.content;
  }

  // 写入文件
  await writeFile(daily.filePath, serializeDaily(daily));

  return daily;
}

/**
 * 删除 Daily Log
 * @param workspacePath workspace 路径
 * @param date 日期
 */
export async function deleteDaily(
  workspacePath: string,
  date: string
): Promise<void> {
  const dateStr = formatDate(date);
  const filePath = getDailyFilePath(workspacePath, dateStr);

  if (!(await exists(filePath))) {
    throw new Error(`Daily log not found for ${dateStr}`);
  }

  await deleteFile(filePath);
}

// ============================================
// Query Operations
// ============================================

/**
 * 列出所有 Daily Log
 * @param workspacePath workspace 路径
 * @returns DailyLog 列表（按日期降序）
 */
export async function listDailies(workspacePath: string): Promise<DailyLog[]> {
  const files = await listDailyFiles(workspacePath);
  const dailies: DailyLog[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file.path);
      dailies.push(parseDaily(content, file.path));
    } catch (error) {
      // 跳过解析失败的文件
      console.warn(`Failed to parse daily log: ${file.path}`, error);
    }
  }

  return dailies;
}

/**
 * 按条件查询 Daily Log
 * @param workspacePath workspace 路径
 * @param query 查询条件
 * @returns 符合条件的 DailyLog 列表
 */
export async function queryDailies(
  workspacePath: string,
  query: DailyQuery
): Promise<DailyLog[]> {
  let dailies: DailyLog[];

  // 如果有日期范围，使用优化的查询
  if (query.startDate || query.endDate) {
    const start = query.startDate || '1970-01-01';
    const end = query.endDate || '9999-12-31';
    const files = await findDailyFilesByDateRange(workspacePath, start, end);

    dailies = [];
    for (const filePath of files) {
      try {
        const content = await readFile(filePath);
        dailies.push(parseDaily(content, filePath));
      } catch {
        // 跳过解析失败的文件
      }
    }
  } else {
    dailies = await listDailies(workspacePath);
  }

  // 应用其他过滤条件
  return dailies.filter((daily) => {
    // 项目过滤
    if (query.project && !daily.meta.projects.includes(query.project)) {
      return false;
    }

    // 标签过滤
    if (query.tag && !daily.meta.tags.includes(query.tag)) {
      return false;
    }

    // 只查询周报重点
    if (query.highlightOnly && !daily.meta.weekly_highlight) {
      return false;
    }

    return true;
  });
}

/**
 * 获取最近 N 天的 Daily Log
 * @param workspacePath workspace 路径
 * @param days 天数
 * @returns DailyLog 列表
 */
export async function getRecentDailies(
  workspacePath: string,
  days: number = 7
): Promise<DailyLog[]> {
  const dailies = await listDailies(workspacePath);
  return dailies.slice(0, days);
}

/**
 * 按周获取 Daily Log
 * @param workspacePath workspace 路径
 * @param week 周标识 (YYYY-Www)
 * @returns DailyLog 列表
 */
export async function getDailiesByWeek(
  workspacePath: string,
  week: string
): Promise<DailyLog[]> {
  const dailies = await listDailies(workspacePath);
  return dailies.filter((daily) => daily.meta.week === week);
}

// ============================================
// Association Operations
// ============================================

/**
 * 关联项目到 Daily Log
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param projectName 项目名称
 * @returns 更新后的 DailyLog
 */
export async function addProjectToDaily(
  workspacePath: string,
  date: string,
  projectName: string
): Promise<DailyLog> {
  const daily = await getDaily(workspacePath, formatDate(date));
  if (!daily) {
    throw new Error(`Daily log not found for ${date}`);
  }

  if (!daily.meta.projects.includes(projectName)) {
    daily.meta.projects.push(projectName);
    await writeFile(daily.filePath, serializeDaily(daily));
  }

  return daily;
}

/**
 * 从 Daily Log 移除项目关联
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param projectName 项目名称
 * @returns 更新后的 DailyLog
 */
export async function removeProjectFromDaily(
  workspacePath: string,
  date: string,
  projectName: string
): Promise<DailyLog> {
  const daily = await getDaily(workspacePath, formatDate(date));
  if (!daily) {
    throw new Error(`Daily log not found for ${date}`);
  }

  daily.meta.projects = daily.meta.projects.filter((p) => p !== projectName);
  await writeFile(daily.filePath, serializeDaily(daily));

  return daily;
}

/**
 * 添加 GitHub Issue 链接
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param issueUrl Issue URL
 * @returns 更新后的 DailyLog
 */
export async function addGitHubIssue(
  workspacePath: string,
  date: string,
  issueUrl: string
): Promise<DailyLog> {
  const daily = await getDaily(workspacePath, formatDate(date));
  if (!daily) {
    throw new Error(`Daily log not found for ${date}`);
  }

  if (!daily.meta.github.issues.includes(issueUrl)) {
    daily.meta.github.issues.push(issueUrl);
    await writeFile(daily.filePath, serializeDaily(daily));
  }

  return daily;
}

/**
 * 添加 GitHub PR 链接
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param prUrl PR URL
 * @returns 更新后的 DailyLog
 */
export async function addGitHubPR(
  workspacePath: string,
  date: string,
  prUrl: string
): Promise<DailyLog> {
  const daily = await getDaily(workspacePath, formatDate(date));
  if (!daily) {
    throw new Error(`Daily log not found for ${date}`);
  }

  if (!daily.meta.github.prs.includes(prUrl)) {
    daily.meta.github.prs.push(prUrl);
    await writeFile(daily.filePath, serializeDaily(daily));
  }

  return daily;
}

/**
 * 添加标签
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param tag 标签
 * @returns 更新后的 DailyLog
 */
export async function addTagToDaily(
  workspacePath: string,
  date: string,
  tag: string
): Promise<DailyLog> {
  const daily = await getDaily(workspacePath, formatDate(date));
  if (!daily) {
    throw new Error(`Daily log not found for ${date}`);
  }

  const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
  if (!daily.meta.tags.includes(normalizedTag)) {
    daily.meta.tags.push(normalizedTag);
    await writeFile(daily.filePath, serializeDaily(daily));
  }

  return daily;
}

/**
 * 设置/取消周报重点
 * @param workspacePath workspace 路径
 * @param date 日期
 * @param isHighlight 是否为重点
 * @returns 更新后的 DailyLog
 */
export async function setWeeklyHighlight(
  workspacePath: string,
  date: string,
  isHighlight: boolean
): Promise<DailyLog> {
  return updateDaily(workspacePath, date, {
    meta: { weekly_highlight: isHighlight },
  });
}

// ============================================
// Statistics
// ============================================

/**
 * 获取 Daily Log 统计信息
 * @param workspacePath workspace 路径
 * @returns 统计信息
 */
export async function getDailyStats(
  workspacePath: string
): Promise<{
  total: number;
  thisWeek: number;
  thisMonth: number;
  highlightCount: number;
  projectCounts: Record<string, number>;
  tagCounts: Record<string, number>;
}> {
  const dailies = await listDailies(workspacePath);
  const now = new Date();
  const thisMonthStart = format(now, 'yyyy-MM-01');

  const { WEEK: currentWeek } = generateDateVariables(now);

  const stats = {
    total: dailies.length,
    thisWeek: 0,
    thisMonth: 0,
    highlightCount: 0,
    projectCounts: {} as Record<string, number>,
    tagCounts: {} as Record<string, number>,
  };

  for (const daily of dailies) {
    // 本周统计
    if (daily.meta.week === currentWeek) {
      stats.thisWeek++;
    }

    // 本月统计
    if (daily.meta.date >= thisMonthStart) {
      stats.thisMonth++;
    }

    // 重点统计
    if (daily.meta.weekly_highlight) {
      stats.highlightCount++;
    }

    // 项目统计
    for (const project of daily.meta.projects) {
      stats.projectCounts[project] = (stats.projectCounts[project] || 0) + 1;
    }

    // 标签统计
    for (const tag of daily.meta.tags) {
      stats.tagCounts[tag] = (stats.tagCounts[tag] || 0) + 1;
    }
  }

  return stats;
}

// ============================================
// Aliases
// ============================================

/**
 * Alias for listDailies
 */
export const listDaily = listDailies;
