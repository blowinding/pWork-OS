/**
 * Weekly Report Module
 * Weekly Report 的创建、编辑、查询、聚合
 */

import { format, getISOWeek, getYear, parseISO, isValid } from 'date-fns';
import type {
  WeeklyReport,
  WeeklyMeta,
  CreateWeeklyInput,
  DailyLog,
} from '../core/schema.js';
import { createDefaultWeeklyMeta } from '../core/schema.js';
import {
  getWeeklyFilePath,
  listWeeklyFiles,
  exists,
  readFile,
  writeFile,
  deleteFile,
  findDailyFilesByDateRange,
} from '../core/fs.js';
import { parseWeekly, serializeWeekly, parseDaily } from '../core/parser.js';
import {
  renderWeeklyTemplate,
  generateWeekVariables,
} from '../template/engine.js';
import {
  aggregateDailiesToWeekly,
  mergeWeeklyContent,
  type WeeklyAggregation,
} from '../core/aggregator.js';

// ============================================
// Week Utilities
// ============================================

/**
 * 获取当前周标识
 * @returns 周标识 (YYYY-Www)
 */
export function getCurrentWeek(): string {
  const now = new Date();
  const year = getYear(now);
  const week = getISOWeek(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * 格式化周标识
 * @param date 日期对象或字符串
 * @returns 周标识 (YYYY-Www)
 */
export function formatWeek(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) {
    throw new Error(`Invalid date: ${date}`);
  }
  const year = getYear(d);
  const week = getISOWeek(d);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * 验证周标识格式
 * @param weekStr 周标识字符串
 * @returns 是否有效
 */
export function isValidWeekString(weekStr: string): boolean {
  const regex = /^\d{4}-W\d{2}$/;
  if (!regex.test(weekStr)) {
    return false;
  }
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return false;
  const week = parseInt(match[2], 10);
  return week >= 1 && week <= 53;
}

/**
 * 获取周的起止日期
 * @param weekStr 周标识 (YYYY-Www)
 * @returns { start: string, end: string }
 */
export function getWeekDateRange(weekStr: string): { start: string; end: string } {
  const vars = generateWeekVariables(weekStr);
  return {
    start: vars.WEEK_START!,
    end: vars.WEEK_END!,
  };
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 创建新的 Weekly Report
 * @param workspacePath workspace 路径
 * @param input 创建参数
 * @returns 创建的 WeeklyReport 对象
 */
export async function createWeekly(
  workspacePath: string,
  input: CreateWeeklyInput = {}
): Promise<WeeklyReport> {
  const week = input.week || getCurrentWeek();
  const filePath = getWeeklyFilePath(workspacePath, week);

  // 检查是否已存在
  if (await exists(filePath)) {
    throw new Error(`Weekly report already exists for ${week}`);
  }

  // 使用模板渲染初始内容
  const content = await renderWeeklyTemplate(workspacePath, week);

  // 解析渲染后的内容
  const weekly = parseWeekly(content, filePath);

  // 如果需要自动聚合
  if (input.autoAggregate) {
    const aggregation = await aggregateFromDailies(workspacePath, week);
    weekly.content = aggregation.content;
    weekly.meta.projects = aggregation.projects;
  }

  // 写入文件
  await writeFile(filePath, serializeWeekly(weekly));

  return weekly;
}

/**
 * 获取指定周的 Weekly Report
 * @param workspacePath workspace 路径
 * @param week 周标识
 * @returns WeeklyReport 对象，如果不存在则返回 null
 */
export async function getWeekly(
  workspacePath: string,
  week: string
): Promise<WeeklyReport | null> {
  const filePath = getWeeklyFilePath(workspacePath, week);

  if (!(await exists(filePath))) {
    return null;
  }

  const content = await readFile(filePath);
  return parseWeekly(content, filePath);
}

/**
 * 获取当前周的 Weekly Report
 * @param workspacePath workspace 路径
 * @returns WeeklyReport 对象，如果不存在则返回 null
 */
export async function getCurrentWeekly(
  workspacePath: string
): Promise<WeeklyReport | null> {
  return getWeekly(workspacePath, getCurrentWeek());
}

/**
 * 获取或创建当前周的 Weekly Report
 * @param workspacePath workspace 路径
 * @param input 创建参数（仅在创建时使用）
 * @returns WeeklyReport 对象
 */
export async function getOrCreateCurrentWeekly(
  workspacePath: string,
  input: CreateWeeklyInput = {}
): Promise<WeeklyReport> {
  const week = getCurrentWeek();
  const existing = await getWeekly(workspacePath, week);

  if (existing) {
    return existing;
  }

  return createWeekly(workspacePath, { ...input, week });
}

/**
 * 更新 Weekly Report
 * @param workspacePath workspace 路径
 * @param week 周标识
 * @param updates 更新内容
 * @returns 更新后的 WeeklyReport
 */
export async function updateWeekly(
  workspacePath: string,
  week: string,
  updates: Partial<{ meta: Partial<WeeklyMeta>; content: string }>
): Promise<WeeklyReport> {
  const weekly = await getWeekly(workspacePath, week);

  if (!weekly) {
    throw new Error(`Weekly report not found for ${week}`);
  }

  // 应用更新
  if (updates.meta) {
    weekly.meta = { ...weekly.meta, ...updates.meta };
  }
  if (updates.content !== undefined) {
    weekly.content = updates.content;
  }

  // 写入文件
  await writeFile(weekly.filePath, serializeWeekly(weekly));

  return weekly;
}

/**
 * 删除 Weekly Report
 * @param workspacePath workspace 路径
 * @param week 周标识
 */
export async function deleteWeekly(
  workspacePath: string,
  week: string
): Promise<void> {
  const filePath = getWeeklyFilePath(workspacePath, week);

  if (!(await exists(filePath))) {
    throw new Error(`Weekly report not found for ${week}`);
  }

  await deleteFile(filePath);
}

// ============================================
// Query Operations
// ============================================

/**
 * 列出所有 Weekly Report
 * @param workspacePath workspace 路径
 * @returns WeeklyReport 列表（按周降序）
 */
export async function listWeeklies(workspacePath: string): Promise<WeeklyReport[]> {
  const files = await listWeeklyFiles(workspacePath);
  const weeklies: WeeklyReport[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file.path);
      weeklies.push(parseWeekly(content, file.path));
    } catch (error) {
      // 跳过解析失败的文件
      console.warn(`Failed to parse weekly report: ${file.path}`, error);
    }
  }

  return weeklies;
}

/**
 * 获取最近 N 周的 Weekly Report
 * @param workspacePath workspace 路径
 * @param count 数量
 * @returns WeeklyReport 列表
 */
export async function getRecentWeeklies(
  workspacePath: string,
  count: number = 4
): Promise<WeeklyReport[]> {
  const weeklies = await listWeeklies(workspacePath);
  return weeklies.slice(0, count);
}

// ============================================
// Aggregation Operations
// ============================================

/**
 * 获取指定周的所有 Daily Log
 * @param workspacePath workspace 路径
 * @param week 周标识
 * @returns DailyLog 列表
 */
export async function getDailiesForWeek(
  workspacePath: string,
  week: string
): Promise<DailyLog[]> {
  const { start, end } = getWeekDateRange(week);
  const filePaths = await findDailyFilesByDateRange(workspacePath, start, end);
  const dailies: DailyLog[] = [];

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath);
      dailies.push(parseDaily(content, filePath));
    } catch {
      // 跳过解析失败的文件
    }
  }

  return dailies;
}

/**
 * 从 Daily Logs 聚合生成 Weekly Report 内容
 * @param workspacePath workspace 路径
 * @param week 周标识
 * @returns 聚合结果
 */
export async function aggregateFromDailies(
  workspacePath: string,
  week: string
): Promise<WeeklyAggregation> {
  const { start, end } = getWeekDateRange(week);
  const dailies = await getDailiesForWeek(workspacePath, week);

  const weekMeta = createDefaultWeeklyMeta(week, start, end);

  return aggregateDailiesToWeekly(dailies, weekMeta);
}

/**
 * 生成/更新 Weekly Report（从 Daily 聚合）
 * 如果周报已存在，会保留用户编辑的部分并更新聚合内容
 * @param workspacePath workspace 路径
 * @param week 周标识（默认当前周）
 * @returns WeeklyReport 对象
 */
export async function generateWeekly(
  workspacePath: string,
  week?: string
): Promise<WeeklyReport> {
  const targetWeek = week || getCurrentWeek();
  const filePath = getWeeklyFilePath(workspacePath, targetWeek);
  const existing = await getWeekly(workspacePath, targetWeek);

  // 聚合 Daily Logs
  const aggregation = await aggregateFromDailies(workspacePath, targetWeek);

  let weekly: WeeklyReport;

  if (existing) {
    // 合并已有内容（保留用户编辑）
    const mergedContent = mergeWeeklyContent(existing.content, aggregation);
    weekly = {
      meta: {
        ...existing.meta,
        projects: aggregation.projects,
      },
      content: mergedContent,
      filePath: existing.filePath,
    };
  } else {
    // 创建新的周报
    const { start, end } = getWeekDateRange(targetWeek);
    weekly = {
      meta: createDefaultWeeklyMeta(targetWeek, start, end),
      content: aggregation.content,
      filePath,
    };
    weekly.meta.projects = aggregation.projects;
  }

  // 写入文件
  await writeFile(filePath, serializeWeekly(weekly));

  return weekly;
}

// ============================================
// Statistics
// ============================================

/**
 * 获取 Weekly Report 统计信息
 * @param workspacePath workspace 路径
 * @returns 统计信息
 */
export async function getWeeklyStats(
  workspacePath: string
): Promise<{
  total: number;
  thisMonth: number;
  projectCounts: Record<string, number>;
}> {
  const weeklies = await listWeeklies(workspacePath);
  const now = new Date();
  const thisMonthStart = format(now, 'yyyy-MM');

  const stats = {
    total: weeklies.length,
    thisMonth: 0,
    projectCounts: {} as Record<string, number>,
  };

  for (const weekly of weeklies) {
    // 本月统计
    if (weekly.meta.start_date.startsWith(thisMonthStart)) {
      stats.thisMonth++;
    }

    // 项目统计
    for (const project of weekly.meta.projects) {
      stats.projectCounts[project] = (stats.projectCounts[project] || 0) + 1;
    }
  }

  return stats;
}

// ============================================
// Aliases
// ============================================

/**
 * Alias for listWeeklies
 */
export const listWeekly = listWeeklies;
