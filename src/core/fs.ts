/**
 * File System Abstraction
 * 文件系统操作封装，处理 workspace 目录结构
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

// ============================================
// Types
// ============================================

/** 目录结构定义 */
export interface WorkspaceDirectories {
  daily: string;
  weekly: string;
  projects: string;
  templates: string;
  scripts: string;
  slides: string;
}

/** 文件信息 */
export interface FileInfo {
  path: string;
  name: string;
  ext: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}

// ============================================
// Constants
// ============================================

/** 默认目录结构 */
export const DEFAULT_DIRECTORIES: WorkspaceDirectories = {
  daily: 'daily',
  weekly: 'weekly',
  projects: 'projects',
  templates: 'templates',
  scripts: 'scripts',
  slides: 'slides',
};

/** 配置文件名 */
export const CONFIG_FILE_NAME = '.pwork.json';

// ============================================
// Path Utilities
// ============================================

/**
 * 获取 workspace 根目录的绝对路径
 * @param workspacePath workspace 路径
 * @returns 绝对路径
 */
export function resolveWorkspacePath(workspacePath: string): string {
  return path.resolve(workspacePath);
}

/**
 * 获取某个目录的完整路径
 * @param workspacePath workspace 路径
 * @param directory 目录名称
 * @returns 完整路径
 */
export function getDirectoryPath(
  workspacePath: string,
  directory: keyof WorkspaceDirectories
): string {
  const dirs = DEFAULT_DIRECTORIES;
  return path.join(resolveWorkspacePath(workspacePath), dirs[directory]);
}

/**
 * 获取 Daily Log 文件路径
 * @param workspacePath workspace 路径
 * @param date 日期 (YYYY-MM-DD)
 * @returns 文件路径
 */
export function getDailyFilePath(workspacePath: string, date: string): string {
  return path.join(getDirectoryPath(workspacePath, 'daily'), `${date}.md`);
}

/**
 * 获取 Weekly Report 文件路径
 * @param workspacePath workspace 路径
 * @param week 周标识 (YYYY-Www)
 * @returns 文件路径
 */
export function getWeeklyFilePath(workspacePath: string, week: string): string {
  return path.join(getDirectoryPath(workspacePath, 'weekly'), `${week}.md`);
}

/**
 * 获取 Project 文件路径
 * @param workspacePath workspace 路径
 * @param projectName 项目名称（slug 格式）
 * @returns 文件路径
 */
export function getProjectFilePath(
  workspacePath: string,
  projectName: string
): string {
  const slug = slugify(projectName);
  return path.join(getDirectoryPath(workspacePath, 'projects'), `${slug}.md`);
}

/**
 * 获取模板文件路径
 * @param workspacePath workspace 路径
 * @param templateName 模板名称
 * @returns 文件路径
 */
export function getTemplateFilePath(
  workspacePath: string,
  templateName: string
): string {
  return path.join(
    getDirectoryPath(workspacePath, 'templates'),
    `${templateName}.md`
  );
}

/**
 * 获取自定义 CSS 文件路径
 * @param workspacePath workspace 路径
 * @param cssName CSS 文件名 (不含扩展名)
 * @returns CSS 文件路径
 */
export function getCustomCssPath(
  workspacePath: string,
  cssName: string
): string {
  return path.join(
    getDirectoryPath(workspacePath, 'templates'),
    `${cssName}.css`
  );
}

/**
 * 获取配置文件路径
 * @param workspacePath workspace 路径
 * @returns 配置文件路径
 */
export function getConfigFilePath(workspacePath: string): string {
  return path.join(resolveWorkspacePath(workspacePath), CONFIG_FILE_NAME);
}

/**
 * 获取 Slides 输出文件路径
 * @param workspacePath workspace 路径
 * @param filename 文件名（如 weekly-2026-W03.html）
 * @returns 文件路径
 */
export function getSlidesOutputPath(
  workspacePath: string,
  filename: string
): string {
  return path.join(getDirectoryPath(workspacePath, 'slides'), filename);
}

// ============================================
// File Operations
// ============================================

/**
 * 检查文件或目录是否存在
 * @param filePath 文件路径
 * @returns 是否存在
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取文件内容
 * @param filePath 文件路径
 * @returns 文件内容
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * 写入文件内容
 * @param filePath 文件路径
 * @param content 文件内容
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  // 确保目录存在
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * 删除文件
 * @param filePath 文件路径
 */
export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

/**
 * 读取 JSON 文件
 * @param filePath 文件路径
 * @returns 解析后的对象
 */
export async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath);
  return JSON.parse(content) as T;
}

/**
 * 写入 JSON 文件
 * @param filePath 文件路径
 * @param data 数据对象
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await writeFile(filePath, content);
}

/**
 * 获取文件信息
 * @param filePath 文件路径
 * @returns 文件信息
 */
export async function getFileInfo(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath);
  const parsed = path.parse(filePath);

  return {
    path: filePath,
    name: parsed.name,
    ext: parsed.ext,
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
}

// ============================================
// Directory Operations
// ============================================

/**
 * 创建目录（递归）
 * @param dirPath 目录路径
 */
export async function createDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 列出目录中的文件
 * @param dirPath 目录路径
 * @param pattern 文件匹配模式（glob）
 * @returns 文件路径列表
 */
export async function listFiles(
  dirPath: string,
  pattern: string = '*.md'
): Promise<string[]> {
  const fullPattern = path.join(dirPath, pattern);
  return glob(fullPattern, { nodir: true });
}

/**
 * 列出目录中的所有 Markdown 文件信息
 * @param dirPath 目录路径
 * @returns 文件信息列表
 */
export async function listMarkdownFiles(dirPath: string): Promise<FileInfo[]> {
  const files = await listFiles(dirPath, '*.md');
  return Promise.all(files.map(getFileInfo));
}

/**
 * 初始化 workspace 目录结构
 * @param workspacePath workspace 路径
 */
export async function initWorkspaceDirectories(
  workspacePath: string
): Promise<void> {
  const root = resolveWorkspacePath(workspacePath);

  // 创建所有子目录
  const directories = Object.values(DEFAULT_DIRECTORIES);
  await Promise.all(
    directories.map((dir) => createDirectory(path.join(root, dir)))
  );
}

/**
 * 检查是否为有效的 workspace
 * @param workspacePath workspace 路径
 * @returns 是否有效
 */
export async function isValidWorkspace(workspacePath: string): Promise<boolean> {
  const configPath = getConfigFilePath(workspacePath);
  return exists(configPath);
}

// ============================================
// Query Operations
// ============================================

/**
 * 列出所有 Daily Log 文件
 * @param workspacePath workspace 路径
 * @returns 文件信息列表（按日期降序）
 */
export async function listDailyFiles(
  workspacePath: string
): Promise<FileInfo[]> {
  const dailyDir = getDirectoryPath(workspacePath, 'daily');

  if (!(await exists(dailyDir))) {
    return [];
  }

  const files = await listMarkdownFiles(dailyDir);

  // 按文件名（日期）降序排序
  return files.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * 列出所有 Weekly Report 文件
 * @param workspacePath workspace 路径
 * @returns 文件信息列表（按周降序）
 */
export async function listWeeklyFiles(
  workspacePath: string
): Promise<FileInfo[]> {
  const weeklyDir = getDirectoryPath(workspacePath, 'weekly');

  if (!(await exists(weeklyDir))) {
    return [];
  }

  const files = await listMarkdownFiles(weeklyDir);

  // 按文件名（周）降序排序
  return files.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * 列出所有 Project 文件
 * @param workspacePath workspace 路径
 * @returns 文件信息列表
 */
export async function listProjectFiles(
  workspacePath: string
): Promise<FileInfo[]> {
  const projectsDir = getDirectoryPath(workspacePath, 'projects');

  if (!(await exists(projectsDir))) {
    return [];
  }

  return listMarkdownFiles(projectsDir);
}

/**
 * 按日期范围查找 Daily Log 文件
 * @param workspacePath workspace 路径
 * @param startDate 起始日期
 * @param endDate 结束日期
 * @returns 文件路径列表
 */
export async function findDailyFilesByDateRange(
  workspacePath: string,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const files = await listDailyFiles(workspacePath);

  return files
    .filter((f) => f.name >= startDate && f.name <= endDate)
    .map((f) => f.path);
}

// ============================================
// Utilities
// ============================================

/**
 * 将字符串转换为 slug 格式
 * @param text 原始字符串
 * @returns slug 格式的字符串
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // 空格和下划线转为连字符
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, '') // 移除非法字符（保留中文）
    .replace(/--+/g, '-') // 多个连字符合并
    .replace(/^-+|-+$/g, ''); // 移除首尾连字符
}

/**
 * 从文件名提取日期
 * @param filename 文件名（如 2026-01-17.md）
 * @returns 日期字符串
 */
export function extractDateFromFilename(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

/**
 * 从文件名提取周标识
 * @param filename 文件名（如 2026-W03.md）
 * @returns 周标识字符串
 */
export function extractWeekFromFilename(filename: string): string {
  const match = filename.match(/(\d{4}-W\d{2})/);
  return match ? match[1] : '';
}
