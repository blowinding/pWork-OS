/**
 * Export CLI Commands
 * pwork export slides [source]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getCurrentWorkspace } from '../../core/config.js';
import { getCurrentDate, getCurrentWeek } from '../../daily/index.js';
import {
  exportDailySlides,
  exportWeeklySlides,
  exportProjectSlides,
  exportMarkdownSlides,
  isSlidevAvailable,
  dailyToSlides,
  weeklyToSlides,
  projectToSlides,
  type SlideFormat,
  type SlideTheme,
} from '../../export/slides.js';
import {
  generateSlidevProject,
  runSlidevDev,
  getSlidevProjectPath,
  type SlidevProjectConfig,
} from '../../export/slidev.js';
import { getDaily } from '../../daily/index.js';
import { getWeekly } from '../../weekly/index.js';
import { getProject } from '../../project/index.js';
import { listProjects } from '../../project/index.js';
import { exists } from '../../core/fs.js';

// ============================================
// Dev Mode Handler
// ============================================

interface DevModeOptions {
  output?: string;
}

/**
 * Handle dev mode for live preview
 */
async function handleDevMode(
  workspacePath: string,
  source: string | undefined,
  theme: SlideTheme,
  _options: DevModeOptions
): Promise<void> {
  let markdown: string;
  let projectName: string;

  // Get markdown content based on source
  if (!source) {
    const { sourceType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sourceType',
        message: 'What would you like to preview?',
        choices: [
          { name: 'Daily Log', value: 'daily' },
          { name: 'Weekly Report', value: 'weekly' },
          { name: 'Project', value: 'project' },
        ],
      },
    ]);

    if (sourceType === 'daily') {
      const { date } = await inquirer.prompt([
        {
          type: 'input',
          name: 'date',
          message: 'Enter date (YYYY-MM-DD):',
          default: getCurrentDate(),
        },
      ]);
      const daily = await getDaily(workspacePath, date);
      if (!daily) {
        throw new Error(`Daily log not found: ${date}`);
      }
      markdown = dailyToSlides(daily, theme);
      projectName = `daily-${date}`;
    } else if (sourceType === 'weekly') {
      const { week } = await inquirer.prompt([
        {
          type: 'input',
          name: 'week',
          message: 'Enter week (YYYY-Www):',
          default: getCurrentWeek(),
        },
      ]);
      const weekly = await getWeekly(workspacePath, week);
      if (!weekly) {
        throw new Error(`Weekly report not found: ${week}`);
      }
      markdown = weeklyToSlides(weekly, theme);
      projectName = `weekly-${week}`;
    } else {
      const projects = await listProjects(workspacePath);
      if (projects.length === 0) {
        console.log(chalk.yellow('No projects found'));
        process.exit(0);
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select project:',
          choices: projects.map((p) => ({
            name: `${p.meta.project.name} [${p.meta.project.status}]`,
            value: p.meta.project.name,
          })),
        },
      ]);
      const project = await getProject(workspacePath, selectedProject);
      if (!project) {
        throw new Error(`Project not found: ${selectedProject}`);
      }
      markdown = projectToSlides(project, theme);
      projectName = `project-${selectedProject}`;
    }
  } else if (source.startsWith('daily:')) {
    const date = source.replace('daily:', '');
    const daily = await getDaily(workspacePath, date);
    if (!daily) {
      throw new Error(`Daily log not found: ${date}`);
    }
    markdown = dailyToSlides(daily, theme);
    projectName = `daily-${date}`;
  } else if (source.startsWith('weekly:')) {
    const week = source.replace('weekly:', '');
    const weekly = await getWeekly(workspacePath, week);
    if (!weekly) {
      throw new Error(`Weekly report not found: ${week}`);
    }
    markdown = weeklyToSlides(weekly, theme);
    projectName = `weekly-${week}`;
  } else if (source.startsWith('project:')) {
    const name = source.replace('project:', '');
    const project = await getProject(workspacePath, name);
    if (!project) {
      throw new Error(`Project not found: ${name}`);
    }
    markdown = projectToSlides(project, theme);
    projectName = `project-${name}`;
  } else {
    throw new Error('Dev mode is only supported for daily, weekly, and project sources');
  }

  // Create temporary Slidev project
  const projectPath = getSlidevProjectPath(workspacePath, projectName);
  const config: SlidevProjectConfig = {
    title: projectName,
    theme,
  };

  await generateSlidevProject(projectPath, markdown, config);

  console.log(chalk.green(`✓ Starting Slidev dev server...`));
  console.log(chalk.gray(`   Project: ${projectPath}`));
  console.log(chalk.yellow(`   Press Ctrl+C to stop the server`));

  // Start dev server (this will block until interrupted)
  const child = runSlidevDev(projectPath, { open: true });

  // Handle process exit
  process.on('SIGINT', () => {
    child.kill();
    console.log(chalk.gray('\n   Dev server stopped'));
    process.exit(0);
  });
}

// ============================================
// Export Slides Command
// ============================================

/**
 * pwork export slides [source]
 */
export function createExportCommand(): Command {
  const exportCmd = new Command('export');
  exportCmd.description('Export documents to various formats');

  // Slidev theme options
  const validThemes = ['default', 'seriph', 'apple-basic', 'bricks', 'shibainu'];

  // Slides subcommand
  const slidesCmd = new Command('slides');
  slidesCmd
    .description('Export document to slides presentation using Slidev')
    .argument('[source]', 'Source document (daily:YYYY-MM-DD, weekly:YYYY-Www, project:name, or file path)')
    .option('-f, --format <format>', 'Output format (html, pdf, pptx)', 'html')
    .option('-t, --theme <theme>', `Slidev theme (${validThemes.join(', ')})`, 'default')
    .option('-o, --output <path>', 'Custom output path')
    .option('-d, --dev', 'Start dev server for live preview')
    .option('--dark', 'Use dark mode for PDF/PPTX export')
    .action(async (source, options) => {
      try {
        // Check Slidev availability
        if (!(await isSlidevAvailable())) {
          console.log(chalk.red('✗ Slidev CLI is not available'));
          console.log(chalk.yellow('Please ensure @slidev/cli is installed'));
          console.log(chalk.yellow('Run: npm install @slidev/cli'));
          process.exit(1);
        }

        const workspacePath = await getCurrentWorkspace();
        const format = options.format as SlideFormat;
        const themeInput = options.theme as string;
        const isDev = options.dev as boolean;
        const dark = options.dark as boolean;

        // Validate format
        if (!['html', 'pdf', 'pptx'].includes(format)) {
          console.log(chalk.red(`✗ Invalid format: ${format}`));
          console.log(chalk.yellow('Valid formats: html, pdf, pptx'));
          process.exit(1);
        }

        // Validate theme
        if (!validThemes.includes(themeInput)) {
          console.log(chalk.red(`✗ Invalid theme: ${themeInput}`));
          console.log(chalk.yellow(`Valid themes: ${validThemes.join(', ')}`));
          process.exit(1);
        }
        const theme = themeInput as SlideTheme;

        // Handle dev mode
        if (isDev) {
          await handleDevMode(workspacePath, source, theme, options);
          return;
        }

        let outputPath: string;

        // If no source provided, show interactive selection
        if (!source) {
          const { sourceType } = await inquirer.prompt([
            {
              type: 'list',
              name: 'sourceType',
              message: 'What would you like to export?',
              choices: [
                { name: 'Daily Log', value: 'daily' },
                { name: 'Weekly Report', value: 'weekly' },
                { name: 'Project', value: 'project' },
                { name: 'Custom Markdown File', value: 'file' },
              ],
            },
          ]);

          if (sourceType === 'daily') {
            const { date } = await inquirer.prompt([
              {
                type: 'input',
                name: 'date',
                message: 'Enter date (YYYY-MM-DD):',
                default: getCurrentDate(),
              },
            ]);
            outputPath = await exportDailySlides(workspacePath, date, { format, theme, dark });
            console.log(chalk.green(`✓ Exported daily log ${date} to slides`));
          } else if (sourceType === 'weekly') {
            const { week } = await inquirer.prompt([
              {
                type: 'input',
                name: 'week',
                message: 'Enter week (YYYY-Www):',
                default: getCurrentWeek(),
              },
            ]);
            outputPath = await exportWeeklySlides(workspacePath, week, { format, theme, dark });
            console.log(chalk.green(`✓ Exported weekly report ${week} to slides`));
          } else if (sourceType === 'project') {
            const projects = await listProjects(workspacePath);
            if (projects.length === 0) {
              console.log(chalk.yellow('No projects found'));
              process.exit(0);
            }

            const { projectName } = await inquirer.prompt([
              {
                type: 'list',
                name: 'projectName',
                message: 'Select project:',
                choices: projects.map((p) => ({
                  name: `${p.meta.project.name} [${p.meta.project.status}]`,
                  value: p.meta.project.name,
                })),
              },
            ]);
            outputPath = await exportProjectSlides(workspacePath, projectName, { format, theme, dark });
            console.log(chalk.green(`✓ Exported project "${projectName}" to slides`));
          } else {
            const { filePath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'filePath',
                message: 'Enter markdown file path:',
              },
            ]);

            if (!(await exists(filePath))) {
              console.log(chalk.red(`✗ File not found: ${filePath}`));
              process.exit(1);
            }

            const customOutput = options.output || `${filePath.replace(/\.md$/, '')}.${format}`;
            outputPath = await exportMarkdownSlides(filePath, customOutput, { format, theme, dark }, workspacePath);
            console.log(chalk.green(`✓ Exported ${filePath} to slides`));
          }
        } else {
          // Parse source argument
          if (source.startsWith('daily:')) {
            const date = source.replace('daily:', '');
            outputPath = await exportDailySlides(workspacePath, date, { format, theme, dark });
            console.log(chalk.green(`✓ Exported daily log ${date} to slides`));
          } else if (source.startsWith('weekly:')) {
            const week = source.replace('weekly:', '');
            outputPath = await exportWeeklySlides(workspacePath, week, { format, theme, dark });
            console.log(chalk.green(`✓ Exported weekly report ${week} to slides`));
          } else if (source.startsWith('project:')) {
            const projectName = source.replace('project:', '');
            outputPath = await exportProjectSlides(workspacePath, projectName, { format, theme, dark });
            console.log(chalk.green(`✓ Exported project "${projectName}" to slides`));
          } else {
            // Treat as file path
            if (!(await exists(source))) {
              console.log(chalk.red(`✗ File not found: ${source}`));
              process.exit(1);
            }

            const customOutput = options.output || `${source.replace(/\.md$/, '')}.${format}`;
            outputPath = await exportMarkdownSlides(source, customOutput, { format, theme, dark }, workspacePath);
            console.log(chalk.green(`✓ Exported ${source} to slides`));
          }
        }

        // Display output location with appropriate message
        if (format === 'html') {
          console.log(chalk.blue(`📊 Output directory: ${outputPath}`));
          console.log(chalk.gray(`   Open ${outputPath}/index.html in a browser to view`));
        } else {
          console.log(chalk.blue(`📊 Output file: ${outputPath}`));
        }
      } catch (error) {
        console.log(chalk.red(`✗ Export failed: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  exportCmd.addCommand(slidesCmd);

  return exportCmd;
}
