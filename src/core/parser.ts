/**
 * Frontmatter Parser
 * 解析和序列化 Markdown + YAML frontmatter 格式的文件
 */

import matter from 'gray-matter';
import { stringify as yamlStringify } from 'yaml';
import { format, isValid } from 'date-fns';
import type {
  DailyMeta,
  DailyLog,
  WeeklyMeta,
  WeeklyReport,
  ProjectMeta,
  Project,
  DocumentType,
} from './schema.js';

// ============================================
// Generic Parser
// ============================================

/** 解析结果 */
export interface ParseResult<T> {
  /** 元数据 */
  meta: T;
  /** Markdown 正文 */
  content: string;
  /** 原始字符串 */
  raw: string;
}

/**
 * 解析 Markdown 文件的 frontmatter 和内容
 * @param fileContent 文件原始内容
 * @returns 解析结果
 */
export function parseFrontmatter<T>(fileContent: string): ParseResult<T> {
  const { data, content } = matter(fileContent);
  return {
    meta: data as T,
    content: content.trim(),
    raw: fileContent,
  };
}

/**
 * 序列化元数据和内容为 Markdown 格式
 * @param meta 元数据对象
 * @param content Markdown 正文
 * @returns 完整的 Markdown 字符串
 */
export function serializeFrontmatter<T extends object>(
  meta: T,
  content: string
): string {
  const yamlContent = yamlStringify(meta, {
    indent: 2,
    lineWidth: 0, // 不自动换行
  }).trim();

  return `---\n${yamlContent}\n---\n\n${content}\n`;
}

// ============================================
// Type-Specific Parsers
// ============================================

/**
 * 解析 Daily Log 文件
 * @param fileContent 文件内容
 * @param filePath 文件路径
 * @returns DailyLog 对象
 */
export function parseDaily(fileContent: string, filePath: string): DailyLog {
  const { meta, content } = parseFrontmatter<DailyMeta>(fileContent);

  // 验证必要字段
  validateDailyMeta(meta);

  return {
    meta,
    content,
    filePath,
  };
}

/**
 * 序列化 Daily Log 为 Markdown
 * @param daily DailyLog 对象
 * @returns Markdown 字符串
 */
export function serializeDaily(daily: DailyLog): string {
  return serializeFrontmatter(daily.meta, daily.content);
}

/**
 * 解析 Weekly Report 文件
 * @param fileContent 文件内容
 * @param filePath 文件路径
 * @returns WeeklyReport 对象
 */
export function parseWeekly(
  fileContent: string,
  filePath: string
): WeeklyReport {
  const { meta, content } = parseFrontmatter<WeeklyMeta>(fileContent);

  // 验证必要字段
  validateWeeklyMeta(meta);

  return {
    meta,
    content,
    filePath,
  };
}

/**
 * 序列化 Weekly Report 为 Markdown
 * @param weekly WeeklyReport 对象
 * @returns Markdown 字符串
 */
export function serializeWeekly(weekly: WeeklyReport): string {
  return serializeFrontmatter(weekly.meta, weekly.content);
}

/**
 * 解析 Project 文件
 * @param fileContent 文件内容
 * @param filePath 文件路径
 * @returns Project 对象
 */
export function parseProject(fileContent: string, filePath: string): Project {
  const { meta, content } = parseFrontmatter<ProjectMeta>(fileContent);

  // 验证必要字段
  validateProjectMeta(meta);

  return {
    meta,
    content,
    filePath,
  };
}

/**
 * 序列化 Project 为 Markdown
 * @param project Project 对象
 * @returns Markdown 字符串
 */
export function serializeProject(project: Project): string {
  return serializeFrontmatter(project.meta, project.content);
}

// ============================================
// Auto-detect Parser
// ============================================

/** 自动检测并解析文档 */
export type ParsedDocument = DailyLog | WeeklyReport | Project;

/**
 * 自动检测文档类型并解析
 * @param fileContent 文件内容
 * @param filePath 文件路径
 * @returns 解析后的文档对象和类型
 */
export function parseDocument(
  fileContent: string,
  filePath: string
): { type: DocumentType; document: ParsedDocument } {
  const { meta } = parseFrontmatter<{ type?: string; project?: object }>(
    fileContent
  );

  // 检测文档类型
  if (meta.type === 'daily') {
    return {
      type: 'daily',
      document: parseDaily(fileContent, filePath),
    };
  }

  if (meta.type === 'weekly') {
    return {
      type: 'weekly',
      document: parseWeekly(fileContent, filePath),
    };
  }

  if (meta.project) {
    return {
      type: 'project',
      document: parseProject(fileContent, filePath),
    };
  }

  throw new Error(`Unknown document type in file: ${filePath}`);
}

// ============================================
// Validation
// ============================================

/** 解析错误 */
export class ParseError extends Error {
  constructor(
    message: string,
    public field?: string,
    public filePath?: string
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * 标准化日期为 YYYY-MM-DD 格式字符串
 * gray-matter 会将日期字符串解析为 Date 对象，需要转换回字符串
 */
function normalizeDate(date: unknown): string {
  if (date instanceof Date && isValid(date)) {
    return format(date, 'yyyy-MM-dd');
  }
  if (typeof date === 'string') {
    // 尝试解析并规范化
    const d = new Date(date);
    if (isValid(d)) {
      return format(d, 'yyyy-MM-dd');
    }
    return date;
  }
  throw new ParseError(`Invalid date value: ${date}`, 'date');
}

/**
 * 验证 Daily Meta 必要字段
 */
function validateDailyMeta(meta: Partial<DailyMeta>): asserts meta is DailyMeta {
  if (!meta.date) {
    throw new ParseError('Daily log missing required field: date', 'date');
  }
  if (!meta.type || meta.type !== 'daily') {
    throw new ParseError(
      'Daily log must have type: daily',
      'type'
    );
  }

  // 规范化日期格式
  meta.date = normalizeDate(meta.date);

  // 设置默认值
  meta.week = meta.week || '';
  meta.projects = meta.projects || [];
  meta.tags = meta.tags || [];
  meta.weekly_highlight = meta.weekly_highlight ?? false;
  meta.github = meta.github || { issues: [], prs: [] };
}

/**
 * 验证 Weekly Meta 必要字段
 */
function validateWeeklyMeta(
  meta: Partial<WeeklyMeta>
): asserts meta is WeeklyMeta {
  if (!meta.week) {
    throw new ParseError('Weekly report missing required field: week', 'week');
  }
  if (!meta.type || meta.type !== 'weekly') {
    throw new ParseError(
      'Weekly report must have type: weekly',
      'type'
    );
  }

  // 规范化日期格式
  if (meta.start_date) {
    meta.start_date = normalizeDate(meta.start_date);
  } else {
    meta.start_date = '';
  }
  if (meta.end_date) {
    meta.end_date = normalizeDate(meta.end_date);
  } else {
    meta.end_date = '';
  }

  // 设置默认值
  meta.projects = meta.projects || [];
}

/**
 * 验证 Project Meta 必要字段
 */
function validateProjectMeta(
  meta: Partial<ProjectMeta>
): asserts meta is ProjectMeta {
  if (!meta.project) {
    throw new ParseError(
      'Project file missing required field: project',
      'project'
    );
  }

  const project = meta.project;

  if (!project.name) {
    throw new ParseError(
      'Project missing required field: project.name',
      'project.name'
    );
  }

  if (!project.github_repo) {
    throw new ParseError(
      'Project missing required field: project.github_repo',
      'project.github_repo'
    );
  }

  // 设置默认值
  project.type = project.type || 'software';
  project.status = project.status || 'Planning';

  // 规范化日期格式
  if (project.start_date) {
    project.start_date = normalizeDate(project.start_date);
  } else {
    project.start_date = format(new Date(), 'yyyy-MM-dd');
  }
  if (project.end_date) {
    project.end_date = normalizeDate(project.end_date);
  }
}

// ============================================
// Utilities
// ============================================

/**
 * 从 Markdown 内容中提取 frontmatter
 * @param content 完整的 Markdown 内容
 * @returns frontmatter 对象，如果不存在则返回 null
 */
export function extractFrontmatter<T>(content: string): T | null {
  try {
    const { data } = matter(content);
    return Object.keys(data).length > 0 ? (data as T) : null;
  } catch {
    return null;
  }
}

/**
 * 检查内容是否包含 frontmatter
 */
export function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith('---');
}

/**
 * 更新 frontmatter 中的特定字段
 * @param content 原始内容
 * @param updates 要更新的字段
 * @returns 更新后的内容
 */
export function updateFrontmatter<T extends object>(
  content: string,
  updates: Partial<T>
): string {
  const { meta, content: body } = parseFrontmatter<T>(content);
  const updatedMeta = { ...meta, ...updates };
  return serializeFrontmatter(updatedMeta, body);
}
