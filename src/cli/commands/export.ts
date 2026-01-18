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
  isRevealMdAvailable,
  type SlideFormat,
  type SlideTheme,
} from '../../export/slides.js';
import { listProjects } from '../../project/index.js';
import { exists } from '../../core/fs.js';

// ============================================
// Export Slides Command
// ============================================

/**
 * pwork export slides [source]
 */
export function createExportCommand(): Command {
  const exportCmd = new Command('export');
  exportCmd.description('Export documents to various formats');

  // Slides subcommand
  const slidesCmd = new Command('slides');
  slidesCmd
    .description('Export document to slides presentation')
    .argument('[source]', 'Source document (daily:YYYY-MM-DD, weekly:YYYY-Www, project:name, or file path)')
    .option('-f, --format <format>', 'Output format (html, pdf)', 'html')
    .option('-t, --theme <theme>', 'reveal.js theme (black, white, league, sky, beige, night, serif, simple, solarized, blood, moon)', 'black')
    .option('-o, --output <path>', 'Custom output path')
    .action(async (source, options) => {
      try {
        // Check reveal-md availability
        if (!(await isRevealMdAvailable())) {
          console.log(chalk.red('✗ reveal-md CLI is not available'));
          console.log(chalk.yellow('Please ensure reveal-md is installed'));
          console.log(chalk.yellow('Run: npm install -g reveal-md'));
          process.exit(1);
        }

        const workspacePath = await getCurrentWorkspace();
        const format = options.format as SlideFormat;
        const theme = options.theme as SlideTheme;

        // Validate format
        if (!['html', 'pdf'].includes(format)) {
          console.log(chalk.red(`✗ Invalid format: ${format}`));
          console.log(chalk.yellow('Valid formats: html, pdf'));
          process.exit(1);
        }

        // Validate theme
        const validThemes = ['black', 'white', 'league', 'sky', 'beige', 'night', 'serif', 'simple', 'solarized', 'blood', 'moon'];
        if (!validThemes.includes(theme)) {
          console.log(chalk.red(`✗ Invalid theme: ${theme}`));
          console.log(chalk.yellow(`Valid themes: ${validThemes.join(', ')}`));
          process.exit(1);
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
            outputPath = await exportDailySlides(workspacePath, date, { format, theme });
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
            outputPath = await exportWeeklySlides(workspacePath, week, { format, theme });
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
            outputPath = await exportProjectSlides(workspacePath, projectName, { format, theme });
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
            outputPath = await exportMarkdownSlides(filePath, customOutput, { format, theme }, workspacePath);
            console.log(chalk.green(`✓ Exported ${filePath} to slides`));
          }
        } else {
          // Parse source argument
          if (source.startsWith('daily:')) {
            const date = source.replace('daily:', '');
            outputPath = await exportDailySlides(workspacePath, date, { format, theme });
            console.log(chalk.green(`✓ Exported daily log ${date} to slides`));
          } else if (source.startsWith('weekly:')) {
            const week = source.replace('weekly:', '');
            outputPath = await exportWeeklySlides(workspacePath, week, { format, theme });
            console.log(chalk.green(`✓ Exported weekly report ${week} to slides`));
          } else if (source.startsWith('project:')) {
            const projectName = source.replace('project:', '');
            outputPath = await exportProjectSlides(workspacePath, projectName, { format, theme });
            console.log(chalk.green(`✓ Exported project "${projectName}" to slides`));
          } else {
            // Treat as file path
            if (!(await exists(source))) {
              console.log(chalk.red(`✗ File not found: ${source}`));
              process.exit(1);
            }

            const customOutput = options.output || `${source.replace(/\.md$/, '')}.${format}`;
            outputPath = await exportMarkdownSlides(source, customOutput, { format, theme }, workspacePath);
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
