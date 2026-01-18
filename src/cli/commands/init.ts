/**
 * Init Command
 * pwork init - 初始化 workspace
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  initWorkspaceDirectories,
  exists,
  getConfigFilePath,
  writeJson,
  writeFile,
  getTemplateFilePath,
} from '../../core/fs.js';
import {
  setDefaultWorkspace,
  addRecentWorkspace,
} from '../../core/config.js';
import { createDefaultWorkspaceConfig } from '../../core/schema.js';
import { getBuiltinTemplate, getTemplateTypes } from '../../template/engine.js';

/**
 * 注册 init 命令
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init [path]')
    .description('Initialize a new pWork workspace')
    .option('-n, --name <name>', 'Workspace name')
    .option('--no-default', 'Do not set as default workspace')
    .option('--templates', 'Copy built-in templates to workspace')
    .action(async (targetPath: string | undefined, options) => {
      try {
        const workspacePath = path.resolve(targetPath || process.cwd());
        const workspaceName = options.name || path.basename(workspacePath);
        const configPath = getConfigFilePath(workspacePath);

        // 检查是否已初始化
        if (await exists(configPath)) {
          console.log(chalk.yellow(`Workspace already initialized at ${workspacePath}`));
          console.log(chalk.gray('Use --force to reinitialize (not implemented yet)'));
          return;
        }

        console.log(chalk.blue(`Initializing workspace: ${workspaceName}`));
        console.log(chalk.gray(`Path: ${workspacePath}`));

        // 创建目录结构
        await initWorkspaceDirectories(workspacePath);
        console.log(chalk.green('  ✓ Created directory structure'));

        // 创建配置文件
        const config = createDefaultWorkspaceConfig(workspaceName);
        await writeJson(configPath, config);
        console.log(chalk.green('  ✓ Created .pwork.json'));

        // 复制模板文件
        if (options.templates) {
          const templateTypes = getTemplateTypes();
          for (const type of templateTypes) {
            const templatePath = getTemplateFilePath(workspacePath, type);
            const content = getBuiltinTemplate(type);
            await writeFile(templatePath, content);
          }
          console.log(chalk.green('  ✓ Created template files'));
        }

        // 设置为默认 workspace
        if (options.default !== false) {
          await setDefaultWorkspace(workspacePath);
          console.log(chalk.green('  ✓ Set as default workspace'));
        }

        // 添加到最近使用
        await addRecentWorkspace(workspacePath);

        console.log();
        console.log(chalk.green.bold('✓ Workspace initialized successfully!'));
        console.log();
        console.log('Next steps:');
        console.log(chalk.cyan('  pwork daily new') + '     Create today\'s daily log');
        console.log(chalk.cyan('  pwork daily list') + '    List all daily logs');
        console.log(chalk.cyan('  pwork project new') + '   Create a new project');
        console.log();
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('An unexpected error occurred'));
        }
        process.exit(1);
      }
    });
}
