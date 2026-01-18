/**
 * GitHub API Client
 * 封装 Octokit 的 GitHub API 访问
 */

import { Octokit } from '@octokit/rest';
import { getGitHubToken } from '../core/config.js';

// ============================================
// Types
// ============================================

/** GitHub Issue 信息 */
export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  body: string | null;
}

/** GitHub Pull Request 信息 */
export interface GitHubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  labels: string[];
  assignees: string[];
  head: string;
  base: string;
  draft: boolean;
  body: string | null;
}

/** GitHub Milestone 信息 */
export interface GitHubMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  url: string;
  dueOn: string | null;
  openIssues: number;
  closedIssues: number;
}

/** GitHub Repository 信息 */
export interface GitHubRepository {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 分页选项 */
export interface PaginationOptions {
  page?: number;
  perPage?: number;
}

/** Issue 过滤选项 */
export interface IssueFilterOptions extends PaginationOptions {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  milestone?: string | number;
  since?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
}

/** PR 过滤选项 */
export interface PullRequestFilterOptions extends PaginationOptions {
  state?: 'open' | 'closed' | 'all';
  head?: string;
  base?: string;
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
}

// ============================================
// Client Class
// ============================================

/**
 * GitHub API 客户端
 */
export class GitHubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'pwork-os/0.1.0',
    });
  }

  // ============================================
  // Repository Operations
  // ============================================

  /**
   * 获取仓库信息
   * @param owner 所有者
   * @param repo 仓库名
   * @returns 仓库信息
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const { data } = await this.octokit.repos.get({ owner, repo });

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      url: data.html_url,
      homepage: data.homepage,
      language: data.language,
      defaultBranch: data.default_branch,
      isPrivate: data.private,
      stargazersCount: data.stargazers_count,
      forksCount: data.forks_count,
      openIssuesCount: data.open_issues_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * 检查仓库是否存在
   * @param owner 所有者
   * @param repo 仓库名
   * @returns 是否存在
   */
  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({ owner, repo });
      return true;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return false;
      }
      throw error;
    }
  }

  // ============================================
  // Issue Operations
  // ============================================

  /**
   * 获取单个 Issue
   * @param owner 所有者
   * @param repo 仓库名
   * @param issueNumber Issue 编号
   * @returns Issue 信息
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
    const { data } = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return this.transformIssue(data);
  }

  /**
   * 获取仓库的 Issue 列表
   * @param owner 所有者
   * @param repo 仓库名
   * @param options 过滤选项
   * @returns Issue 列表
   */
  async listIssues(
    owner: string,
    repo: string,
    options: IssueFilterOptions = {}
  ): Promise<GitHubIssue[]> {
    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: options.state || 'all',
      labels: options.labels?.join(','),
      assignee: options.assignee,
      milestone: options.milestone?.toString(),
      since: options.since,
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      page: options.page || 1,
      per_page: options.perPage || 100,
    });

    // 过滤掉 PR（GitHub API 会把 PR 也返回在 issues 中）
    return data
      .filter((item) => !item.pull_request)
      .map((item) => this.transformIssue(item));
  }

  /**
   * 获取所有 Issue（自动分页）
   * @param owner 所有者
   * @param repo 仓库名
   * @param options 过滤选项
   * @returns Issue 列表
   */
  async listAllIssues(
    owner: string,
    repo: string,
    options: Omit<IssueFilterOptions, 'page' | 'perPage'> = {}
  ): Promise<GitHubIssue[]> {
    const allIssues: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const issues = await this.listIssues(owner, repo, {
        ...options,
        page,
        perPage,
      });

      if (issues.length === 0) break;

      allIssues.push(...issues);

      if (issues.length < perPage) break;
      page++;
    }

    return allIssues;
  }

  // ============================================
  // Pull Request Operations
  // ============================================

  /**
   * 获取单个 Pull Request
   * @param owner 所有者
   * @param repo 仓库名
   * @param prNumber PR 编号
   * @returns PR 信息
   */
  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubPullRequest> {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return this.transformPullRequest(data);
  }

  /**
   * 获取仓库的 PR 列表
   * @param owner 所有者
   * @param repo 仓库名
   * @param options 过滤选项
   * @returns PR 列表
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options: PullRequestFilterOptions = {}
  ): Promise<GitHubPullRequest[]> {
    const { data } = await this.octokit.pulls.list({
      owner,
      repo,
      state: options.state || 'all',
      head: options.head,
      base: options.base,
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      page: options.page || 1,
      per_page: options.perPage || 100,
    });

    return data.map((item) => this.transformPullRequest(item));
  }

  /**
   * 获取所有 PR（自动分页）
   * @param owner 所有者
   * @param repo 仓库名
   * @param options 过滤选项
   * @returns PR 列表
   */
  async listAllPullRequests(
    owner: string,
    repo: string,
    options: Omit<PullRequestFilterOptions, 'page' | 'perPage'> = {}
  ): Promise<GitHubPullRequest[]> {
    const allPRs: GitHubPullRequest[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const prs = await this.listPullRequests(owner, repo, {
        ...options,
        page,
        perPage,
      });

      if (prs.length === 0) break;

      allPRs.push(...prs);

      if (prs.length < perPage) break;
      page++;
    }

    return allPRs;
  }

  // ============================================
  // Milestone Operations
  // ============================================

  /**
   * 获取仓库的 Milestone 列表
   * @param owner 所有者
   * @param repo 仓库名
   * @param state 状态过滤
   * @returns Milestone 列表
   */
  async listMilestones(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<GitHubMilestone[]> {
    const { data } = await this.octokit.issues.listMilestones({
      owner,
      repo,
      state,
      sort: 'due_on',
      direction: 'asc',
      per_page: 100,
    });

    return data.map((item) => ({
      number: item.number,
      title: item.title,
      description: item.description,
      state: item.state as 'open' | 'closed',
      url: item.html_url,
      dueOn: item.due_on,
      openIssues: item.open_issues,
      closedIssues: item.closed_issues,
    }));
  }

  // ============================================
  // Transform Helpers
  // ============================================

  private transformIssue(data: {
    number: number;
    title: string;
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    labels: Array<{ name?: string } | string>;
    assignees?: Array<{ login: string }> | null;
    milestone?: { title: string } | null;
    body?: string | null;
  }): GitHubIssue {
    return {
      number: data.number,
      title: data.title,
      state: data.state as 'open' | 'closed',
      url: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      closedAt: data.closed_at,
      labels: data.labels.map((l) =>
        typeof l === 'string' ? l : l.name || ''
      ),
      assignees: data.assignees?.map((a) => a.login) || [],
      milestone: data.milestone?.title || null,
      body: data.body || null,
    };
  }

  private transformPullRequest(data: {
    number: number;
    title: string;
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    labels: Array<{ name?: string }>;
    assignees?: Array<{ login: string }> | null;
    head: { ref: string };
    base: { ref: string };
    draft?: boolean;
    body?: string | null;
  }): GitHubPullRequest {
    let state: 'open' | 'closed' | 'merged' = data.state as 'open' | 'closed';
    if (data.merged_at) {
      state = 'merged';
    }

    return {
      number: data.number,
      title: data.title,
      state,
      url: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      closedAt: data.closed_at,
      mergedAt: data.merged_at,
      labels: data.labels.map((l) => l.name || ''),
      assignees: data.assignees?.map((a) => a.login) || [],
      head: data.head.ref,
      base: data.base.ref,
      draft: data.draft || false,
      body: data.body || null,
    };
  }
}

// ============================================
// Factory Functions
// ============================================

/** 客户端单例缓存 */
let cachedClient: GitHubClient | null = null;
let cachedToken: string | null = null;

/**
 * 创建或获取 GitHub 客户端
 * 会自动从配置或环境变量获取 token
 * @returns GitHubClient 实例
 */
export async function getGitHubClient(): Promise<GitHubClient> {
  const token = await getGitHubToken();

  // 如果 token 变化了，重新创建客户端
  if (cachedClient && cachedToken === token) {
    return cachedClient;
  }

  cachedClient = new GitHubClient(token || undefined);
  cachedToken = token;
  return cachedClient;
}

/**
 * 创建新的 GitHub 客户端实例（不使用缓存）
 * @param token 可选的 token，不传则自动获取
 * @returns GitHubClient 实例
 */
export async function createGitHubClient(token?: string): Promise<GitHubClient> {
  const resolvedToken = token || (await getGitHubToken()) || undefined;
  return new GitHubClient(resolvedToken);
}
