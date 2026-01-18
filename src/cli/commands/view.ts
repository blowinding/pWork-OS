/**
 * View CLI Command
 * pwork view - Launch local viewer
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'node:child_process';
import { getCurrentWorkspace } from '../../core/config.js';
import { startViewerServer, stopViewerServer } from '../../viewer/server.js';

// ============================================
// View Command
// ============================================

/**
 * Open URL in default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  const command =
    platform === 'darwin'
      ? `open "${url}"`
      : platform === 'win32'
      ? `start "${url}"`
      : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      console.log(chalk.yellow(`Could not open browser automatically`));
      console.log(chalk.blue(`Please open: ${url}`));
    }
  });
}

/**
 * Register view command
 */
export function registerViewCommand(program: Command): void {
  program
    .command('view')
    .description('Launch local web viewer for documents')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('-h, --host <host>', 'Host to bind to', 'localhost')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (options) => {
      try {
        const workspacePath = await getCurrentWorkspace();
        const port = parseInt(options.port, 10);
        const host = options.host;
        const shouldOpen = options.open !== false;

        console.log(chalk.blue('Starting pWork viewer...'));
        console.log(chalk.gray(`Workspace: ${workspacePath}`));

        const { server, url } = await startViewerServer({
          workspacePath,
          port,
          host,
          openBrowser: false,
        });

        console.log(chalk.green('✓ Viewer started successfully'));
        console.log(chalk.blue(`\n  🌐 Viewer URL: ${url}`));
        console.log(chalk.gray(`\n  Press Ctrl+C to stop the server\n`));

        // Open browser if requested
        if (shouldOpen) {
          setTimeout(() => openBrowser(url), 500);
        }

        // Handle graceful shutdown
        const shutdown = async () => {
          console.log(chalk.yellow('\n\nShutting down viewer...'));
          await stopViewerServer(server);
          console.log(chalk.green('✓ Viewer stopped'));
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        console.log(chalk.red(`✗ Failed to start viewer: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });
}
