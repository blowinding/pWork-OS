/**
 * Core data schemas for pWork-OS
 * 定义 Daily、Weekly、Project 的数据结构
 */

// ============================================
// Common Types
// ============================================

/** GitHub 链接信息 */
export interface GitHubLink {
  /** Issue 链接列表 */
  issues: string[];
  /** PR 链接列表 */
  prs: string[];
}

/** 项目状态 */
export type ProjectStatus = 'Planning' | 'Doing' | 'Blocked' | 'Done';

/** 项目类型 */
export type ProjectType = 'software' | 'research' | 'hybrid' | 'misc';

/** 文档类型 */
export type DocumentType = 'daily' | 'weekly' | 'project';

// ============================================
// Daily Log Schema
// ============================================

/** Daily Log 元数据（YAML frontmatter） */
export interface DailyMeta {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 文档类型 */
  type: 'daily';
  /** 所属周，格式 YYYY-Www（如 2026-W03） */
  week: string;
  /** 关联的项目名称列表 */
  projects: string[];
  /** 标签列表 */
  tags: string[];
  /** 是否为周报重点 */
  weekly_highlight: boolean;
  /** GitHub 关联 */
  github: GitHubLink;
}

/** Daily Log 完整数据 */
export interface DailyLog {
  /** 元数据 */
  meta: DailyMeta;
  /** Markdown 正文内容 */
  content: string;
  /** 文件路径 */
  filePath: string;
}

/** 创建 Daily Log 的输入参数 */
export interface CreateDailyInput {
  date?: string; // 默认今天
  projects?: string[];
  tags?: string[];
}

// ============================================
// Weekly Report Schema
// ============================================

/** Weekly Report 元数据 */
export interface WeeklyMeta {
  /** 周标识，格式 YYYY-Www */
  week: string;
  /** 文档类型 */
  type: 'weekly';
  /** 周起始日期 */
  start_date: string;
  /** 周结束日期 */
  end_date: string;
  /** 涉及的项目列表 */
  projects: string[];
}

/** Weekly Report 完整数据 */
export interface WeeklyReport {
  /** 元数据 */
  meta: WeeklyMeta;
  /** Markdown 正文内容 */
  content: string;
  /** 文件路径 */
  filePath: string;
}

/** 创建 Weekly Report 的输入参数 */
export interface CreateWeeklyInput {
  week?: string; // 默认当前周
  autoAggregate?: boolean; // 是否自动从 Daily 聚合
}

// ============================================
// Project Schema
// ============================================

/** Project 核心信息（YAML frontmatter 中的 project 字段） */
export interface ProjectInfo {
  /** 项目名称 */
  name: string;
  /** 项目类型 */
  type: ProjectType;
  /** 关联的 GitHub Repo URL */
  github_repo: string;
  /** 当前状态 */
  status: ProjectStatus;
  /** 开始日期 */
  start_date: string;
  /** 结束日期（可选） */
  end_date?: string;
}

/** Project 元数据 */
export interface ProjectMeta {
  /** 项目核心信息 */
  project: ProjectInfo;
}

/** Project 完整数据 */
export interface Project {
  /** 元数据 */
  meta: ProjectMeta;
  /** Markdown 正文内容 */
  content: string;
  /** 文件路径 */
  filePath: string;
}

/** 创建 Project 的输入参数 */
export interface CreateProjectInput {
  name: string;
  type?: ProjectType;
  github_repo: string;
  status?: ProjectStatus;
  start_date?: string;
}

// ============================================
// Workspace Configuration
// ============================================

/** Workspace 配置 */
export interface WorkspaceConfig {
  /** Workspace 名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 创建时间 */
  created_at: string;
  /** GitHub 配置 */
  github?: {
    /** GitHub 用户名 */
    username?: string;
    /** 默认组织 */
    default_org?: string;
  };
  /** 自定义目录名称 */
  directories?: {
    daily?: string;
    weekly?: string;
    projects?: string;
    templates?: string;
    scripts?: string;
    slides?: string;
  };
}

// ============================================
// Query & Filter Types
// ============================================

/** Daily Log 查询条件 */
export interface DailyQuery {
  /** 起始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 项目名称 */
  project?: string;
  /** 标签 */
  tag?: string;
  /** 只查询周报重点 */
  highlightOnly?: boolean;
}

/** Project 查询条件 */
export interface ProjectQuery {
  /** 状态过滤 */
  status?: ProjectStatus;
  /** 类型过滤 */
  type?: ProjectType;
  /** 名称模糊搜索 */
  nameContains?: string;
}

// ============================================
// Type Guards
// ============================================

/** 检查是否为有效的 ProjectStatus */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === 'string' &&
    ['Planning', 'Doing', 'Blocked', 'Done'].includes(value)
  );
}

/** 检查是否为有效的 ProjectType */
export function isProjectType(value: unknown): value is ProjectType {
  return (
    typeof value === 'string' &&
    ['software', 'research', 'hybrid', 'misc'].includes(value)
  );
}

/** 检查是否为有效的 DocumentType */
export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === 'string' &&
    ['daily', 'weekly', 'project'].includes(value)
  );
}

// ============================================
// Default Values
// ============================================

/** 默认 Daily Log 元数据 */
export function createDefaultDailyMeta(date: string, week: string): DailyMeta {
  return {
    date,
    type: 'daily',
    week,
    projects: [],
    tags: [],
    weekly_highlight: false,
    github: {
      issues: [],
      prs: [],
    },
  };
}

/** 默认 Weekly Report 元数据 */
export function createDefaultWeeklyMeta(
  week: string,
  startDate: string,
  endDate: string
): WeeklyMeta {
  return {
    week,
    type: 'weekly',
    start_date: startDate,
    end_date: endDate,
    projects: [],
  };
}

/** 默认 Project 元数据 */
export function createDefaultProjectMeta(
  name: string,
  githubRepo: string,
  startDate: string
): ProjectMeta {
  return {
    project: {
      name,
      type: 'software',
      github_repo: githubRepo,
      status: 'Planning',
      start_date: startDate,
    },
  };
}

/** 默认 Workspace 配置 */
export function createDefaultWorkspaceConfig(name: string): WorkspaceConfig {
  return {
    name,
    version: '1.0.0',
    created_at: new Date().toISOString(),
    directories: {
      daily: 'daily',
      weekly: 'weekly',
      projects: 'projects',
      templates: 'templates',
      scripts: 'scripts',
      slides: 'slides',
    },
  };
}
