#!/usr/bin/env node
/**
 * pWork CLI Entry Point
 * 命令行工具入口
 */

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerConfigCommand } from './commands/config.js';
import { registerDailyCommands } from './commands/daily.js';
import { registerWeeklyCommands } from './commands/weekly.js';
import { registerProjectCommands } from './commands/project.js';
import { createExportCommand } from './commands/export.js';
import { registerViewCommand } from './commands/view.js';

const program = new Command();

program
  .name('pwork')
  .description('Personal Work Operating System - Git-first work management')
  .version('0.1.0');

// 注册命令
registerInitCommand(program);
registerConfigCommand(program);
registerDailyCommands(program);
registerWeeklyCommands(program);
registerProjectCommands(program);
program.addCommand(createExportCommand());
registerViewCommand(program);

// 解析命令行参数
program.parse();
