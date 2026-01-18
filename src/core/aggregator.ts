/**
 * Aggregator Engine
 * 从 Daily Log 聚合数据到 Weekly Report
 */

import type { DailyLog, WeeklyMeta } from './schema.js';

// ============================================
// Types
// ============================================

/** 聚合后的周报内容 */
export interface WeeklyAggregation {
  /** 周元数据 */
  meta: WeeklyMeta;
  /** 聚合生成的内容 */
  content: string;
  /** 涉及的项目列表 */
  projects: string[];
  /** 周报重点内容 */
  highlights: HighlightEntry[];
  /** 每日摘要 */
  dailySummaries: DailySummary[];
}

/** 周报重点条目 */
export interface HighlightEntry {
  /** 日期 */
  date: string;
  /** 提取的重点内容 */
  content: string;
}

/** 每日摘要 */
export interface DailySummary {
  /** 日期 */
  date: string;
  /** 关联项目 */
  projects: string[];
  /** 标签 */
  tags: string[];
  /** 是否为周报重点 */
  isHighlight: boolean;
  /** 内容摘要（前 200 字符） */
  excerpt: string;
}

// ============================================
// Content Extraction
// ============================================

/**
 * 从 Daily Log 内容中提取特定章节
 * @param content Daily Log 内容
 * @param sectionTitle 章节标题
 * @returns 章节内容
 */
export function extractSection(content: string, sectionTitle: string): string {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    // 检查是否进入目标章节
    if (line.match(new RegExp(`^#+\\s*${escapeRegex(sectionTitle)}`, 'i'))) {
      inSection = true;
      continue;
    }

    // 检查是否遇到新章节（结束当前章节）
    if (inSection && line.match(/^#+\s+/)) {
      break;
    }

    // 收集章节内容
    if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

/**
 * 从 Daily Log 内容中提取所有非空列表项
 * @param content Daily Log 内容
 * @param sectionTitle 章节标题
 * @returns 列表项数组
 */
export function extractListItems(content: string, sectionTitle: string): string[] {
  const section = extractSection(content, sectionTitle);
  const lines = section.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const match = line.match(/^[-*]\s+\[?[xX ]?\]?\s*(.+)/);
    if (match && match[1].trim()) {
      items.push(match[1].trim());
    }
  }

  return items;
}

/**
 * 从 Daily Log 中提取重点内容
 * 优先提取 "今日完成" 章节，如果没有则提取整体内容
 * @param daily Daily Log 对象
 * @returns 提取的重点内容
 */
export function extractHighlightContent(daily: DailyLog): string {
  // 尝试提取 "今日完成" 章节
  const completed = extractSection(daily.content, '今日完成');
  if (completed) {
    return completed;
  }

  // 尝试提取 "项目进展" 章节
  const progress = extractSection(daily.content, '项目进展');
  if (progress) {
    return progress;
  }

  // 返回整体内容摘要
  return daily.content.substring(0, 500);
}

/**
 * 生成内容摘要
 * @param content 原始内容
 * @param maxLength 最大长度
 * @returns 摘要文本
 */
export function generateExcerpt(content: string, maxLength: number = 200): string {
  // 移除 Markdown 标题
  const cleaned = content
    .replace(/^#+\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength).trim() + '...';
}

// ============================================
// Aggregation Functions
// ============================================

/**
 * 创建每日摘要
 * @param daily Daily Log 对象
 * @returns 每日摘要
 */
export function createDailySummary(daily: DailyLog): DailySummary {
  return {
    date: daily.meta.date,
    projects: daily.meta.projects,
    tags: daily.meta.tags,
    isHighlight: daily.meta.weekly_highlight,
    excerpt: generateExcerpt(daily.content),
  };
}

/**
 * 聚合 Daily Logs 到 Weekly Report 内容
 * @param dailies 该周的 Daily Log 列表
 * @param weekMeta 周报元数据
 * @returns 聚合后的周报数据
 */
export function aggregateDailiesToWeekly(
  dailies: DailyLog[],
  weekMeta: WeeklyMeta
): WeeklyAggregation {
  // 按日期排序（升序）
  const sortedDailies = [...dailies].sort((a, b) =>
    a.meta.date.localeCompare(b.meta.date)
  );

  // 收集所有项目
  const projectSet = new Set<string>();
  for (const daily of sortedDailies) {
    for (const project of daily.meta.projects) {
      projectSet.add(project);
    }
  }
  const projects = Array.from(projectSet);

  // 提取周报重点
  const highlights: HighlightEntry[] = sortedDailies
    .filter((d) => d.meta.weekly_highlight)
    .map((d) => ({
      date: d.meta.date,
      content: extractHighlightContent(d),
    }));

  // 创建每日摘要
  const dailySummaries = sortedDailies.map(createDailySummary);

  // 生成周报内容
  const content = generateWeeklyContent(
    weekMeta,
    projects,
    highlights,
    dailySummaries
  );

  return {
    meta: {
      ...weekMeta,
      projects,
    },
    content,
    projects,
    highlights,
    dailySummaries,
  };
}

/**
 * 生成周报 Markdown 内容
 */
function generateWeeklyContent(
  weekMeta: WeeklyMeta,
  projects: string[],
  highlights: HighlightEntry[],
  dailySummaries: DailySummary[]
): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# Week ${weekMeta.week} 工作周报`);
  lines.push('');

  // 本周总结
  lines.push('## 本周总结（一句话）');
  lines.push('');
  lines.push('');

  // 本周重点产出
  lines.push('## 本周重点产出（Highlights）');
  lines.push('');
  if (highlights.length > 0) {
    for (const highlight of highlights) {
      lines.push(`### ${highlight.date}`);
      lines.push('');
      lines.push(highlight.content);
      lines.push('');
    }
  } else {
    lines.push('*本周暂无标记为 highlight 的日志*');
    lines.push('');
  }

  // 项目进展
  lines.push('## 项目进展');
  lines.push('');
  if (projects.length > 0) {
    for (const project of projects) {
      lines.push(`### ${project}`);
      lines.push('- 本周进展：');
      lines.push('- 当前状态：');
      lines.push('- 下周计划：');
      lines.push('');
    }
  } else {
    lines.push('*本周暂无关联项目*');
    lines.push('');
  }

  // 每日工作摘要
  lines.push('## 每日工作摘要');
  lines.push('');
  if (dailySummaries.length > 0) {
    for (const summary of dailySummaries) {
      const highlightMark = summary.isHighlight ? ' ⭐' : '';
      const projectsInfo = summary.projects.length > 0
        ? ` [${summary.projects.join(', ')}]`
        : '';
      lines.push(`### ${summary.date}${highlightMark}${projectsInfo}`);
      lines.push('');
      if (summary.excerpt) {
        lines.push(summary.excerpt);
      } else {
        lines.push('*无内容*');
      }
      lines.push('');
    }
  } else {
    lines.push('*本周暂无 Daily Log*');
    lines.push('');
  }

  // 风险与阻塞
  lines.push('## 风险与阻塞');
  lines.push('-');
  lines.push('');

  // 下周计划
  lines.push('## 下周计划');
  lines.push('-');
  lines.push('');

  return lines.join('\n');
}

// ============================================
// Utilities
// ============================================

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 合并两个周报内容（保留用户编辑）
 * 将新聚合的内容合并到已有周报，保留用户手动编辑的部分
 * @param existingContent 已有周报内容
 * @param newAggregation 新聚合数据
 * @returns 合并后的内容
 */
export function mergeWeeklyContent(
  existingContent: string,
  newAggregation: WeeklyAggregation
): string {
  // 如果已有内容为空，直接返回新内容
  if (!existingContent.trim()) {
    return newAggregation.content;
  }

  // 提取并保留用户编辑的章节
  const userSummary = extractSection(existingContent, '本周总结');
  const userRisks = extractSection(existingContent, '风险与阻塞');
  const userPlan = extractSection(existingContent, '下周计划');

  // 在新内容中替换这些章节
  let content = newAggregation.content;

  if (userSummary && userSummary !== '') {
    content = replaceSection(content, '本周总结（一句话）', userSummary);
  }
  if (userRisks && userRisks !== '-') {
    content = replaceSection(content, '风险与阻塞', userRisks);
  }
  if (userPlan && userPlan !== '-') {
    content = replaceSection(content, '下周计划', userPlan);
  }

  return content;
}

/**
 * 替换内容中的特定章节
 */
function replaceSection(
  content: string,
  sectionTitle: string,
  newSectionContent: string
): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否进入目标章节
    if (line.match(new RegExp(`^#+\\s*${escapeRegex(sectionTitle)}`, 'i'))) {
      result.push(line);
      result.push('');
      result.push(newSectionContent);
      inSection = true;
      continue;
    }

    // 检查是否遇到新章节（结束当前章节）
    if (inSection && line.match(/^#+\s+/)) {
      inSection = false;
    }

    // 跳过旧章节内容
    if (inSection) {
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}
