/**
 * Project CLI Commands
 * pwork project new/list/show/status/delete
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import {
  createProject,
  getProject,
  queryProjects,
  deleteProject,
  getProjectStats,
  updateProjectStatus,
  startProject,
  blockProject,
  completeProject,
  resumeProject,
  updateProjectType,
} from '../../project/index.js';
import {
  parseGitHubRepoUrl,
  normalizeGitHubRepoUrl,
  isValidGitHubRepoUrl,
  linkProjectToGitHub,
} from '../../project/github-link.js';
import { syncProject, getProjectGitHubStats } from '../../github/sync.js';
import { hasGitHubToken } from '../../core/config.js';
import { resolveWorkspace, loadGlobalConfig } from '../../core/config.js';
import type { Project, ProjectStatus, ProjectType } from '../../core/schema.js';
import { isProjectStatus, isProjectType } from '../../core/schema.js';

/** 状态显示颜色映射 */
const STATUS_COLORS: Record<ProjectStatus, (text: string) => string> = {
  Planning: chalk.blue,
  Doing: chalk.green,
  Blocked: chalk.red,
  Done: chalk.gray,
};

/** 状态图标映射 */
const STATUS_ICONS: Record<ProjectStatus, string> = {
  Planning: '📋',
  Doing: '🚀',
  Blocked: '🚫',
  Done: '✅',
};

/** 类型图标映射 */
const TYPE_ICONS: Record<ProjectType, string> = {
  software: '💻',
  research: '🔬',
  hybrid: '🔄',
  misc: '📁',
};

/**
 * 注册 project 相关命令
 */
export function registerProjectCommands(program: Command): void {
  const project = program
    .command('project')
    .description('Manage projects');

  // pwork project new <name> <github-repo>
  project
    .command('new <name> <github-repo>')
    .description('Create a new project')
    .option('-t, --type <type>', 'Project type (software/research/hybrid/misc)', 'software')
    .option('-s, --status <status>', 'Initial status (Planning/Doing)', 'Planning')
    .option('-e, --edit', 'Open in editor after creation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, githubRepo: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        // 验证 GitHub URL
        if (!isValidGitHubRepoUrl(githubRepo)) {
          console.error(chalk.red(`Invalid GitHub repo URL: ${githubRepo}`));
          console.log(chalk.gray('Supported formats: https://github.com/owner/repo, owner/repo'));
          process.exit(1);
        }

        // 验证类型
        if (!isProjectType(options.type)) {
          console.error(chalk.red(`Invalid project type: ${options.type}`));
          console.log(chalk.gray('Valid types: software, research, hybrid, misc'));
          process.exit(1);
        }

        // 验证状态
        if (!isProjectStatus(options.status)) {
          console.error(chalk.red(`Invalid status: ${options.status}`));
          console.log(chalk.gray('Valid statuses: Planning, Doing, Blocked, Done'));
          process.exit(1);
        }

        const normalizedUrl = normalizeGitHubRepoUrl(githubRepo);

        const proj = await createProject(workspace, {
          name,
          github_repo: normalizedUrl,
          type: options.type,
          status: options.status,
        });

        console.log(chalk.green(`✓ Created project: ${proj.meta.project.name}`));
        console.log(chalk.gray(`  GitHub: ${proj.meta.project.github_repo}`));
        console.log(chalk.gray(`  Type: ${proj.meta.project.type}`));
        console.log(chalk.gray(`  Status: ${proj.meta.project.status}`));
        console.log(chalk.gray(`  File: ${proj.filePath}`));

        if (options.edit) {
          await openInEditor(proj.filePath);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project list
  project
    .command('list')
    .description('List projects')
    .option('-s, --status <status>', 'Filter by status')
    .option('-t, --type <type>', 'Filter by type')
    .option('-a, --all', 'Show all projects (including Done)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        let projects = await queryProjects(workspace, {
          status: options.status,
          type: options.type,
        });

        // 默认不显示 Done 项目，除非指定 --all
        if (!options.all && !options.status) {
          projects = projects.filter((p) => p.meta.project.status !== 'Done');
        }

        if (projects.length === 0) {
          console.log(chalk.yellow('No projects found.'));
          return;
        }

        console.log(chalk.bold(`\nProjects (${projects.length}):\n`));

        for (const proj of projects) {
          printProjectSummary(proj);
        }

        console.log();
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project show <name>
  project
    .command('show <name>')
    .description('Show project details')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const proj = await getProject(workspace, name);

        if (!proj) {
          console.error(chalk.red(`Project not found: ${name}`));
          process.exit(1);
        }

        printProjectDetail(proj);
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project edit <name>
  project
    .command('edit <name>')
    .description('Open project in editor')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const proj = await getProject(workspace, name);

        if (!proj) {
          console.error(chalk.red(`Project not found: ${name}`));
          process.exit(1);
        }

        await openInEditor(proj.filePath);
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project status <name> [status]
  project
    .command('status <name> [status]')
    .description('Get or set project status')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, status: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        if (!status) {
          // 只显示状态
          const proj = await getProject(workspace, name);
          if (!proj) {
            console.error(chalk.red(`Project not found: ${name}`));
            process.exit(1);
          }

          const info = proj.meta.project;
          const colorFn = STATUS_COLORS[info.status];
          console.log(`${STATUS_ICONS[info.status]} ${info.name}: ${colorFn(info.status)}`);
          return;
        }

        // 设置状态
        if (!isProjectStatus(status)) {
          console.error(chalk.red(`Invalid status: ${status}`));
          console.log(chalk.gray('Valid statuses: Planning, Doing, Blocked, Done'));
          process.exit(1);
        }

        const proj = await updateProjectStatus(workspace, name, status as ProjectStatus);
        const colorFn = STATUS_COLORS[proj.meta.project.status];
        console.log(chalk.green(`✓ ${proj.meta.project.name} status updated to ${colorFn(proj.meta.project.status)}`));

        if (status === 'Done' && proj.meta.project.end_date) {
          console.log(chalk.gray(`  End date: ${proj.meta.project.end_date}`));
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project start <name>
  project
    .command('start <name>')
    .description('Start a project (set status to Doing)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const proj = await startProject(workspace, name);
        console.log(chalk.green(`🚀 Started project: ${proj.meta.project.name}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project block <name>
  project
    .command('block <name>')
    .description('Block a project')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const proj = await blockProject(workspace, name);
        console.log(chalk.red(`🚫 Blocked project: ${proj.meta.project.name}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project complete <name>
  project
    .command('complete <name>')
    .description('Complete a project')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const proj = await completeProject(workspace, name);
        console.log(chalk.green(`✅ Completed project: ${proj.meta.project.name}`));
        if (proj.meta.project.end_date) {
          console.log(chalk.gray(`  End date: ${proj.meta.project.end_date}`));
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project resume <name>
  project
    .command('resume <name>')
    .description('Resume a blocked or completed project')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const proj = await resumeProject(workspace, name);
        console.log(chalk.green(`🚀 Resumed project: ${proj.meta.project.name}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project delete <name>
  project
    .command('delete <name>')
    .description('Delete a project')
    .option('-f, --force', 'Skip confirmation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        if (!options.force) {
          console.log(chalk.yellow(`Warning: This will delete the project "${name}"`));
          console.log(chalk.gray('Use --force to skip this confirmation.'));
          process.exit(1);
        }

        await deleteProject(workspace, name);
        console.log(chalk.green(`✓ Deleted project: ${name}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project stats
  project
    .command('stats')
    .description('Show project statistics')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const stats = await getProjectStats(workspace);

        console.log(chalk.bold('\nProject Statistics:\n'));
        console.log(`  Total: ${chalk.cyan(stats.total)}`);

        console.log(chalk.bold('\n  By Status:'));
        for (const [status, count] of Object.entries(stats.byStatus)) {
          if (count > 0) {
            const colorFn = STATUS_COLORS[status as ProjectStatus];
            console.log(`    ${STATUS_ICONS[status as ProjectStatus]} ${colorFn(status)}: ${count}`);
          }
        }

        console.log(chalk.bold('\n  By Type:'));
        for (const [type, count] of Object.entries(stats.byType)) {
          if (count > 0) {
            console.log(`    ${TYPE_ICONS[type as ProjectType]} ${type}: ${count}`);
          }
        }

        console.log();
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project link <name> <github-repo>
  project
    .command('link <name> <github-repo>')
    .description('Update project GitHub repo link')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, githubRepo: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        if (!isValidGitHubRepoUrl(githubRepo)) {
          console.error(chalk.red(`Invalid GitHub repo URL: ${githubRepo}`));
          process.exit(1);
        }

        const proj = await linkProjectToGitHub(workspace, name, githubRepo);
        console.log(chalk.green(`✓ Updated GitHub link for ${name}`));
        console.log(chalk.gray(`  New URL: ${proj.meta.project.github_repo}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project type <name> <type>
  project
    .command('type <name> <type>')
    .description('Update project type')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, type: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        if (!isProjectType(type)) {
          console.error(chalk.red(`Invalid project type: ${type}`));
          console.log(chalk.gray('Valid types: software, research, hybrid, misc'));
          process.exit(1);
        }

        const proj = await updateProjectType(workspace, name, type as ProjectType);
        console.log(chalk.green(`✓ Updated type for ${name}: ${proj.meta.project.type}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project sync [name]
  project
    .command('sync [name]')
    .description('Sync GitHub issues and PRs to project')
    .option('-w, --workspace <path>', 'Workspace path')
    .option('--no-issues', 'Skip syncing issues')
    .option('--no-prs', 'Skip syncing pull requests')
    .option('--no-milestones', 'Skip syncing milestones')
    .option('--no-update', 'Only show stats, do not update project file')
    .option('-s, --state <state>', 'Filter by state (open/closed/all)', 'all')
    .action(async (name: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        // 检查 GitHub token
        if (!(await hasGitHubToken())) {
          console.error(chalk.red('GitHub token not configured.'));
          console.log(chalk.gray('Set token via: pwork config set github.token <token>'));
          console.log(chalk.gray('Or set GITHUB_TOKEN environment variable.'));
          process.exit(1);
        }

        // 如果没有指定项目名，显示可用项目列表
        if (!name) {
          const projects = await queryProjects(workspace, {});
          if (projects.length === 0) {
            console.log(chalk.yellow('No projects found.'));
            return;
          }

          console.log(chalk.bold('\nAvailable projects to sync:\n'));
          for (const proj of projects) {
            const info = proj.meta.project;
            const repoInfo = parseGitHubRepoUrl(info.github_repo);
            const repoShort = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : info.github_repo;
            console.log(`  ${chalk.cyan(info.name)} - ${chalk.gray(repoShort)}`);
          }
          console.log(chalk.gray('\nRun: pwork project sync <name>'));
          return;
        }

        // 获取项目
        const proj = await getProject(workspace, name);
        if (!proj) {
          console.error(chalk.red(`Project not found: ${name}`));
          process.exit(1);
        }

        const repoInfo = parseGitHubRepoUrl(proj.meta.project.github_repo);
        if (!repoInfo) {
          console.error(chalk.red(`Invalid GitHub repo URL: ${proj.meta.project.github_repo}`));
          process.exit(1);
        }

        console.log(chalk.bold(`\nSyncing project: ${proj.meta.project.name}`));
        console.log(chalk.gray(`GitHub: ${repoInfo.owner}/${repoInfo.repo}\n`));

        // 执行同步
        const summary = await syncProject(workspace, name, {
          syncIssues: options.issues !== false,
          syncPRs: options.prs !== false,
          syncMilestones: options.milestones !== false,
          issueState: options.state as 'open' | 'closed' | 'all',
          prState: options.state as 'open' | 'closed' | 'all',
          updateContent: options.update !== false,
        });

        // 显示同步结果
        console.log(chalk.green('✓ Sync completed!\n'));

        // 仓库信息
        console.log(chalk.bold('Repository:'));
        console.log(`  ${summary.repository.name}`);
        if (summary.repository.description) {
          console.log(chalk.gray(`  ${summary.repository.description}`));
        }
        console.log(`  ⭐ ${summary.repository.stars} stars | 🍴 ${summary.repository.forks} forks`);
        console.log();

        // Issue 统计
        if (options.issues !== false) {
          console.log(chalk.bold('Issues:'));
          console.log(
            `  Total: ${summary.issues.total} | ` +
            `${chalk.green(`Open: ${summary.issues.open}`)} | ` +
            `${chalk.gray(`Closed: ${summary.issues.closed}`)}`
          );
          console.log();
        }

        // PR 统计
        if (options.prs !== false) {
          console.log(chalk.bold('Pull Requests:'));
          console.log(
            `  Total: ${summary.pullRequests.total} | ` +
            `${chalk.green(`Open: ${summary.pullRequests.open}`)} | ` +
            `${chalk.blue(`Merged: ${summary.pullRequests.merged}`)} | ` +
            `${chalk.gray(`Closed: ${summary.pullRequests.closed}`)}`
          );
          console.log();
        }

        // Milestone 统计
        if (options.milestones !== false && summary.milestones.total > 0) {
          console.log(chalk.bold('Milestones:'));
          console.log(
            `  Total: ${summary.milestones.total} | ` +
            `${chalk.green(`Open: ${summary.milestones.open}`)} | ` +
            `${chalk.gray(`Closed: ${summary.milestones.closed}`)}`
          );
          console.log();
        }

        if (options.update !== false) {
          console.log(chalk.gray(`Project file updated: ${proj.filePath}`));
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork project github <name>
  project
    .command('github <name>')
    .description('Show GitHub stats for a project (quick, no file update)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (name: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        // 检查 GitHub token
        if (!(await hasGitHubToken())) {
          console.error(chalk.red('GitHub token not configured.'));
          console.log(chalk.gray('Set token via: pwork config set github.token <token>'));
          console.log(chalk.gray('Or set GITHUB_TOKEN environment variable.'));
          process.exit(1);
        }

        const proj = await getProject(workspace, name);
        if (!proj) {
          console.error(chalk.red(`Project not found: ${name}`));
          process.exit(1);
        }

        console.log(chalk.bold(`\n${proj.meta.project.name}\n`));

        const stats = await getProjectGitHubStats(workspace, name);
        console.log(`  Repository: ${chalk.cyan(stats.repo)}`);
        console.log(`  ⭐ Stars: ${stats.stars}`);
        console.log(`  📋 Open Issues: ${stats.openIssues}`);
        console.log();
      } catch (error) {
        handleError(error);
      }
    });
}

// ============================================
// Helper Functions
// ============================================

/**
 * 打印项目摘要（用于列表）
 */
function printProjectSummary(proj: Project): void {
  const info = proj.meta.project;
  const colorFn = STATUS_COLORS[info.status];
  const repoInfo = parseGitHubRepoUrl(info.github_repo);
  const repoShort = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : info.github_repo;

  console.log(
    `${STATUS_ICONS[info.status]} ${chalk.bold(info.name)} ` +
    `${colorFn(`[${info.status}]`)} ` +
    `${TYPE_ICONS[info.type]} ` +
    chalk.gray(repoShort)
  );
}

/**
 * 打印项目详情
 */
function printProjectDetail(proj: Project): void {
  const info = proj.meta.project;
  const colorFn = STATUS_COLORS[info.status];
  const repoInfo = parseGitHubRepoUrl(info.github_repo);

  console.log(chalk.bold(`\n${TYPE_ICONS[info.type]} Project: ${info.name}\n`));
  console.log(`  Status:      ${STATUS_ICONS[info.status]} ${colorFn(info.status)}`);
  console.log(`  Type:        ${TYPE_ICONS[info.type]} ${info.type}`);
  console.log(`  GitHub:      ${info.github_repo}`);

  if (repoInfo) {
    console.log(`  Clone:       ${chalk.gray(repoInfo.cloneUrl)}`);
  }

  console.log(`  Start Date:  ${info.start_date}`);

  if (info.end_date) {
    console.log(`  End Date:    ${info.end_date}`);
  }

  console.log(chalk.gray(`  File:        ${proj.filePath}`));

  if (proj.content.trim()) {
    console.log(chalk.bold('\n--- Content ---\n'));
    console.log(proj.content);
  }
}

/**
 * 在编辑器中打开文件
 */
async function openInEditor(filePath: string): Promise<void> {
  const config = await loadGlobalConfig();
  const editor = config.preferences?.editor || process.env.EDITOR || 'vim';

  console.log(chalk.gray(`Opening in ${editor}...`));

  return new Promise((resolve, reject) => {
    const child = spawn(editor, [filePath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Editor exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * 错误处理
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
  } else {
    console.error(chalk.red('An unexpected error occurred'));
  }
  process.exit(1);
}
