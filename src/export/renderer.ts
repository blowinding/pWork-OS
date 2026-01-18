/**
 * Markdown Renderer Module
 * Convert Markdown to HTML for viewing
 */

import { marked } from 'marked';
import type { DailyLog, WeeklyReport, Project } from '../core/schema.js';

// ============================================
// Renderer Configuration
// ============================================

/**
 * Configure marked options
 */
export function configureMarked(): void {
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
  });
}

// Initialize on module load
configureMarked();

// ============================================
// HTML Templates
// ============================================

/**
 * Wrap HTML content in a complete HTML document
 * @param title Document title
 * @param body HTML body content
 * @returns Complete HTML document
 */
function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      color: #24292e;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    code {
      background-color: rgba(27,31,35,0.05);
      border-radius: 3px;
      font-size: 85%;
      margin: 0;
      padding: 0.2em 0.4em;
    }
    pre {
      background-color: #f6f8fa;
      border-radius: 3px;
      font-size: 85%;
      line-height: 1.45;
      overflow: auto;
      padding: 16px;
    }
    pre code {
      background-color: transparent;
      border: 0;
      display: inline;
      line-height: inherit;
      margin: 0;
      overflow: visible;
      padding: 0;
      word-wrap: normal;
    }
    blockquote {
      border-left: 4px solid #dfe2e5;
      color: #6a737d;
      padding: 0 1em;
      margin: 0 0 16px 0;
    }
    ul, ol {
      padding-left: 2em;
      margin-bottom: 16px;
    }
    table {
      border-collapse: collapse;
      border-spacing: 0;
      margin-bottom: 16px;
      width: 100%;
    }
    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }
    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    hr {
      background-color: #e1e4e8;
      border: 0;
      height: 2px;
      margin: 24px 0;
    }
    .metadata {
      background-color: #f6f8fa;
      border-radius: 3px;
      padding: 16px;
      margin-bottom: 24px;
      font-size: 0.9em;
    }
    .metadata dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px;
      margin: 0;
    }
    .metadata dt {
      font-weight: 600;
      color: #586069;
    }
    .metadata dd {
      margin: 0;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ============================================
// Markdown to HTML Conversion
// ============================================

/**
 * Convert markdown string to HTML
 * @param markdown Markdown content
 * @returns HTML string
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown) as string;
}

/**
 * Render Daily log as HTML
 * @param daily Daily document
 * @returns Complete HTML document
 */
export function renderDaily(daily: DailyLog): string {
  const metadata = `
<div class="metadata">
  <dl>
    <dt>Date:</dt>
    <dd>${daily.meta.date}</dd>
    <dt>Week:</dt>
    <dd>${daily.meta.week || 'N/A'}</dd>
    ${daily.meta.projects && daily.meta.projects.length > 0 ? `
    <dt>Projects:</dt>
    <dd>${daily.meta.projects.join(', ')}</dd>
    ` : ''}
    ${daily.meta.tags && daily.meta.tags.length > 0 ? `
    <dt>Tags:</dt>
    <dd>${daily.meta.tags.join(', ')}</dd>
    ` : ''}
    ${daily.meta.weekly_highlight ? `
    <dt>Weekly Highlight:</dt>
    <dd>Yes</dd>
    ` : ''}
  </dl>
</div>`;

  const content = markdownToHtml(daily.content);
  const body = metadata + content;

  return wrapHtml(`Daily Log - ${daily.meta.date}`, body);
}

/**
 * Render Weekly report as HTML
 * @param weekly Weekly document
 * @returns Complete HTML document
 */
export function renderWeekly(weekly: WeeklyReport): string {
  const metadata = `
<div class="metadata">
  <dl>
    <dt>Week:</dt>
    <dd>${weekly.meta.week}</dd>
    <dt>Date Range:</dt>
    <dd>${weekly.meta.start_date} to ${weekly.meta.end_date}</dd>
    ${weekly.meta.projects && weekly.meta.projects.length > 0 ? `
    <dt>Projects:</dt>
    <dd>${weekly.meta.projects.join(', ')}</dd>
    ` : ''}
  </dl>
</div>`;

  const content = markdownToHtml(weekly.content);
  const body = metadata + content;

  return wrapHtml(`Week ${weekly.meta.week}`, body);
}

/**
 * Render Project as HTML
 * @param project Project document
 * @returns Complete HTML document
 */
export function renderProject(project: Project): string {
  const metadata = `
<div class="metadata">
  <dl>
    <dt>Name:</dt>
    <dd>${project.meta.project.name}</dd>
    <dt>Type:</dt>
    <dd>${project.meta.project.type}</dd>
    <dt>Status:</dt>
    <dd>${project.meta.project.status}</dd>
    ${project.meta.project.github_repo ? `
    <dt>GitHub:</dt>
    <dd><a href="${project.meta.project.github_repo}" target="_blank">${project.meta.project.github_repo}</a></dd>
    ` : ''}
    ${project.meta.project.start_date ? `
    <dt>Start Date:</dt>
    <dd>${project.meta.project.start_date}</dd>
    ` : ''}
    ${project.meta.project.end_date ? `
    <dt>End Date:</dt>
    <dd>${project.meta.project.end_date}</dd>
    ` : ''}
  </dl>
</div>`;

  const content = markdownToHtml(project.content);
  const body = metadata + content;

  return wrapHtml(project.meta.project.name, body);
}
