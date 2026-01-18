/**
 * Daily Log CLI Commands
 * pwork daily new/list/show/edit/delete
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import {
  createDaily,
  getDaily,
  getOrCreateTodayDaily,
  queryDailies,
  deleteDaily,
  getDailyStats,
  addProjectToDaily,
  addTagToDaily,
  setWeeklyHighlight,
  formatDate,
  isValidDateString,
} from '../../daily/index.js';
import { resolveWorkspace, loadGlobalConfig } from '../../core/config.js';
import type { DailyLog } from '../../core/schema.js';

/**
 * 注册 daily 相关命令
 */
export function registerDailyCommands(program: Command): void {
  const daily = program
    .command('daily')
    .description('Manage daily logs');

  // pwork daily new [date]
  daily
    .command('new [date]')
    .description('Create a new daily log (default: today)')
    .option('-p, --project <projects...>', 'Associate projects')
    .option('-t, --tag <tags...>', 'Add tags')
    .option('-e, --edit', 'Open in editor after creation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetDate = date || formatDate();

        // 验证日期格式
        if (date && !isValidDateString(date)) {
          console.error(chalk.red(`Invalid date format: ${date}. Use YYYY-MM-DD.`));
          process.exit(1);
        }

        const daily = await createDaily(workspace, {
          date: targetDate,
          projects: options.project,
          tags: options.tag,
        });

        console.log(chalk.green(`✓ Created daily log: ${daily.meta.date}`));
        console.log(chalk.gray(`  File: ${daily.filePath}`));

        if (options.edit) {
          await openInEditor(daily.filePath);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily today
  daily
    .command('today')
    .description('Get or create today\'s daily log')
    .option('-e, --edit', 'Open in editor')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const daily = await getOrCreateTodayDaily(workspace);

        console.log(chalk.green(`✓ Today's daily log: ${daily.meta.date}`));
        console.log(chalk.gray(`  File: ${daily.filePath}`));

        if (options.edit) {
          await openInEditor(daily.filePath);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily list
  daily
    .command('list')
    .description('List daily logs')
    .option('-n, --limit <number>', 'Limit number of results', '10')
    .option('-p, --project <name>', 'Filter by project')
    .option('-t, --tag <name>', 'Filter by tag')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--highlight', 'Show only weekly highlights')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        const dailies = await queryDailies(workspace, {
          startDate: options.from,
          endDate: options.to,
          project: options.project,
          tag: options.tag,
          highlightOnly: options.highlight,
        });

        const limit = parseInt(options.limit, 10);
        const limited = dailies.slice(0, limit);

        if (limited.length === 0) {
          console.log(chalk.yellow('No daily logs found.'));
          return;
        }

        console.log(chalk.bold(`Daily Logs (${limited.length}/${dailies.length}):\n`));

        for (const daily of limited) {
          printDailySummary(daily);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily show [date]
  daily
    .command('show [date]')
    .description('Show a daily log (default: today)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetDate = date || formatDate();

        const daily = await getDaily(workspace, targetDate);

        if (!daily) {
          console.error(chalk.red(`Daily log not found for ${targetDate}`));
          process.exit(1);
        }

        printDailyDetail(daily);
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily edit [date]
  daily
    .command('edit [date]')
    .description('Open a daily log in editor (default: today)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetDate = date || formatDate();

        const daily = await getDaily(workspace, targetDate);

        if (!daily) {
          console.error(chalk.red(`Daily log not found for ${targetDate}`));
          console.log(chalk.gray(`Run 'pwork daily new ${targetDate}' to create it.`));
          process.exit(1);
        }

        await openInEditor(daily.filePath);
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily delete <date>
  daily
    .command('delete <date>')
    .description('Delete a daily log')
    .option('-f, --force', 'Skip confirmation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        if (!options.force) {
          console.log(chalk.yellow(`Warning: This will delete the daily log for ${date}`));
          console.log(chalk.gray('Use --force to skip this confirmation.'));
          process.exit(1);
        }

        await deleteDaily(workspace, date);
        console.log(chalk.green(`✓ Deleted daily log: ${date}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily stats
  daily
    .command('stats')
    .description('Show daily log statistics')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const stats = await getDailyStats(workspace);

        console.log(chalk.bold('\nDaily Log Statistics:\n'));
        console.log(`  Total:          ${chalk.cyan(stats.total)}`);
        console.log(`  This Week:      ${chalk.cyan(stats.thisWeek)}`);
        console.log(`  This Month:     ${chalk.cyan(stats.thisMonth)}`);
        console.log(`  Highlights:     ${chalk.cyan(stats.highlightCount)}`);

        if (Object.keys(stats.projectCounts).length > 0) {
          console.log(chalk.bold('\n  Projects:'));
          for (const [project, count] of Object.entries(stats.projectCounts)) {
            console.log(`    ${project}: ${count}`);
          }
        }

        if (Object.keys(stats.tagCounts).length > 0) {
          console.log(chalk.bold('\n  Tags:'));
          for (const [tag, count] of Object.entries(stats.tagCounts)) {
            console.log(`    #${tag}: ${count}`);
          }
        }

        console.log();
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily add-project <date> <project>
  daily
    .command('add-project <date> <project>')
    .description('Add a project to a daily log')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string, project: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        await addProjectToDaily(workspace, date, project);
        console.log(chalk.green(`✓ Added project '${project}' to ${date}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily add-tag <date> <tag>
  daily
    .command('add-tag <date> <tag>')
    .description('Add a tag to a daily log')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string, tag: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        await addTagToDaily(workspace, date, tag);
        console.log(chalk.green(`✓ Added tag '#${tag}' to ${date}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork daily highlight <date> [on|off]
  daily
    .command('highlight <date> [state]')
    .description('Set/toggle weekly highlight status')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (date: string, state: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const daily = await getDaily(workspace, date);

        if (!daily) {
          console.error(chalk.red(`Daily log not found for ${date}`));
          process.exit(1);
        }

        let isHighlight: boolean;
        if (state === 'on' || state === 'true') {
          isHighlight = true;
        } else if (state === 'off' || state === 'false') {
          isHighlight = false;
        } else {
          // Toggle
          isHighlight = !daily.meta.weekly_highlight;
        }

        await setWeeklyHighlight(workspace, date, isHighlight);
        console.log(chalk.green(`✓ Weekly highlight ${isHighlight ? 'enabled' : 'disabled'} for ${date}`));
      } catch (error) {
        handleError(error);
      }
    });
}

// ============================================
// Helper Functions
// ============================================

/**
 * 打印 daily 摘要（用于列表）
 */
function printDailySummary(daily: DailyLog): void {
  const highlight = daily.meta.weekly_highlight ? chalk.yellow('★') : ' ';
  const projects = daily.meta.projects.length > 0
    ? chalk.blue(` [${daily.meta.projects.join(', ')}]`)
    : '';
  const tags = daily.meta.tags.length > 0
    ? chalk.gray(` #${daily.meta.tags.join(' #')}`)
    : '';

  console.log(`${highlight} ${chalk.cyan(daily.meta.date)} ${chalk.gray(daily.meta.week)}${projects}${tags}`);
}

/**
 * 打印 daily 详情
 */
function printDailyDetail(daily: DailyLog): void {
  console.log(chalk.bold(`\n📅 Daily Log: ${daily.meta.date}\n`));
  console.log(`  Week:      ${daily.meta.week}`);
  console.log(`  Highlight: ${daily.meta.weekly_highlight ? chalk.yellow('Yes') : 'No'}`);

  if (daily.meta.projects.length > 0) {
    console.log(`  Projects:  ${daily.meta.projects.join(', ')}`);
  }

  if (daily.meta.tags.length > 0) {
    console.log(`  Tags:      #${daily.meta.tags.join(' #')}`);
  }

  if (daily.meta.github.issues.length > 0) {
    console.log(`  Issues:    ${daily.meta.github.issues.length}`);
  }

  if (daily.meta.github.prs.length > 0) {
    console.log(`  PRs:       ${daily.meta.github.prs.length}`);
  }

  console.log(chalk.gray(`  File:      ${daily.filePath}`));

  if (daily.content.trim()) {
    console.log(chalk.bold('\n--- Content ---\n'));
    console.log(daily.content);
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
