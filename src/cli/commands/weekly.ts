/**
 * Weekly Report CLI Commands
 * pwork weekly new/generate/list/show/edit
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import {
  createWeekly,
  getWeekly,
  generateWeekly,
  listWeeklies,
  deleteWeekly,
  getWeeklyStats,
  getCurrentWeek,
  isValidWeekString,
  getWeekDateRange,
  getDailiesForWeek,
} from '../../weekly/index.js';
import { resolveWorkspace, loadGlobalConfig } from '../../core/config.js';
import type { WeeklyReport } from '../../core/schema.js';

/**
 * 注册 weekly 相关命令
 */
export function registerWeeklyCommands(program: Command): void {
  const weekly = program
    .command('weekly')
    .description('Manage weekly reports');

  // pwork weekly new [week]
  weekly
    .command('new [week]')
    .description('Create a new weekly report (default: current week)')
    .option('-a, --aggregate', 'Auto-aggregate from daily logs')
    .option('-e, --edit', 'Open in editor after creation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (week: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetWeek = week || getCurrentWeek();

        // 验证周格式
        if (week && !isValidWeekString(week)) {
          console.error(chalk.red(`Invalid week format: ${week}. Use YYYY-Www (e.g., 2026-W03).`));
          process.exit(1);
        }

        const weeklyReport = await createWeekly(workspace, {
          week: targetWeek,
          autoAggregate: options.aggregate,
        });

        console.log(chalk.green(`✓ Created weekly report: ${weeklyReport.meta.week}`));
        console.log(chalk.gray(`  Period: ${weeklyReport.meta.start_date} ~ ${weeklyReport.meta.end_date}`));
        console.log(chalk.gray(`  File: ${weeklyReport.filePath}`));

        if (options.edit) {
          await openInEditor(weeklyReport.filePath);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly generate [week]
  weekly
    .command('generate [week]')
    .description('Generate/update weekly report from daily logs (default: current week)')
    .option('-e, --edit', 'Open in editor after generation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (week: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetWeek = week || getCurrentWeek();

        // 验证周格式
        if (week && !isValidWeekString(week)) {
          console.error(chalk.red(`Invalid week format: ${week}. Use YYYY-Www (e.g., 2026-W03).`));
          process.exit(1);
        }

        // 获取该周的 daily logs 数量
        const dailies = await getDailiesForWeek(workspace, targetWeek);

        console.log(chalk.gray(`Found ${dailies.length} daily log(s) for ${targetWeek}`));

        const weeklyReport = await generateWeekly(workspace, targetWeek);

        const highlightCount = dailies.filter(d => d.meta.weekly_highlight).length;

        console.log(chalk.green(`✓ Generated weekly report: ${weeklyReport.meta.week}`));
        console.log(chalk.gray(`  Period: ${weeklyReport.meta.start_date} ~ ${weeklyReport.meta.end_date}`));
        console.log(chalk.gray(`  Daily logs: ${dailies.length}`));
        console.log(chalk.gray(`  Highlights: ${highlightCount}`));
        console.log(chalk.gray(`  Projects: ${weeklyReport.meta.projects.length > 0 ? weeklyReport.meta.projects.join(', ') : 'none'}`));
        console.log(chalk.gray(`  File: ${weeklyReport.filePath}`));

        if (options.edit) {
          await openInEditor(weeklyReport.filePath);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly list
  weekly
    .command('list')
    .description('List weekly reports')
    .option('-n, --limit <number>', 'Limit number of results', '10')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        const weeklies = await listWeeklies(workspace);

        const limit = parseInt(options.limit, 10);
        const limited = weeklies.slice(0, limit);

        if (limited.length === 0) {
          console.log(chalk.yellow('No weekly reports found.'));
          return;
        }

        console.log(chalk.bold(`Weekly Reports (${limited.length}/${weeklies.length}):\n`));

        for (const weeklyReport of limited) {
          printWeeklySummary(weeklyReport);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly show [week]
  weekly
    .command('show [week]')
    .description('Show a weekly report (default: current week)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (week: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetWeek = week || getCurrentWeek();

        const weeklyReport = await getWeekly(workspace, targetWeek);

        if (!weeklyReport) {
          console.error(chalk.red(`Weekly report not found for ${targetWeek}`));
          console.log(chalk.gray(`Run 'pwork weekly new ${targetWeek}' or 'pwork weekly generate ${targetWeek}' to create it.`));
          process.exit(1);
        }

        printWeeklyDetail(weeklyReport);
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly edit [week]
  weekly
    .command('edit [week]')
    .description('Open a weekly report in editor (default: current week)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (week: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetWeek = week || getCurrentWeek();

        const weeklyReport = await getWeekly(workspace, targetWeek);

        if (!weeklyReport) {
          console.error(chalk.red(`Weekly report not found for ${targetWeek}`));
          console.log(chalk.gray(`Run 'pwork weekly new ${targetWeek}' or 'pwork weekly generate ${targetWeek}' to create it.`));
          process.exit(1);
        }

        await openInEditor(weeklyReport.filePath);
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly delete <week>
  weekly
    .command('delete <week>')
    .description('Delete a weekly report')
    .option('-f, --force', 'Skip confirmation')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (week: string, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();

        if (!options.force) {
          console.log(chalk.yellow(`Warning: This will delete the weekly report for ${week}`));
          console.log(chalk.gray('Use --force to skip this confirmation.'));
          process.exit(1);
        }

        await deleteWeekly(workspace, week);
        console.log(chalk.green(`✓ Deleted weekly report: ${week}`));
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly stats
  weekly
    .command('stats')
    .description('Show weekly report statistics')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const stats = await getWeeklyStats(workspace);

        console.log(chalk.bold('\nWeekly Report Statistics:\n'));
        console.log(`  Total:       ${chalk.cyan(stats.total)}`);
        console.log(`  This Month:  ${chalk.cyan(stats.thisMonth)}`);

        if (Object.keys(stats.projectCounts).length > 0) {
          console.log(chalk.bold('\n  Projects:'));
          for (const [project, count] of Object.entries(stats.projectCounts)) {
            console.log(`    ${project}: ${count} week(s)`);
          }
        }

        console.log();
      } catch (error) {
        handleError(error);
      }
    });

  // pwork weekly dailies [week]
  weekly
    .command('dailies [week]')
    .description('Show daily logs for a week (default: current week)')
    .option('-w, --workspace <path>', 'Workspace path')
    .action(async (week: string | undefined, options) => {
      try {
        const workspace = options.workspace || await resolveWorkspace();
        const targetWeek = week || getCurrentWeek();

        const { start, end } = getWeekDateRange(targetWeek);
        const dailies = await getDailiesForWeek(workspace, targetWeek);

        console.log(chalk.bold(`\nDaily Logs for ${targetWeek} (${start} ~ ${end}):\n`));

        if (dailies.length === 0) {
          console.log(chalk.yellow('No daily logs found for this week.'));
          return;
        }

        for (const daily of dailies) {
          const highlight = daily.meta.weekly_highlight ? chalk.yellow('★') : ' ';
          const projects = daily.meta.projects.length > 0
            ? chalk.blue(` [${daily.meta.projects.join(', ')}]`)
            : '';
          console.log(`${highlight} ${chalk.cyan(daily.meta.date)}${projects}`);
        }

        console.log();
        console.log(chalk.gray(`Total: ${dailies.length} daily log(s), ${dailies.filter(d => d.meta.weekly_highlight).length} highlight(s)`));
      } catch (error) {
        handleError(error);
      }
    });
}

// ============================================
// Helper Functions
// ============================================

/**
 * 打印 weekly 摘要（用于列表）
 */
function printWeeklySummary(weekly: WeeklyReport): void {
  const projects = weekly.meta.projects.length > 0
    ? chalk.blue(` [${weekly.meta.projects.join(', ')}]`)
    : '';

  console.log(`  ${chalk.cyan(weekly.meta.week)} ${chalk.gray(`(${weekly.meta.start_date} ~ ${weekly.meta.end_date})`)}${projects}`);
}

/**
 * 打印 weekly 详情
 */
function printWeeklyDetail(weekly: WeeklyReport): void {
  console.log(chalk.bold(`\n📋 Weekly Report: ${weekly.meta.week}\n`));
  console.log(`  Period:    ${weekly.meta.start_date} ~ ${weekly.meta.end_date}`);

  if (weekly.meta.projects.length > 0) {
    console.log(`  Projects:  ${weekly.meta.projects.join(', ')}`);
  }

  console.log(chalk.gray(`  File:      ${weekly.filePath}`));

  if (weekly.content.trim()) {
    console.log(chalk.bold('\n--- Content ---\n'));
    console.log(weekly.content);
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
