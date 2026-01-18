/**
 * Project Module
 * Project 的创建、编辑、查询、状态管理
 */

import { format } from 'date-fns';
import type {
  Project,
  ProjectInfo,
  ProjectQuery,
  ProjectStatus,
  ProjectType,
  CreateProjectInput,
} from '../core/schema.js';
import { isProjectStatus, isProjectType } from '../core/schema.js';
import {
  getProjectFilePath,
  listProjectFiles,
  slugify,
  exists,
  readFile,
  writeFile,
  deleteFile,
} from '../core/fs.js';
import { parseProject, serializeProject } from '../core/parser.js';
import { renderProjectTemplate } from '../template/engine.js';

// ============================================
// CRUD Operations
// ============================================

/**
 * 创建新的 Project
 * @param workspacePath workspace 路径
 * @param input 创建参数
 * @returns 创建的 Project 对象
 */
export async function createProject(
  workspacePath: string,
  input: CreateProjectInput
): Promise<Project> {
  const { name, github_repo, type, status, start_date } = input;

  if (!name || !name.trim()) {
    throw new Error('Project name is required');
  }

  if (!github_repo || !github_repo.trim()) {
    throw new Error('GitHub repo URL is required');
  }

  const filePath = getProjectFilePath(workspacePath, name);

  // 检查是否已存在
  if (await exists(filePath)) {
    throw new Error(`Project already exists: ${name}`);
  }

  // 使用模板渲染初始内容
  const content = await renderProjectTemplate(workspacePath, name, github_repo);

  // 解析渲染后的内容
  const project = parseProject(content, filePath);

  // 应用额外的输入参数
  if (type && isProjectType(type)) {
    project.meta.project.type = type;
  }
  if (status && isProjectStatus(status)) {
    project.meta.project.status = status;
  }
  if (start_date) {
    project.meta.project.start_date = start_date;
  }

  // 写入文件
  await writeFile(filePath, serializeProject(project));

  return project;
}

/**
 * 获取指定名称的 Project
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @returns Project 对象，如果不存在则返回 null
 */
export async function getProject(
  workspacePath: string,
  name: string
): Promise<Project | null> {
  const filePath = getProjectFilePath(workspacePath, name);

  if (!(await exists(filePath))) {
    return null;
  }

  const content = await readFile(filePath);
  return parseProject(content, filePath);
}

/**
 * 通过 slug 获取 Project
 * @param workspacePath workspace 路径
 * @param slug 项目 slug
 * @returns Project 对象，如果不存在则返回 null
 */
export async function getProjectBySlug(
  workspacePath: string,
  slug: string
): Promise<Project | null> {
  const projects = await listProjects(workspacePath);
  return projects.find((p) => slugify(p.meta.project.name) === slug) || null;
}

/** 项目更新参数 */
interface ProjectUpdates {
  /** 项目信息更新（部分） */
  project?: Partial<ProjectInfo>;
  /** 正文内容更新 */
  content?: string;
}

/**
 * 更新 Project
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @param updates 更新内容
 * @returns 更新后的 Project
 */
export async function updateProject(
  workspacePath: string,
  name: string,
  updates: ProjectUpdates
): Promise<Project> {
  const project = await getProject(workspacePath, name);

  if (!project) {
    throw new Error(`Project not found: ${name}`);
  }

  // 应用更新
  if (updates.project) {
    project.meta.project = { ...project.meta.project, ...updates.project };
  }
  if (updates.content !== undefined) {
    project.content = updates.content;
  }

  // 写入文件
  await writeFile(project.filePath, serializeProject(project));

  return project;
}

/**
 * 删除 Project
 * @param workspacePath workspace 路径
 * @param name 项目名称
 */
export async function deleteProject(
  workspacePath: string,
  name: string
): Promise<void> {
  const filePath = getProjectFilePath(workspacePath, name);

  if (!(await exists(filePath))) {
    throw new Error(`Project not found: ${name}`);
  }

  await deleteFile(filePath);
}

// ============================================
// Query Operations
// ============================================

/**
 * 列出所有 Project
 * @param workspacePath workspace 路径
 * @returns Project 列表
 */
export async function listProjects(workspacePath: string): Promise<Project[]> {
  const files = await listProjectFiles(workspacePath);
  const projects: Project[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file.path);
      projects.push(parseProject(content, file.path));
    } catch (error) {
      // 跳过解析失败的文件
      console.warn(`Failed to parse project: ${file.path}`, error);
    }
  }

  // 按名称排序
  return projects.sort((a, b) =>
    a.meta.project.name.localeCompare(b.meta.project.name)
  );
}

/**
 * 按条件查询 Project
 * @param workspacePath workspace 路径
 * @param query 查询条件
 * @returns 符合条件的 Project 列表
 */
export async function queryProjects(
  workspacePath: string,
  query: ProjectQuery
): Promise<Project[]> {
  const projects = await listProjects(workspacePath);

  return projects.filter((project) => {
    const info = project.meta.project;

    // 状态过滤
    if (query.status && info.status !== query.status) {
      return false;
    }

    // 类型过滤
    if (query.type && info.type !== query.type) {
      return false;
    }

    // 名称模糊搜索
    if (query.nameContains) {
      const pattern = query.nameContains.toLowerCase();
      if (!info.name.toLowerCase().includes(pattern)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 获取活跃项目（Doing 状态）
 * @param workspacePath workspace 路径
 * @returns 活跃 Project 列表
 */
export async function getActiveProjects(
  workspacePath: string
): Promise<Project[]> {
  return queryProjects(workspacePath, { status: 'Doing' });
}

/**
 * 获取阻塞项目
 * @param workspacePath workspace 路径
 * @returns 阻塞 Project 列表
 */
export async function getBlockedProjects(
  workspacePath: string
): Promise<Project[]> {
  return queryProjects(workspacePath, { status: 'Blocked' });
}

// ============================================
// Status Management
// ============================================

/**
 * 更新项目状态
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @param status 新状态
 * @returns 更新后的 Project
 */
export async function updateProjectStatus(
  workspacePath: string,
  name: string,
  status: ProjectStatus
): Promise<Project> {
  if (!isProjectStatus(status)) {
    throw new Error(`Invalid project status: ${status}`);
  }

  const project = await getProject(workspacePath, name);
  if (!project) {
    throw new Error(`Project not found: ${name}`);
  }

  project.meta.project.status = status;

  // 如果状态变为 Done，设置结束日期
  if (status === 'Done' && !project.meta.project.end_date) {
    project.meta.project.end_date = format(new Date(), 'yyyy-MM-dd');
  }

  await writeFile(project.filePath, serializeProject(project));

  return project;
}

/**
 * 开始项目（Planning -> Doing）
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @returns 更新后的 Project
 */
export async function startProject(
  workspacePath: string,
  name: string
): Promise<Project> {
  return updateProjectStatus(workspacePath, name, 'Doing');
}

/**
 * 阻塞项目
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @returns 更新后的 Project
 */
export async function blockProject(
  workspacePath: string,
  name: string
): Promise<Project> {
  return updateProjectStatus(workspacePath, name, 'Blocked');
}

/**
 * 完成项目
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @returns 更新后的 Project
 */
export async function completeProject(
  workspacePath: string,
  name: string
): Promise<Project> {
  return updateProjectStatus(workspacePath, name, 'Done');
}

/**
 * 恢复项目（从 Blocked 或 Done 状态恢复到 Doing）
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @returns 更新后的 Project
 */
export async function resumeProject(
  workspacePath: string,
  name: string
): Promise<Project> {
  const project = await getProject(workspacePath, name);
  if (!project) {
    throw new Error(`Project not found: ${name}`);
  }

  // 清除结束日期（如果从 Done 恢复）
  if (project.meta.project.status === 'Done') {
    project.meta.project.end_date = undefined;
  }

  project.meta.project.status = 'Doing';
  await writeFile(project.filePath, serializeProject(project));

  return project;
}

// ============================================
// Project Info Updates
// ============================================

/**
 * 更新项目类型
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @param type 新类型
 * @returns 更新后的 Project
 */
export async function updateProjectType(
  workspacePath: string,
  name: string,
  type: ProjectType
): Promise<Project> {
  if (!isProjectType(type)) {
    throw new Error(`Invalid project type: ${type}`);
  }

  return updateProject(workspacePath, name, {
    project: { type },
  });
}

/**
 * 更新项目 GitHub Repo
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @param githubRepo 新的 GitHub Repo URL
 * @returns 更新后的 Project
 */
export async function updateProjectGitHubRepo(
  workspacePath: string,
  name: string,
  githubRepo: string
): Promise<Project> {
  return updateProject(workspacePath, name, {
    project: { github_repo: githubRepo },
  });
}

// ============================================
// Statistics
// ============================================

/**
 * 获取 Project 统计信息
 * @param workspacePath workspace 路径
 * @returns 统计信息
 */
export async function getProjectStats(
  workspacePath: string
): Promise<{
  total: number;
  byStatus: Record<ProjectStatus, number>;
  byType: Record<ProjectType, number>;
}> {
  const projects = await listProjects(workspacePath);

  const stats = {
    total: projects.length,
    byStatus: {
      Planning: 0,
      Doing: 0,
      Blocked: 0,
      Done: 0,
    } as Record<ProjectStatus, number>,
    byType: {
      software: 0,
      research: 0,
      hybrid: 0,
      misc: 0,
    } as Record<ProjectType, number>,
  };

  for (const project of projects) {
    const info = project.meta.project;
    stats.byStatus[info.status]++;
    stats.byType[info.type]++;
  }

  return stats;
}

// ============================================
// Utilities
// ============================================

/**
 * 检查项目名称是否已存在
 * @param workspacePath workspace 路径
 * @param name 项目名称
 * @returns 是否存在
 */
export async function projectExists(
  workspacePath: string,
  name: string
): Promise<boolean> {
  const filePath = getProjectFilePath(workspacePath, name);
  return exists(filePath);
}

/**
 * 获取项目的 slug
 * @param name 项目名称
 * @returns slug
 */
export function getProjectSlug(name: string): string {
  return slugify(name);
}

// Re-export useful types and functions
export { slugify } from '../core/fs.js';
export type { ProjectStatus, ProjectType } from '../core/schema.js';
export { isProjectStatus, isProjectType } from '../core/schema.js';
