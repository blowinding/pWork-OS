/**
 * Slides Export Module
 * Convert Markdown documents to presentations using reveal-md
 */

import { promises as fs } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getDaily } from '../daily/index.js';
import { getWeekly } from '../weekly/index.js';
import { getProject } from '../project/index.js';
import { getSlidesOutputPath, getCustomCssPath, exists } from '../core/fs.js';
import type { DailyLog, WeeklyReport, Project } from '../core/schema.js';

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

/** Slide export format */
export type SlideFormat = 'html' | 'pdf';

/** Slide theme (reveal.js themes) */
export type SlideTheme = 'black' | 'white' | 'league' | 'sky' | 'beige' | 'night' | 'serif' | 'simple' | 'solarized' | 'blood' | 'moon';

/** Slide export options */
export interface SlideExportOptions {
  /** Output format */
  format?: SlideFormat;
  /** reveal.js theme */
  theme?: SlideTheme;
  /** Custom CSS file path */
  customCss?: string;
  /** reveal.js presentation options */
  revealOptions?: {
    /** Transition style */
    transition?: 'none' | 'fade' | 'slide' | 'convex' | 'concave' | 'zoom';
    /** Show controls */
    controls?: boolean;
    /** Show progress bar */
    progress?: boolean;
  };
}

const DEFAULT_SLIDE_OPTIONS: Required<SlideExportOptions> = {
  format: 'html',
  theme: 'black',
  customCss: '',
  revealOptions: {
    transition: 'slide',
    controls: true,
    progress: true,
  },
};

// ============================================
// reveal-md Integration
// ============================================

/**
 * Convert markdown content to slides using reveal-md CLI
 * @param markdown Markdown content
 * @param outputPath Output file/directory path
 * @param options Export options
 */
export async function convertToSlides(
  markdown: string,
  outputPath: string,
  options: SlideExportOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };

  // Create temporary markdown file
  const tempMdPath = `${outputPath}.temp.md`;
  await fs.writeFile(tempMdPath, markdown, 'utf-8');

  try {
    // Build reveal-md command
    const revealArgs: string[] = [tempMdPath];

    // Add format-specific args
    if (opts.format === 'html') {
      // For HTML, output is a directory with index.html
      revealArgs.push('--static', outputPath);
    } else if (opts.format === 'pdf') {
      // For PDF, output is a single file
      revealArgs.push('--print', outputPath);
      revealArgs.push('--print-size', 'A4');
    }

    // Add theme
    revealArgs.push('--theme', opts.theme);

    // Add custom CSS if provided
    if (opts.customCss) {
      revealArgs.push('--css', opts.customCss);
    }

    // Execute reveal-md CLI
    const command = `npx reveal-md ${revealArgs.join(' ')}`;
    await execAsync(command);
  } finally {
    // Clean up temp file
    await fs.unlink(tempMdPath).catch(() => {});
  }
}

/**
 * Check if reveal-md CLI is available
 */
export async function isRevealMdAvailable(): Promise<boolean> {
  try {
    await execAsync('npx reveal-md --version');
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Document to Slides Conversion
// ============================================

/**
 * Add reveal.js frontmatter to markdown content
 * @param content Original markdown content
 * @param theme reveal.js theme
 * @param revealOptions Optional reveal.js configuration
 * @returns Markdown with reveal.js directives
 */
function addRevealDirectives(
  content: string,
  theme: SlideTheme = 'black',
  revealOptions?: SlideExportOptions['revealOptions']
): string {
  const opts = revealOptions || DEFAULT_SLIDE_OPTIONS.revealOptions;
  const revealHeader = `---
theme: ${theme}
revealOptions:
  transition: ${opts.transition}
  controls: ${opts.controls}
  progress: ${opts.progress}
---

`;
  return revealHeader + content;
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
 * @returns Markdown formatted for slides
 */
export function dailyToSlides(daily: DailyLog, theme: SlideTheme = 'black'): string {
  const lines: string[] = [];

  // Title slide
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

  return addRevealDirectives(lines.join('\n'), theme);
}

/**
 * Convert Weekly report to slides
 * @param weekly Weekly document
 * @param theme Slide theme
 * @returns Markdown formatted for slides
 */
export function weeklyToSlides(weekly: WeeklyReport, theme: SlideTheme = 'black'): string {
  const lines: string[] = [];

  // Title slide
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

  return addRevealDirectives(lines.join('\n'), theme);
}

/**
 * Convert Project to slides
 * @param project Project document
 * @param theme Slide theme
 * @returns Markdown formatted for slides
 */
export function projectToSlides(project: Project, theme: SlideTheme = 'black'): string {
  const lines: string[] = [];

  // Title slide
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

  return addRevealDirectives(lines.join('\n'), theme);
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

  // Add custom CSS if it exists and not already specified
  if (!options.customCss) {
    const customCssPath = getCustomCssPath(workspacePath, 'reveal-custom');
    if (await exists(customCssPath)) {
      options.customCss = customCssPath;
    }
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };
  const slideMarkdown = dailyToSlides(daily, opts.theme);

  // For HTML, output is a directory; for PDF, it's a file
  const filename = opts.format === 'html' ? `daily-${date}` : `daily-${date}.${opts.format}`;
  const outputPath = getSlidesOutputPath(workspacePath, filename);
  await convertToSlides(slideMarkdown, outputPath, opts);

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

  // Add custom CSS if it exists and not already specified
  if (!options.customCss) {
    const customCssPath = getCustomCssPath(workspacePath, 'reveal-custom');
    if (await exists(customCssPath)) {
      options.customCss = customCssPath;
    }
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };
  const slideMarkdown = weeklyToSlides(weekly, opts.theme);

  // For HTML, output is a directory; for PDF, it's a file
  const filename = opts.format === 'html' ? `weekly-${week}` : `weekly-${week}.${opts.format}`;
  const outputPath = getSlidesOutputPath(workspacePath, filename);
  await convertToSlides(slideMarkdown, outputPath, opts);

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

  // Add custom CSS if it exists and not already specified
  if (!options.customCss) {
    const customCssPath = getCustomCssPath(workspacePath, 'reveal-custom');
    if (await exists(customCssPath)) {
      options.customCss = customCssPath;
    }
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };
  const slideMarkdown = projectToSlides(project, opts.theme);

  const projectSlug = project.filePath.split('/').pop()?.replace('.md', '') || projectName;
  // For HTML, output is a directory; for PDF, it's a file
  const filename = opts.format === 'html' ? `project-${projectSlug}` : `project-${projectSlug}.${opts.format}`;
  const outputPath = getSlidesOutputPath(workspacePath, filename);
  await convertToSlides(slideMarkdown, outputPath, opts);

  return outputPath;
}

/**
 * Export custom markdown file to slides
 * @param markdownPath Path to markdown file
 * @param outputPath Output file path
 * @param options Export options
 * @param workspacePath Optional workspace path for custom CSS detection
 */
export async function exportMarkdownSlides(
  markdownPath: string,
  outputPath: string,
  options: SlideExportOptions = {},
  workspacePath?: string
): Promise<string> {
  const content = await fs.readFile(markdownPath, 'utf-8');

  // Add custom CSS if workspace provided and CSS exists
  if (workspacePath && !options.customCss) {
    const customCssPath = getCustomCssPath(workspacePath, 'reveal-custom');
    if (await exists(customCssPath)) {
      options.customCss = customCssPath;
    }
  }

  const opts = { ...DEFAULT_SLIDE_OPTIONS, ...options };

  // Add reveal.js directives if not already present
  const slideMarkdown = content.includes('theme:')
    ? content
    : addRevealDirectives(content, opts.theme, opts.revealOptions);

  await convertToSlides(slideMarkdown, outputPath, opts);
  return outputPath;
}
