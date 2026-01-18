/**
 * HTML Templates for Viewer
 * Generates HTML views for documents
 */

import type { DailyLog, WeeklyReport, Project } from '../core/schema.js';

// ============================================
// Base HTML Template
// ============================================

function wrapPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - pWork Viewer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #24292e;
      background-color: #f6f8fa;
    }
    .header {
      background-color: #24292e;
      color: white;
      padding: 1rem 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .nav {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.5rem;
    }
    .nav a {
      color: #79b8ff;
      text-decoration: none;
      font-weight: 500;
    }
    .nav a:hover {
      text-decoration: underline;
    }
    .container {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 2rem;
    }
    .card {
      background: white;
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #0366d6;
    }
    .card-title a {
      color: #0366d6;
      text-decoration: none;
    }
    .card-title a:hover {
      text-decoration: underline;
    }
    .card-meta {
      font-size: 0.9rem;
      color: #586069;
      margin-bottom: 0.75rem;
    }
    .card-meta span {
      margin-right: 1rem;
    }
    .card-content {
      color: #24292e;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 3px;
      margin-right: 0.5rem;
    }
    .badge-active { background-color: #28a745; color: white; }
    .badge-completed { background-color: #6f42c1; color: white; }
    .badge-paused { background-color: #ffc107; color: #24292e; }
    .badge-planning { background-color: #17a2b8; color: white; }
    .timeline {
      position: relative;
      padding-left: 2rem;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 0.5rem;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: #e1e4e8;
    }
    .timeline-item {
      position: relative;
      margin-bottom: 2rem;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -1.5rem;
      top: 0.5rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #0366d6;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #0366d6;
    }
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #586069;
    }
    .empty-state-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 pWork Viewer</h1>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/timeline">Timeline</a>
      <a href="/weekly">Weekly Reports</a>
      <a href="/projects">Projects</a>
    </nav>
  </div>
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}

// ============================================
// View Generators
// ============================================

/**
 * Generate home view
 */
export async function generateHomeView(workspacePath: string): Promise<string> {
  const content = `
    <div style="text-align: center; padding: 4rem 0;">
      <h1 style="font-size: 3rem; margin-bottom: 1rem;">Welcome to pWork Viewer</h1>
      <p style="font-size: 1.2rem; color: #586069; margin-bottom: 3rem;">
        Your personal work operating system
      </p>
      <div class="grid">
        <div class="card">
          <div class="card-title">📅 Timeline</div>
          <div class="card-content">
            <p>View all your daily logs in chronological order.</p>
            <p style="margin-top: 1rem;"><a href="/timeline">Go to Timeline →</a></p>
          </div>
        </div>
        <div class="card">
          <div class="card-title">📊 Weekly Reports</div>
          <div class="card-content">
            <p>Browse your weekly summaries and achievements.</p>
            <p style="margin-top: 1rem;"><a href="/weekly">View Weekly Reports →</a></p>
          </div>
        </div>
        <div class="card">
          <div class="card-title">🚀 Projects</div>
          <div class="card-content">
            <p>Manage and track all your projects.</p>
            <p style="margin-top: 1rem;"><a href="/projects">View Projects →</a></p>
          </div>
        </div>
      </div>
      <p style="margin-top: 3rem; color: #586069; font-size: 0.9rem;">
        Workspace: <code style="background: #f6f8fa; padding: 0.2rem 0.5rem; border-radius: 3px;">${workspacePath}</code>
      </p>
    </div>
  `;

  return wrapPage('Home', content);
}

/**
 * Generate timeline view
 */
export function generateTimelineView(dailyLogs: DailyLog[]): string {
  if (dailyLogs.length === 0) {
    return wrapPage('Timeline', `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h2>No daily logs found</h2>
        <p>Create your first daily log with <code>pwork daily new</code></p>
      </div>
    `);
  }

  // Sort by date descending (newest first)
  const sorted = [...dailyLogs].sort((a, b) =>
    b.meta.date.localeCompare(a.meta.date)
  );

  const items = sorted.map(daily => {
    const preview = daily.content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .slice(0, 3)
      .join(' ')
      .substring(0, 200);

    return `
      <div class="timeline-item">
        <div class="card">
          <div class="card-title">
            <a href="/daily/${daily.meta.date}">${daily.meta.date}</a>
          </div>
          <div class="card-meta">
            ${daily.meta.week ? `<span>📅 ${daily.meta.week}</span>` : ''}
            ${daily.meta.projects && daily.meta.projects.length > 0
              ? `<span>🚀 ${daily.meta.projects.join(', ')}</span>`
              : ''}
            ${daily.meta.weekly_highlight
              ? '<span class="badge badge-active">⭐ Highlight</span>'
              : ''}
          </div>
          <div class="card-content">
            ${preview}${preview.length >= 200 ? '...' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('\n');

  const content = `
    <h1 style="margin-bottom: 2rem;">📅 Timeline</h1>
    <div class="timeline">
      ${items}
    </div>
  `;

  return wrapPage('Timeline', content);
}

/**
 * Generate list view for weekly reports or projects
 */
export function generateListView(
  title: string,
  items: WeeklyReport[] | Project[],
  type: 'weekly' | 'project'
): string {
  if (items.length === 0) {
    const emptyMessage = type === 'weekly'
      ? 'Create your first weekly report with <code>pwork weekly new</code>'
      : 'Create your first project with <code>pwork project new</code>';

    return wrapPage(title, `
      <div class="empty-state">
        <div class="empty-state-icon">${type === 'weekly' ? '📊' : '🚀'}</div>
        <h2>No ${type === 'weekly' ? 'weekly reports' : 'projects'} found</h2>
        <p>${emptyMessage}</p>
      </div>
    `);
  }

  const cards = items.map(item => {
    if (type === 'weekly') {
      const weekly = item as WeeklyReport;
      return `
        <div class="card">
          <div class="card-title">
            <a href="/weekly/${weekly.meta.week}">Week ${weekly.meta.week}</a>
          </div>
          <div class="card-meta">
            <span>📅 ${weekly.meta.start_date} ~ ${weekly.meta.end_date}</span>
            ${weekly.meta.projects && weekly.meta.projects.length > 0
              ? `<span>🚀 ${weekly.meta.projects.join(', ')}</span>`
              : ''}
          </div>
        </div>
      `;
    } else {
      const project = item as Project;
      const statusBadge = {
        'Planning': 'badge-planning',
        'Doing': 'badge-active',
        'Blocked': 'badge-paused',
        'Done': 'badge-completed'
      }[project.meta.project.status] || 'badge-active';

      return `
        <div class="card">
          <div class="card-title">
            <a href="/project/${encodeURIComponent(project.meta.project.name)}">
              ${project.meta.project.name}
            </a>
          </div>
          <div class="card-meta">
            <span class="badge ${statusBadge}">${project.meta.project.status}</span>
            <span>📦 ${project.meta.project.type}</span>
            ${project.meta.project.github_repo
              ? `<span><a href="${project.meta.project.github_repo}" target="_blank">GitHub ↗</a></span>`
              : ''}
          </div>
        </div>
      `;
    }
  }).join('\n');

  const content = `
    <h1 style="margin-bottom: 2rem;">${type === 'weekly' ? '📊' : '🚀'} ${title}</h1>
    <div class="grid">
      ${cards}
    </div>
  `;

  return wrapPage(title, content);
}
