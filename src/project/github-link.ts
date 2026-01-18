/**
 * Project GitHub Linking
 * 项目与 GitHub Repo 的关联功能
 */

import type { Project } from '../core/schema.js';
import { getProject, updateProject } from './index.js';

// ============================================
// Types
// ============================================

/** GitHub Repo 信息 */
export interface GitHubRepoInfo {
  /** 所有者（用户名或组织名） */
  owner: string;
  /** 仓库名 */
  repo: string;
  /** 完整 URL */
  url: string;
  /** API URL */
  apiUrl: string;
  /** Clone URL (HTTPS) */
  cloneUrl: string;
  /** Clone URL (SSH) */
  sshUrl: string;
}

/** GitHub Issue/PR 链接信息 */
export interface GitHubLinkInfo {
  /** 所有者 */
  owner: string;
  /** 仓库名 */
  repo: string;
  /** Issue/PR 编号 */
  number: number;
  /** 类型 */
  type: 'issue' | 'pull';
  /** 完整 URL */
  url: string;
}

// ============================================
// URL Parsing
// ============================================

/**
 * 解析 GitHub Repo URL
 * 支持格式：
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo
 * @param url GitHub URL 或简写
 * @returns GitHubRepoInfo 对象，如果解析失败则返回 null
 */
export function parseGitHubRepoUrl(url: string): GitHubRepoInfo | null {
  if (!url) return null;

  let owner: string;
  let repo: string;

  // 简写格式: owner/repo
  const shortMatch = url.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    owner = shortMatch[1];
    repo = shortMatch[2].replace(/\.git$/, '');
  } else {
    // HTTPS 格式: https://github.com/owner/repo
    const httpsMatch = url.match(
      /^https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/
    );
    if (httpsMatch) {
      owner = httpsMatch[1];
      repo = httpsMatch[2];
    } else {
      // SSH 格式: git@github.com:owner/repo.git
      const sshMatch = url.match(
        /^git@github\.com:([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/
      );
      if (sshMatch) {
        owner = sshMatch[1];
        repo = sshMatch[2];
      } else {
        return null;
      }
    }
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    apiUrl: `https://api.github.com/repos/${owner}/${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    sshUrl: `git@github.com:${owner}/${repo}.git`,
  };
}

/**
 * 解析 GitHub Issue/PR URL
 * 支持格式：
 * - https://github.com/owner/repo/issues/123
 * - https://github.com/owner/repo/pull/456
 * - owner/repo#123
 * @param url GitHub Issue/PR URL 或简写
 * @returns GitHubLinkInfo 对象，如果解析失败则返回 null
 */
export function parseGitHubLinkUrl(url: string): GitHubLinkInfo | null {
  if (!url) return null;

  // 完整 URL 格式
  const fullMatch = url.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)\/(issues|pull)\/(\d+)/
  );
  if (fullMatch) {
    const [, owner, repo, typeStr, numStr] = fullMatch;
    const type = typeStr === 'pull' ? 'pull' : 'issue';
    const number = parseInt(numStr, 10);
    return {
      owner,
      repo,
      number,
      type,
      url: `https://github.com/${owner}/${repo}/${typeStr}/${number}`,
    };
  }

  // 简写格式: owner/repo#123
  const shortMatch = url.match(
    /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)#(\d+)$/
  );
  if (shortMatch) {
    const [, owner, repo, numStr] = shortMatch;
    const number = parseInt(numStr, 10);
    // 简写格式默认为 issue
    return {
      owner,
      repo,
      number,
      type: 'issue',
      url: `https://github.com/${owner}/${repo}/issues/${number}`,
    };
  }

  return null;
}

/**
 * 验证 GitHub Repo URL 是否有效
 * @param url URL 字符串
 * @returns 是否有效
 */
export function isValidGitHubRepoUrl(url: string): boolean {
  return parseGitHubRepoUrl(url) !== null;
}

/**
 * 规范化 GitHub Repo URL 为标准 HTTPS 格式
 * @param url 任意格式的 GitHub URL
 * @returns 标准 HTTPS URL，如果无效则返回原值
 */
export function normalizeGitHubRepoUrl(url: string): string {
  const info = parseGitHubRepoUrl(url);
  return info ? info.url : url;
}

// ============================================
// URL Generation
// ============================================

/**
 * 生成 GitHub Repo URL
 * @param owner 所有者
 * @param repo 仓库名
 * @returns HTTPS URL
 */
export function buildGitHubRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * 生成 GitHub Issue URL
 * @param owner 所有者
 * @param repo 仓库名
 * @param number Issue 编号
 * @returns Issue URL
 */
export function buildGitHubIssueUrl(
  owner: string,
  repo: string,
  number: number
): string {
  return `https://github.com/${owner}/${repo}/issues/${number}`;
}

/**
 * 生成 GitHub PR URL
 * @param owner 所有者
 * @param repo 仓库名
 * @param number PR 编号
 * @returns PR URL
 */
export function buildGitHubPRUrl(
  owner: string,
  repo: string,
  number: number
): string {
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

/**
 * 生成 GitHub 文件 URL
 * @param owner 所有者
 * @param repo 仓库名
 * @param path 文件路径
 * @param branch 分支（默认 main）
 * @returns 文件 URL
 */
export function buildGitHubFileUrl(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main'
): string {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
}

// ============================================
// Project Linking Operations
// ============================================

/**
 * 获取项目的 GitHub Repo 信息
 * @param workspacePath workspace 路径
 * @param projectName 项目名称
 * @returns GitHubRepoInfo 对象，如果无效则返回 null
 */
export async function getProjectGitHubInfo(
  workspacePath: string,
  projectName: string
): Promise<GitHubRepoInfo | null> {
  const project = await getProject(workspacePath, projectName);
  if (!project) return null;

  return parseGitHubRepoUrl(project.meta.project.github_repo);
}

/**
 * 更新项目的 GitHub Repo 链接
 * @param workspacePath workspace 路径
 * @param projectName 项目名称
 * @param repoUrl 新的 GitHub Repo URL
 * @returns 更新后的 Project
 */
export async function linkProjectToGitHub(
  workspacePath: string,
  projectName: string,
  repoUrl: string
): Promise<Project> {
  // 验证并规范化 URL
  const normalizedUrl = normalizeGitHubRepoUrl(repoUrl);
  if (!isValidGitHubRepoUrl(normalizedUrl)) {
    throw new Error(`Invalid GitHub repo URL: ${repoUrl}`);
  }

  return updateProject(workspacePath, projectName, {
    project: { github_repo: normalizedUrl },
  });
}

/**
 * 从 GitHub URL 提取项目可用的短名称
 * @param url GitHub Repo URL
 * @returns 仓库名称
 */
export function extractRepoNameFromUrl(url: string): string | null {
  const info = parseGitHubRepoUrl(url);
  return info ? info.repo : null;
}

/**
 * 检查两个 GitHub URL 是否指向同一个仓库
 * @param url1 第一个 URL
 * @param url2 第二个 URL
 * @returns 是否相同
 */
export function isSameGitHubRepo(url1: string, url2: string): boolean {
  const info1 = parseGitHubRepoUrl(url1);
  const info2 = parseGitHubRepoUrl(url2);

  if (!info1 || !info2) return false;

  return (
    info1.owner.toLowerCase() === info2.owner.toLowerCase() &&
    info1.repo.toLowerCase() === info2.repo.toLowerCase()
  );
}
