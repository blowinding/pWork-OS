/**
 * Slides Export Module
 * Convert Markdown documents to presentations using Slidev
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDaily } from '../daily/index.js';
import { getWeekly } from '../weekly/index.js';
import { getProject } from '../project/index.js';
import { getSlidesOutputPath } from '../core/fs.js';
import type { DailyLog, WeeklyReport, Project } from '../core/schema.js';
import {
  type SlidevTheme,
  type SlidevTransition,
  type SlidevProjectConfig,
  generateSlidevProject,
  generateSlidevFrontmatter,
  runSlidevBuild,
  runSlidevExport,
  isSlidevAvailable,
  getSlidevProjectPath,
  cleanupSlidevProject,
} from './slidev.js';

// ============================================
// Types
// ============================================

/** Slide export format */
export type SlideFormat = 'html' | 'pdf' | 'pptx';

/** Slide theme (Slidev themes) */
export type SlideTheme = SlidevTheme;

/** Slide export options */
export interface SlideExportOptions {
  /** Output format */
  format?: SlideFormat;
  /** Slidev theme */
  theme?: SlideTheme;
  /** Transition style */
  transition?: SlidevTransition;
  /** Dark mode for PDF export */
  dark?: boolean;
}

const DEFAULT_SLIDE_OPTIONS: Required<SlideExportOptions> = {
  format: 'html',
  theme: 'default',
  transition: 'slide-left',
  dark: false,
};

// ============================================
// Slidev Integration
// ============================================

// Re-export isSlidevAvailable for CLI usage
export { isSlidevAvailable };

/**
 * Convert markdown content to slides using Slidev CLI
 * @param markdown Slidev-formatted markdown content
 * @param outputPath Output file/directory path
 * @param options Export options
 * @param workspacePath Workspace path for temporary project
 */
export async function convertToSlides(
  markdown: string,
  outputPath: string,
  options: SlideExportOptions = {},
  workspacePath?: string
): Promise<void> {
  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };

  // Generate unique project name from output path
  const projectName = `export-${Date.now()}`;
  const projectPath = workspacePath
    ? getSlidevProjectPath(workspacePath, projectName)
    : path.join(path.dirname(outputPath), '.slidev-temp', projectName);

  const config: SlidevProjectConfig = {
    title: 'Presentation',
    theme: opts.theme,
    transition: opts.transition,
    needsExport: opts.format === 'pdf' || opts.format === 'pptx',
  };

  try {
    // Generate Slidev project with the markdown content
    await generateSlidevProject(projectPath, markdown, config);

    if (opts.format === 'html') {
      // Build static HTML
      await runSlidevBuild(projectPath, { outDir: outputPath });
    } else if (opts.format === 'pdf' || opts.format === 'pptx') {
      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      // Export to PDF or PPTX
      await runSlidevExport(projectPath, {
        output: outputPath,
        format: opts.format,
        dark: opts.dark,
      });
    }
  } finally {
    // Clean up temporary project
    await cleanupSlidevProject(projectPath);
  }
}

// ============================================
// Document to Slides Conversion
// ============================================

/**
 * Add Slidev frontmatter to markdown content
 * @param title Presentation title
 * @param content Original markdown content
 * @param theme Slidev theme
 * @param transition Transition style
 * @returns Markdown with Slidev frontmatter
 */
function addSlidevFrontmatter(
  title: string,
  content: string,
  theme: SlideTheme = 'default',
  transition: SlidevTransition = 'slide-left'
): string {
  const config: SlidevProjectConfig = {
    title,
    theme,
    transition,
  };
  const frontmatter = generateSlidevFrontmatter(config);
  return frontmatter + '\n\n' + content;
}

/**
 * Split long content into multiple slides
 * @param content Content text (without heading)
 * @param maxLines Maximum lines per slide
 * @returns Array of content chunks
 */
function splitLongContent(content: string, maxLines: number = 15): string[] {
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length <= maxLines) {
    return [content];
  }

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLines = 0;

  for (const line of lines) {
    // Start new chunk if we exceed max lines
    if (currentLines >= maxLines && (line.startsWith('-') || line.startsWith('*') || line.startsWith('##'))) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentLines = 0;
      }
    }

    currentChunk.push(line);
    currentLines++;
  }

  // Add remaining content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * Process content section for slides
 * Handles long content by splitting across multiple slides
 * @param title Section title
 * @param content Section content
 * @param maxLines Maximum lines per slide
 * @returns Formatted slides markdown
 */
function processContentSection(title: string, content: string, maxLines: number = 15): string {
  const lines: string[] = [];

  // Filter empty lines and format content
  const cleanContent = content.split('\n').filter((l: string) => l.trim()).join('\n');

  if (!cleanContent) {
    return '';
  }

  // Split long content
  const chunks = splitLongContent(cleanContent, maxLines);

  if (chunks.length === 1) {
    // Single slide for this section
    lines.push(`## ${title.trim()}`);
    lines.push('');
    lines.push(chunks[0]);
    lines.push('');
    lines.push('---');
    lines.push('');
  } else {
    // Multiple slides for this section
    for (let i = 0; i < chunks.length; i++) {
      lines.push(`## ${title.trim()} ${i > 0 ? `(${i + 1})` : ''}`);
      lines.push('');
      lines.push(chunks[i]);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Convert Daily log to slides
 * @param daily Daily document
 * @param theme Slide theme
 * @returns Markdown formatted for Slidev
 */
export function dailyToSlides(daily: DailyLog, theme: SlideTheme = 'default'): string {
  const lines: string[] = [];

  // Title slide (cover layout)
  lines.push('---');
  lines.push('layout: cover');
  lines.push('---');
  lines.push('');
  lines.push(`# ${daily.meta.date} Daily Log`);
  lines.push('');

  if (daily.meta.projects && daily.meta.projects.length > 0) {
    lines.push(`**Projects**: ${daily.meta.projects.join(', ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Parse content sections
  const sections = daily.content.split(/^##\s+/m).filter((s: string) => s.trim());

  for (const section of sections) {
    const [title, ...contentLines] = section.split('\n');
    const content = contentLines.join('\n');

    // Use the new processing function that handles splitting
    const processedSection = processContentSection(title, content);
    if (processedSection) {
      lines.push(processedSection);
    }
  }

  return addSlidevFrontmatter(`${daily.meta.date} Daily Log`, lines.join('\n'), theme);
}

/**
 * Convert Weekly report to slides
 * @param weekly Weekly document
 * @param theme Slide theme
 * @returns Markdown formatted for Slidev
 */
export function weeklyToSlides(weekly: WeeklyReport, theme: SlideTheme = 'default'): string {
  const lines: string[] = [];

  // Title slide (cover layout)
  lines.push('---');
  lines.push('layout: cover');
  lines.push('---');
  lines.push('');
  lines.push(`# Week ${weekly.meta.week} Report`);
  lines.push('');
  lines.push(`**${weekly.meta.start_date} ~ ${weekly.meta.end_date}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Parse content sections
  const sections = weekly.content.split(/^##\s+/m).filter((s: string) => s.trim());

  for (const section of sections) {
    const [title, ...contentLines] = section.split('\n');
    const content = contentLines.join('\n');

    // Use the new processing function that handles splitting
    const processedSection = processContentSection(title, content);
    if (processedSection) {
      lines.push(processedSection);
    }
  }

  return addSlidevFrontmatter(`Week ${weekly.meta.week} Report`, lines.join('\n'), theme);
}

/**
 * Convert Project to slides
 * @param project Project document
 * @param theme Slide theme
 * @returns Markdown formatted for Slidev
 */
export function projectToSlides(project: Project, theme: SlideTheme = 'default'): string {
  const lines: string[] = [];

  // Title slide (cover layout)
  lines.push('---');
  lines.push('layout: cover');
  lines.push('---');
  lines.push('');
  lines.push(`# ${project.meta.project.name}`);
  lines.push('');
  lines.push(`**Type**: ${project.meta.project.type}`);
  lines.push(`**Status**: ${project.meta.project.status}`);
  lines.push('');
  if (project.meta.project.github_repo) {
    lines.push(`**GitHub**: ${project.meta.project.github_repo}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Parse content sections
  const sections = project.content.split(/^##\s+/m).filter(s => s.trim());

  for (const section of sections) {
    const [title, ...contentLines] = section.split('\n');
    const content = contentLines.join('\n');

    // Use the new processing function that handles splitting
    const processedSection = processContentSection(title, content);
    if (processedSection) {
      lines.push(processedSection);
    }
  }

  return addSlidevFrontmatter(project.meta.project.name, lines.join('\n'), theme);
}

// ============================================
// High-level Export Functions
// ============================================

/**
 * Export Daily log to slides
 * @param workspacePath Workspace path
 * @param date Date string (YYYY-MM-DD)
 * @param options Export options
 * @returns Output file path
 */
export async function exportDailySlides(
  workspacePath: string,
  date: string,
  options: SlideExportOptions = {}
): Promise<string> {
  const daily = await getDaily(workspacePath, date);
  if (!daily) {
    throw new Error(`Daily log not found: ${date}`);
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };
  const slideMarkdown = dailyToSlides(daily, opts.theme);

  // For HTML, output is a directory; for PDF/PPTX, it's a file
  const filename = opts.format === 'html' ? `daily-${date}` : `daily-${date}.${opts.format}`;
  const outputPath = getSlidesOutputPath(workspacePath, filename);
  await convertToSlides(slideMarkdown, outputPath, opts, workspacePath);

  return outputPath;
}

/**
 * Export Weekly report to slides
 * @param workspacePath Workspace path
 * @param week Week string (YYYY-Www)
 * @param options Export options
 * @returns Output file path
 */
export async function exportWeeklySlides(
  workspacePath: string,
  week: string,
  options: SlideExportOptions = {}
): Promise<string> {
  const weekly = await getWeekly(workspacePath, week);
  if (!weekly) {
    throw new Error(`Weekly report not found: ${week}`);
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };
  const slideMarkdown = weeklyToSlides(weekly, opts.theme);

  // For HTML, output is a directory; for PDF/PPTX, it's a file
  const filename = opts.format === 'html' ? `weekly-${week}` : `weekly-${week}.${opts.format}`;
  const outputPath = getSlidesOutputPath(workspacePath, filename);
  await convertToSlides(slideMarkdown, outputPath, opts, workspacePath);

  return outputPath;
}

/**
 * Export Project to slides
 * @param workspacePath Workspace path
 * @param projectName Project name
 * @param options Export options
 * @returns Output file path
 */
export async function exportProjectSlides(
  workspacePath: string,
  projectName: string,
  options: SlideExportOptions = {}
): Promise<string> {
  const project = await getProject(workspacePath, projectName);
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };
  const slideMarkdown = projectToSlides(project, opts.theme);

  const projectSlug = project.filePath.split('/').pop()?.replace('.md', '') || projectName;
  // For HTML, output is a directory; for PDF/PPTX, it's a file
  const filename = opts.format === 'html' ? `project-${projectSlug}` : `project-${projectSlug}.${opts.format}`;
  const outputPath = getSlidesOutputPath(workspacePath, filename);
  await convertToSlides(slideMarkdown, outputPath, opts, workspacePath);

  return outputPath;
}

/**
 * Export custom markdown file to slides
 * @param markdownPath Path to markdown file
 * @param outputPath Output file path
 * @param options Export options
 * @param workspacePath Optional workspace path for temporary project
 */
export async function exportMarkdownSlides(
  markdownPath: string,
  outputPath: string,
  options: SlideExportOptions = {},
  workspacePath?: string
): Promise<string> {
  const content = await fs.readFile(markdownPath, 'utf-8');
  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };

  // Add Slidev frontmatter if not already present
  const filename = path.basename(markdownPath, '.md');
  const slideMarkdown = content.includes('theme:')
    ? content
    : addSlidevFrontmatter(filename, content, opts.theme, opts.transition);

  await convertToSlides(slideMarkdown, outputPath, opts, workspacePath);
  return outputPath;
}
