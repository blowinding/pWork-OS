/**
 * Viewer Web Server Module
 * Provides local web interface for viewing documents
 */

import http from 'node:http';
import { URL } from 'node:url';
import { listDaily } from '../daily/index.js';
import { listWeekly } from '../weekly/index.js';
import { listProjects } from '../project/index.js';
import { getDaily } from '../daily/index.js';
import { getWeekly } from '../weekly/index.js';
import { getProject } from '../project/index.js';
import { renderDaily, renderWeekly, renderProject } from '../export/renderer.js';
import { generateTimelineView, generateListView, generateHomeView } from './templates.js';

// ============================================
// Types
// ============================================

export interface ViewerOptions {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Workspace path */
  workspacePath: string;
  /** Auto-open browser */
  openBrowser?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<ViewerOptions, 'workspacePath'>> = {
  port: 3000,
  host: 'localhost',
  openBrowser: true,
};

// ============================================
// Server Implementation
// ============================================

/**
 * Start the viewer web server
 * @param options Server options
 * @returns Server instance and URL
 */
export async function startViewerServer(
  options: ViewerOptions
): Promise<{ server: http.Server; url: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { workspacePath, port, host } = opts;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Set CORS headers for local access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      // Route handling
      if (pathname === '/' || pathname === '/home') {
        // Home page
        const html = await generateHomeView(workspacePath);
        res.writeHead(200);
        res.end(html);
      } else if (pathname === '/timeline') {
        // Timeline view (all daily logs)
        const dailyLogs = await listDaily(workspacePath);
        const html = generateTimelineView(dailyLogs);
        res.writeHead(200);
        res.end(html);
      } else if (pathname === '/weekly') {
        // Weekly reports list
        const weeklyReports = await listWeekly(workspacePath);
        const html = generateListView('Weekly Reports', weeklyReports, 'weekly');
        res.writeHead(200);
        res.end(html);
      } else if (pathname === '/projects') {
        // Projects list
        const projects = await listProjects(workspacePath);
        const html = generateListView('Projects', projects, 'project');
        res.writeHead(200);
        res.end(html);
      } else if (pathname.startsWith('/daily/')) {
        // View specific daily log
        const date = pathname.replace('/daily/', '');
        const daily = await getDaily(workspacePath, date);
        if (daily) {
          const html = renderDaily(daily);
          res.writeHead(200);
          res.end(html);
        } else {
          res.writeHead(404);
          res.end('<h1>Daily log not found</h1>');
        }
      } else if (pathname.startsWith('/weekly/')) {
        // View specific weekly report
        const week = pathname.replace('/weekly/', '');
        const weekly = await getWeekly(workspacePath, week);
        if (weekly) {
          const html = renderWeekly(weekly);
          res.writeHead(200);
          res.end(html);
        } else {
          res.writeHead(404);
          res.end('<h1>Weekly report not found</h1>');
        }
      } else if (pathname.startsWith('/project/')) {
        // View specific project
        const projectName = decodeURIComponent(pathname.replace('/project/', ''));
        const project = await getProject(workspacePath, projectName);
        if (project) {
          const html = renderProject(project);
          res.writeHead(200);
          res.end(html);
        } else {
          res.writeHead(404);
          res.end('<h1>Project not found</h1>');
        }
      } else {
        // 404
        res.writeHead(404);
        res.end('<h1>404 Not Found</h1>');
      }
    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500);
      res.end(`<h1>500 Internal Server Error</h1><pre>${error}</pre>`);
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      resolve({ server, url });
    });
  });
}

/**
 * Stop the viewer server
 * @param server Server instance to stop
 */
export async function stopViewerServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
