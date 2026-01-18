/**
 * Template Engine
 * 模板引擎，支持变量替换（{{DATE}}、{{WEEK}}等）
 */

import { format, getISOWeek, getYear, startOfWeek, endOfWeek } from 'date-fns';
import { readFile, getTemplateFilePath, exists } from '../core/fs.js';

// ============================================
// Types
// ============================================

/** 模板变量类型 */
export interface TemplateVariables {
  /** 日期 YYYY-MM-DD */
  DATE?: string;
  /** 周标识 YYYY-Www */
  WEEK?: string;
  /** 年份 */
  YEAR?: string;
  /** 月份 */
  MONTH?: string;
  /** 日 */
  DAY?: string;
  /** 周起始日期 */
  WEEK_START?: string;
  /** 周结束日期 */
  WEEK_END?: string;
  /** 项目名称 */
  PROJECT_NAME?: string;
  /** GitHub Repo URL */
  GITHUB_REPO?: string;
  /** 自定义变量 */
  [key: string]: string | undefined;
}

/** 模板类型 */
export type TemplateType = 'daily' | 'weekly' | 'project';

// ============================================
// Variable Generation
// ============================================

/**
 * 从日期生成标准变量
 * @param date 日期对象或字符串
 * @returns 变量对象
 */
export function generateDateVariables(date: Date | string = new Date()): TemplateVariables {
  const d = typeof date === 'string' ? new Date(date) : date;

  const year = getYear(d);
  const week = getISOWeek(d);
  const weekStart = startOfWeek(d, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(d, { weekStartsOn: 1 });

  return {
    DATE: format(d, 'yyyy-MM-dd'),
    YEAR: String(year),
    MONTH: format(d, 'MM'),
    DAY: format(d, 'dd'),
    WEEK: `${year}-W${String(week).padStart(2, '0')}`,
    WEEK_START: format(weekStart, 'yyyy-MM-dd'),
    WEEK_END: format(weekEnd, 'yyyy-MM-dd'),
  };
}

/**
 * 从周标识生成变量
 * @param weekStr 周标识 (YYYY-Www)
 * @returns 变量对象
 */
export function generateWeekVariables(weekStr: string): TemplateVariables {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week format: ${weekStr}. Expected YYYY-Www`);
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // 计算该周的第一天（周一）
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    WEEK: weekStr,
    YEAR: String(year),
    WEEK_START: format(weekStart, 'yyyy-MM-dd'),
    WEEK_END: format(weekEnd, 'yyyy-MM-dd'),
  };
}

/**
 * 生成项目变量
 * @param name 项目名称
 * @param githubRepo GitHub Repo URL
 * @returns 变量对象
 */
export function generateProjectVariables(
  name: string,
  githubRepo: string
): TemplateVariables {
  return {
    ...generateDateVariables(),
    PROJECT_NAME: name,
    GITHUB_REPO: githubRepo,
  };
}

// ============================================
// Template Processing
// ============================================

/**
 * 替换模板中的变量
 * @param template 模板字符串
 * @param variables 变量对象
 * @returns 替换后的字符串
 */
export function replaceVariables(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? value : match;
  });
}

/**
 * 获取模板中的所有变量名
 * @param template 模板字符串
 * @returns 变量名列表
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

// ============================================
// Template Loading
// ============================================

/** 内置 Daily 模板 */
const BUILTIN_DAILY_TEMPLATE = `---
date: {{DATE}}
type: daily
week: {{WEEK}}
projects: []
tags: []
weekly_highlight: false
github:
  issues: []
  prs: []
---

# {{DATE}} Daily Log

## 今日计划
- [ ]

## 今日完成
-

## 项目进展
-

## 问题 / 风险
-

## 备注
-
`;

/** 内置 Weekly 模板 */
const BUILTIN_WEEKLY_TEMPLATE = `---
week: {{WEEK}}
type: weekly
start_date: {{WEEK_START}}
end_date: {{WEEK_END}}
projects: []
---

# Week {{WEEK}} 工作周报

## 本周总结（一句话）


## 本周重点产出（Highlights）
<!-- 自动从 daily.weekly_highlight = true 聚合 -->

## 项目进展

### Project A
- 本周进展：
- 当前状态：
- 下周计划：

## 风险与阻塞
-

## 下周计划
-
`;

/** 内置 Project 模板 */
const BUILTIN_PROJECT_TEMPLATE = `---
project:
  name: {{PROJECT_NAME}}
  type: software
  github_repo: {{GITHUB_REPO}}
  status: Planning
  start_date: {{DATE}}
---

# {{PROJECT_NAME}}

## 项目目标


## 当前阶段说明


## 里程碑 / Issue 规划
-

## 最近进展（自动聚合）
<!-- 最近 N 周 Weekly / Daily -->

## 相关链接
- GitHub Repo: {{GITHUB_REPO}}
`;

/** 内置模板映射 */
const BUILTIN_TEMPLATES: Record<TemplateType, string> = {
  daily: BUILTIN_DAILY_TEMPLATE,
  weekly: BUILTIN_WEEKLY_TEMPLATE,
  project: BUILTIN_PROJECT_TEMPLATE,
};

/**
 * 加载模板
 * 优先从 workspace 的 templates 目录加载，如果不存在则使用内置模板
 * @param workspacePath workspace 路径
 * @param templateType 模板类型
 * @returns 模板字符串
 */
export async function loadTemplate(
  workspacePath: string,
  templateType: TemplateType
): Promise<string> {
  const templatePath = getTemplateFilePath(workspacePath, templateType);

  if (await exists(templatePath)) {
    return readFile(templatePath);
  }

  // 使用内置模板
  const builtin = BUILTIN_TEMPLATES[templateType];
  if (!builtin) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  return builtin;
}

/**
 * 加载并渲染模板
 * @param workspacePath workspace 路径
 * @param templateType 模板类型
 * @param variables 变量对象
 * @returns 渲染后的内容
 */
export async function renderTemplate(
  workspacePath: string,
  templateType: TemplateType,
  variables: TemplateVariables
): Promise<string> {
  const template = await loadTemplate(workspacePath, templateType);
  return replaceVariables(template, variables);
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 渲染 Daily Log 模板
 * @param workspacePath workspace 路径
 * @param date 日期（默认今天）
 * @returns 渲染后的内容
 */
export async function renderDailyTemplate(
  workspacePath: string,
  date: Date | string = new Date()
): Promise<string> {
  const variables = generateDateVariables(date);
  return renderTemplate(workspacePath, 'daily', variables);
}

/**
 * 渲染 Weekly Report 模板
 * @param workspacePath workspace 路径
 * @param week 周标识（默认当前周）
 * @returns 渲染后的内容
 */
export async function renderWeeklyTemplate(
  workspacePath: string,
  week?: string
): Promise<string> {
  const variables = week
    ? generateWeekVariables(week)
    : generateDateVariables();
  return renderTemplate(workspacePath, 'weekly', variables);
}

/**
 * 渲染 Project 模板
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @param githubRepo GitHub Repo URL
 * @returns 渲染后的内容
 */
export async function renderProjectTemplate(
  workspacePath: string,
  name: string,
  githubRepo: string
): Promise<string> {
  const variables = generateProjectVariables(name, githubRepo);
  return renderTemplate(workspacePath, 'project', variables);
}

// ============================================
// Template File Management
// ============================================

/**
 * 获取内置模板内容
 * @param templateType 模板类型
 * @returns 模板内容
 */
export function getBuiltinTemplate(templateType: TemplateType): string {
  const template = BUILTIN_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }
  return template;
}

/**
 * 获取所有模板类型
 * @returns 模板类型列表
 */
export function getTemplateTypes(): TemplateType[] {
  return ['daily', 'weekly', 'project'];
}
