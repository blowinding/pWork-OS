/**
 * GitHub Sync Module
 * 同步 GitHub Issue/PR/Milestone 信息到 Project
 */

import { getProject, updateProject } from '../project/index.js';
import { parseGitHubRepoUrl } from '../project/github-link.js';
import {
  getGitHubClient,
  type GitHubIssue,
  type GitHubPullRequest,
  type GitHubMilestone,
} from './client.js';

// ============================================
// Types
// ============================================

/** 同步结果摘要 */
export interface SyncSummary {
  /** 仓库信息 */
  repository: {
    name: string;
    url: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
  };
  /** Issue 统计 */
  issues: {
    total: number;
    open: number;
    closed: number;
    items: GitHubIssue[];
  };
  /** PR 统计 */
  pullRequests: {
    total: number;
    open: number;
    merged: number;
    closed: number;
    items: GitHubPullRequest[];
  };
  /** Milestone 统计 */
  milestones: {
    total: number;
    open: number;
    closed: number;
    items: GitHubMilestone[];
  };
  /** 同步时间 */
  syncedAt: string;
}

/** 同步选项 */
export interface SyncOptions {
  /** 是否同步 Issues */
  syncIssues?: boolean;
  /** 是否同步 Pull Requests */
  syncPRs?: boolean;
  /** 是否同步 Milestones */
  syncMilestones?: boolean;
  /** Issue 状态过滤 */
  issueState?: 'open' | 'closed' | 'all';
  /** PR 状态过滤 */
  prState?: 'open' | 'closed' | 'all';
  /** 是否更新项目文件内容 */
  updateContent?: boolean;
  /** 最大 Issue 数量 */
  maxIssues?: number;
  /** 最大 PR 数量 */
  maxPRs?: number;
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  syncIssues: true,
  syncPRs: true,
  syncMilestones: true,
  issueState: 'all',
  prState: 'all',
  updateContent: true,
  maxIssues: 50,
  maxPRs: 50,
};

// ============================================
// Sync Functions
// ============================================

/**
 * 从 GitHub 获取项目同步数据
 * @param owner 仓库所有者
 * @param repo 仓库名
 * @param options 同步选项
 * @returns 同步摘要
 */
export async function fetchGitHubData(
  owner: string,
  repo: string,
  options: SyncOptions = {}
): Promise<SyncSummary> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const client = await getGitHubClient();

  // 获取仓库信息
  const repoInfo = await client.getRepository(owner, repo);

  // 并行获取数据
  const [issues, prs, milestones] = await Promise.all([
    opts.syncIssues
      ? client.listIssues(owner, repo, {
          state: opts.issueState,
          perPage: opts.maxIssues,
        })
      : Promise.resolve([]),
    opts.syncPRs
      ? client.listPullRequests(owner, repo, {
          state: opts.prState,
          perPage: opts.maxPRs,
        })
      : Promise.resolve([]),
    opts.syncMilestones
      ? client.listMilestones(owner, repo, 'all')
      : Promise.resolve([]),
  ]);

  // 统计数据
  const openIssues = issues.filter((i) => i.state === 'open').length;
  const openPRs = prs.filter((p) => p.state === 'open').length;
  const mergedPRs = prs.filter((p) => p.state === 'merged').length;
  const closedPRs = prs.filter((p) => p.state === 'closed').length;
  const openMilestones = milestones.filter((m) => m.state === 'open').length;

  return {
    repository: {
      name: repoInfo.fullName,
      url: repoInfo.url,
      description: repoInfo.description,
      language: repoInfo.language,
      stars: repoInfo.stargazersCount,
      forks: repoInfo.forksCount,
    },
    issues: {
      total: issues.length,
      open: openIssues,
      closed: issues.length - openIssues,
      items: issues,
    },
    pullRequests: {
      total: prs.length,
      open: openPRs,
      merged: mergedPRs,
      closed: closedPRs,
      items: prs,
    },
    milestones: {
      total: milestones.length,
      open: openMilestones,
      closed: milestones.length - openMilestones,
      items: milestones,
    },
    syncedAt: new Date().toISOString(),
  };
}

/**
 * 将同步数据格式化为 Markdown 内容
 * @param summary 同步摘要
 * @returns Markdown 字符串
 */
export function formatSyncContent(summary: SyncSummary): string {
  const lines: string[] = [];

  // 仓库信息
  lines.push(`## Repository Info`);
  lines.push('');
  if (summary.repository.description) {
    lines.push(`> ${summary.repository.description}`);
    lines.push('');
  }
  lines.push(`- **Language**: ${summary.repository.language || 'N/A'}`);
  lines.push(`- **Stars**: ${summary.repository.stars}`);
  lines.push(`- **Forks**: ${summary.repository.forks}`);
  lines.push('');

  // Milestones
  if (summary.milestones.total > 0) {
    lines.push(`## Milestones`);
    lines.push('');
    lines.push(
      `Total: ${summary.milestones.total} | Open: ${summary.milestones.open} | Closed: ${summary.milestones.closed}`
    );
    lines.push('');

    const openMilestones = summary.milestones.items.filter(
      (m) => m.state === 'open'
    );
    if (openMilestones.length > 0) {
      for (const milestone of openMilestones) {
        const progress =
          milestone.openIssues + milestone.closedIssues > 0
            ? Math.round(
                (milestone.closedIssues /
                  (milestone.openIssues + milestone.closedIssues)) *
                  100
              )
            : 0;
        const dueDate = milestone.dueOn
          ? ` (Due: ${milestone.dueOn.split('T')[0]})`
          : '';
        lines.push(
          `- [ ] **${milestone.title}** - ${progress}% complete${dueDate}`
        );
        if (milestone.description) {
          lines.push(`  - ${milestone.description}`);
        }
      }
      lines.push('');
    }
  }

  // Issues
  if (summary.issues.total > 0) {
    lines.push(`## Issues`);
    lines.push('');
    lines.push(
      `Total: ${summary.issues.total} | Open: ${summary.issues.open} | Closed: ${summary.issues.closed}`
    );
    lines.push('');

    // Open issues
    const openIssues = summary.issues.items.filter((i) => i.state === 'open');
    if (openIssues.length > 0) {
      lines.push('### Open Issues');
      lines.push('');
      for (const issue of openIssues.slice(0, 20)) {
        const labels =
          issue.labels.length > 0 ? ` [${issue.labels.join(', ')}]` : '';
        const assignees =
          issue.assignees.length > 0
            ? ` @${issue.assignees.join(', @')}`
            : '';
        lines.push(`- [ ] [#${issue.number}](${issue.url}) ${issue.title}${labels}${assignees}`);
      }
      if (openIssues.length > 20) {
        lines.push(`- ... and ${openIssues.length - 20} more`);
      }
      lines.push('');
    }

    // Recently closed issues (show last 5)
    const closedIssues = summary.issues.items
      .filter((i) => i.state === 'closed')
      .slice(0, 5);
    if (closedIssues.length > 0) {
      lines.push('### Recently Closed');
      lines.push('');
      for (const issue of closedIssues) {
        lines.push(`- [x] [#${issue.number}](${issue.url}) ${issue.title}`);
      }
      lines.push('');
    }
  }

  // Pull Requests
  if (summary.pullRequests.total > 0) {
    lines.push(`## Pull Requests`);
    lines.push('');
    lines.push(
      `Total: ${summary.pullRequests.total} | Open: ${summary.pullRequests.open} | Merged: ${summary.pullRequests.merged} | Closed: ${summary.pullRequests.closed}`
    );
    lines.push('');

    // Open PRs
    const openPRs = summary.pullRequests.items.filter((p) => p.state === 'open');
    if (openPRs.length > 0) {
      lines.push('### Open Pull Requests');
      lines.push('');
      for (const pr of openPRs.slice(0, 10)) {
        const draft = pr.draft ? ' (Draft)' : '';
        const labels =
          pr.labels.length > 0 ? ` [${pr.labels.join(', ')}]` : '';
        lines.push(`- [ ] [#${pr.number}](${pr.url}) ${pr.title}${draft}${labels}`);
        lines.push(`  - \`${pr.head}\` -> \`${pr.base}\``);
      }
      if (openPRs.length > 10) {
        lines.push(`- ... and ${openPRs.length - 10} more`);
      }
      lines.push('');
    }

    // Recently merged PRs (show last 5)
    const mergedPRs = summary.pullRequests.items
      .filter((p) => p.state === 'merged')
      .slice(0, 5);
    if (mergedPRs.length > 0) {
      lines.push('### Recently Merged');
      lines.push('');
      for (const pr of mergedPRs) {
        const mergedDate = pr.mergedAt ? pr.mergedAt.split('T')[0] : '';
        lines.push(
          `- [x] [#${pr.number}](${pr.url}) ${pr.title} (${mergedDate})`
        );
      }
      lines.push('');
    }
  }

  // Sync timestamp
  lines.push('---');
  lines.push('');
  lines.push(`*Last synced: ${summary.syncedAt.split('T')[0]}*`);

  return lines.join('\n');
}

/**
 * 同步 GitHub 数据到项目
 * @param workspacePath workspace 路径
 * @param projectName 项目名称
 * @param options 同步选项
 * @returns 同步摘要
 */
export async function syncProject(
  workspacePath: string,
  projectName: string,
  options: SyncOptions = {}
): Promise<SyncSummary> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };

  // 获取项目
  const project = await getProject(workspacePath, projectName);
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  // 解析 GitHub URL
  const repoInfo = parseGitHubRepoUrl(project.meta.project.github_repo);
  if (!repoInfo) {
    throw new Error(
      `Invalid GitHub repo URL: ${project.meta.project.github_repo}`
    );
  }

  // 获取 GitHub 数据
  const summary = await fetchGitHubData(repoInfo.owner, repoInfo.repo, opts);

  // 更新项目内容
  if (opts.updateContent) {
    const newContent = formatSyncContent(summary);
    await updateProject(workspacePath, projectName, {
      content: newContent,
    });
  }

  return summary;
}

/**
 * 同步多个项目
 * @param workspacePath workspace 路径
 * @param projectNames 项目名称列表
 * @param options 同步选项
 * @returns 同步结果映射
 */
export async function syncProjects(
  workspacePath: string,
  projectNames: string[],
  options: SyncOptions = {}
): Promise<Map<string, SyncSummary | Error>> {
  const results = new Map<string, SyncSummary | Error>();

  for (const name of projectNames) {
    try {
      const summary = await syncProject(workspacePath, name, options);
      results.set(name, summary);
    } catch (error) {
      results.set(name, error instanceof Error ? error : new Error(String(error)));
    }
  }

  return results;
}

// ============================================
// Quick Stats
// ============================================

/**
 * 快速获取项目的 GitHub 统计信息（不更新文件）
 * @param workspacePath workspace 路径
 * @param projectName 项目名称
 * @returns 简要统计信息
 */
export async function getProjectGitHubStats(
  workspacePath: string,
  projectName: string
): Promise<{
  repo: string;
  openIssues: number;
  openPRs: number;
  stars: number;
}> {
  const project = await getProject(workspacePath, projectName);
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  const repoInfo = parseGitHubRepoUrl(project.meta.project.github_repo);
  if (!repoInfo) {
    throw new Error(
      `Invalid GitHub repo URL: ${project.meta.project.github_repo}`
    );
  }

  const client = await getGitHubClient();
  const repo = await client.getRepository(repoInfo.owner, repoInfo.repo);

  return {
    repo: repo.fullName,
    openIssues: repo.openIssuesCount,
    openPRs: 0, // 需要额外 API 调用
    stars: repo.stargazersCount,
  };
}
