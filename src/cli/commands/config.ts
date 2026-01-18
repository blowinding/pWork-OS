/**
 * Config Command
 * pwork config - 管理全局配置
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  loadGlobalConfig,
  setGitHubToken,
  setDefaultWorkspace,
  getDefaultWorkspace,
  getGitHubToken,
  getGlobalConfigPath,
  loadWorkspaceConfig,
} from '../../core/config.js';
import { exists, getConfigFilePath } from '../../core/fs.js';

/**
 * 注册 config 命令
 */
export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage global configuration');

  // config set-token - 设置 GitHub Token
  config
    .command('set-token <token>')
    .description('Set GitHub Personal Access Token')
    .action(async (token: string) => {
      try {
        await setGitHubToken(token);
        console.log(chalk.green('✓ GitHub token saved successfully'));
        console.log(chalk.gray(`Config location: ${getGlobalConfigPath()}`));
        console.log();
        console.log(chalk.yellow('Note: You can also set token via environment variables:'));
        console.log(chalk.cyan('  export GITHUB_TOKEN=<your-token>'));
        console.log(chalk.cyan('  export GH_TOKEN=<your-token>'));
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('Failed to save GitHub token'));
        }
        process.exit(1);
      }
    });

  // config get-token - 获取 GitHub Token（显示前几位）
  config
    .command('get-token')
    .description('Show GitHub token (masked)')
    .action(async () => {
      try {
        const token = await getGitHubToken();

        if (!token) {
          console.log(chalk.yellow('No GitHub token configured'));
          console.log();
          console.log('Set token with:');
          console.log(chalk.cyan('  pwork config set-token <your-token>'));
          console.log();
          console.log('Or use environment variables:');
          console.log(chalk.cyan('  export GITHUB_TOKEN=<your-token>'));
          console.log(chalk.cyan('  export GH_TOKEN=<your-token>'));
          return;
        }

        const masked = token.slice(0, 7) + '...' + token.slice(-4);
        console.log(chalk.green('GitHub Token:'), masked);

        if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
          console.log(chalk.gray('(from environment variable)'));
        } else {
          console.log(chalk.gray(`(from ${getGlobalConfigPath()})`));
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('Failed to get GitHub token'));
        }
        process.exit(1);
      }
    });

  // config set-workspace - 设置默认工作空间
  config
    .command('set-workspace <path>')
    .description('Set default workspace path')
    .action(async (workspacePath: string) => {
      try {
        const resolvedPath = path.resolve(workspacePath);
        const configPath = getConfigFilePath(resolvedPath);

        // 验证是否是有效的 workspace
        if (!(await exists(configPath))) {
          console.log(chalk.red(`Error: Not a valid pWork workspace: ${resolvedPath}`));
          console.log();
          console.log('Initialize a workspace with:');
          console.log(chalk.cyan(`  pwork init ${workspacePath}`));
          process.exit(1);
        }

        await setDefaultWorkspace(resolvedPath);
        console.log(chalk.green('✓ Default workspace set successfully'));
        console.log(chalk.gray(`Path: ${resolvedPath}`));
        console.log(chalk.gray(`Config location: ${getGlobalConfigPath()}`));
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('Failed to set default workspace'));
        }
        process.exit(1);
      }
    });

  // config get-workspace - 获取默认工作空间
  config
    .command('get-workspace')
    .description('Show default workspace path')
    .action(async () => {
      try {
        const workspacePath = await getDefaultWorkspace();

        if (!workspacePath) {
          console.log(chalk.yellow('No default workspace configured'));
          console.log();
          console.log('Set default workspace with:');
          console.log(chalk.cyan('  pwork config set-workspace <path>'));
          console.log();
          console.log('Or initialize a new workspace:');
          console.log(chalk.cyan('  pwork init <path>'));
          return;
        }

        console.log(chalk.green('Default Workspace:'), workspacePath);

        // 检查是否仍然有效
        const configPath = getConfigFilePath(workspacePath);
        if (!(await exists(configPath))) {
          console.log(chalk.yellow('⚠ Warning: Workspace not found or invalid'));
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('Failed to get default workspace'));
        }
        process.exit(1);
      }
    });

  // config show - 显示所有配置
  config
    .command('show')
    .description('Show all global configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const globalConfig = await loadGlobalConfig();
        const token = await getGitHubToken();

        if (options.json) {
          // JSON 输出（隐藏完整 token）
          const output = {
            ...globalConfig,
            githubToken: token ? `${token.slice(0, 7)}...${token.slice(-4)}` : null,
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // 人类可读输出
        console.log(chalk.bold('\n📋 Global Configuration\n'));
        console.log(chalk.gray(`Config file: ${getGlobalConfigPath()}\n`));

        // Default Workspace
        console.log(chalk.blue('Default Workspace:'));
        if (globalConfig.defaultWorkspace) {
          console.log(`  ${globalConfig.defaultWorkspace}`);

          // 验证工作空间
          const configPath = getConfigFilePath(globalConfig.defaultWorkspace);
          if (await exists(configPath)) {
            const wsConfig = await loadWorkspaceConfig(globalConfig.defaultWorkspace);
            if (wsConfig) {
              console.log(chalk.gray(`  Name: ${wsConfig.name}`));
              console.log(chalk.gray(`  Version: ${wsConfig.version}`));
            }
          } else {
            console.log(chalk.yellow('  ⚠ Workspace not found'));
          }
        } else {
          console.log(chalk.gray('  (not set)'));
        }
        console.log();

        // GitHub Token
        console.log(chalk.blue('GitHub Token:'));
        if (token) {
          const masked = token.slice(0, 7) + '...' + token.slice(-4);
          console.log(`  ${masked}`);
          if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
            console.log(chalk.gray('  Source: environment variable'));
          } else {
            console.log(chalk.gray('  Source: config file'));
          }
        } else {
          console.log(chalk.gray('  (not set)'));
        }
        console.log();

        // Recent Workspaces
        console.log(chalk.blue('Recent Workspaces:'));
        if (globalConfig.recentWorkspaces && globalConfig.recentWorkspaces.length > 0) {
          for (const ws of globalConfig.recentWorkspaces.slice(0, 5)) {
            const exists_ = await exists(getConfigFilePath(ws));
            const status = exists_ ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${status} ${ws}`);
          }
          if (globalConfig.recentWorkspaces.length > 5) {
            console.log(chalk.gray(`  ... and ${globalConfig.recentWorkspaces.length - 5} more`));
          }
        } else {
          console.log(chalk.gray('  (none)'));
        }
        console.log();

        // Preferences
        console.log(chalk.blue('Preferences:'));
        if (globalConfig.preferences) {
          if (globalConfig.preferences.editor) {
            console.log(`  Editor: ${globalConfig.preferences.editor}`);
          }
          if (globalConfig.preferences.dateFormat) {
            console.log(`  Date Format: ${globalConfig.preferences.dateFormat}`);
          }
          if (globalConfig.preferences.weekStartsOn !== undefined) {
            const day = globalConfig.preferences.weekStartsOn === 0 ? 'Sunday' : 'Monday';
            console.log(`  Week Starts On: ${day}`);
          }
        } else {
          console.log(chalk.gray('  (using defaults)'));
        }
        console.log();

      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('Failed to show configuration'));
        }
        process.exit(1);
      }
    });

  // config reset - 重置配置（危险操作）
  config
    .command('reset')
    .description('Reset global configuration (dangerous!)')
    .option('--confirm', 'Confirm reset without prompt')
    .action(async (options) => {
      try {
        if (!options.confirm) {
          console.log(chalk.yellow('⚠ This will reset all global configuration!'));
          console.log(chalk.gray('Use --confirm flag to proceed'));
          return;
        }

        // 重置为默认配置
        const { saveGlobalConfig } = await import('../../core/config.js');
        await saveGlobalConfig({
          recentWorkspaces: [],
          preferences: {
            weekStartsOn: 1,
            dateFormat: 'YYYY-MM-DD',
          },
        });

        console.log(chalk.green('✓ Global configuration reset successfully'));
        console.log(chalk.gray(`Config file: ${getGlobalConfigPath()}`));
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('Failed to reset configuration'));
        }
        process.exit(1);
      }
    });

  // config path - 显示配置文件路径
  config
    .command('path')
    .description('Show global config file path')
    .action(() => {
      console.log(getGlobalConfigPath());
    });
}
