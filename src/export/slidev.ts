/**
 * Slidev Integration Module
 * Provides CLI wrapper functions for Slidev presentation framework
 */

import { promises as fs } from 'node:fs';
import { exec, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

/** Slidev theme options */
export type SlidevTheme = 'default' | 'seriph' | 'apple-basic' | 'bricks' | 'shibainu';

/** Slidev layout options */
export type SlidevLayout =
  | 'default'
  | 'center'
  | 'cover'
  | 'two-cols'
  | 'two-cols-header'
  | 'image'
  | 'image-right'
  | 'image-left'
  | 'fact'
  | 'quote'
  | 'section'
  | 'statement'
  | 'end';

/** Slidev transition options */
export type SlidevTransition =
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'fade'
  | 'fade-out'
  | 'none';

/** Slidev project configuration */
export interface SlidevProjectConfig {
  /** Presentation title */
  title: string;
  /** Theme to use */
  theme?: SlidevTheme;
  /** Default transition */
  transition?: SlidevTransition;
  /** Enable Monaco editor for code blocks */
  monaco?: boolean;
  /** Enable MDC (Markdown Components) syntax */
  mdc?: boolean;
  /** Syntax highlighter */
  highlighter?: 'shiki' | 'prism';
  /** Additional info/description */
  info?: string;
  /** Whether PDF/PPTX export is needed (requires playwright-chromium) */
  needsExport?: boolean;
}

/** Slidev dev server options */
export interface SlidevDevOptions {
  /** Port for dev server */
  port?: number;
  /** Open browser automatically */
  open?: boolean;
}

/** Slidev build options */
export interface SlidevBuildOptions {
  /** Output directory */
  outDir?: string;
  /** Base URL for deployment */
  base?: string;
}

/** Slidev export options */
export interface SlidevExportOptions {
  /** Output file path */
  output?: string;
  /** Export format */
  format?: 'pdf' | 'png' | 'pptx';
  /** Wait time per slide in ms */
  timeout?: number;
  /** Dark mode */
  dark?: boolean;
}

// ============================================
// Slidev Project Management
// ============================================

/**
 * Get the Slidev project directory path
 * @param workspacePath Workspace root path
 * @param projectName Unique project name
 * @returns Path to the Slidev project directory
 */
export function getSlidevProjectPath(workspacePath: string, projectName: string): string {
  return path.join(workspacePath, '.pwork', 'slides', projectName);
}

/** Theme package mapping */
const THEME_PACKAGES: Record<SlidevTheme, string> = {
  default: '@slidev/theme-default',
  seriph: '@slidev/theme-seriph',
  'apple-basic': '@slidev/theme-apple-basic',
  bricks: '@slidev/theme-bricks',
  shibainu: '@slidev/theme-shibainu',
};

/**
 * Generate a Slidev project with slides.md
 * @param projectPath Path where the project should be created
 * @param markdown Slidev-formatted markdown content
 * @param config Project configuration
 */
export async function generateSlidevProject(
  projectPath: string,
  markdown: string,
  config: SlidevProjectConfig
): Promise<void> {
  // Ensure project directory exists
  await fs.mkdir(projectPath, { recursive: true });

  // Write slides.md
  const slidesPath = path.join(projectPath, 'slides.md');
  await fs.writeFile(slidesPath, markdown, 'utf-8');

  // Determine theme package
  const theme = config.theme || 'default';
  const themePackage = THEME_PACKAGES[theme];

  // Build dependencies - include playwright-chromium for PDF/PPTX export
  const dependencies: Record<string, string> = {
    '@slidev/cli': '^52.0.0',
    [themePackage]: 'latest',
  };

  if (config.needsExport) {
    dependencies['playwright-chromium'] = 'latest';
  }

  // Create package.json with theme dependency
  const packageJson = {
    name: 'pwork-slides',
    private: true,
    scripts: {
      dev: 'slidev',
      build: 'slidev build',
      export: 'slidev export',
    },
    dependencies,
  };

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf-8'
  );

  // Install dependencies
  await execAsync('npm install --prefer-offline --no-audit --progress=false', {
    cwd: projectPath,
  });
}

/**
 * Clean up a Slidev project directory
 * @param projectPath Path to the Slidev project
 */
export async function cleanupSlidevProject(projectPath: string): Promise<void> {
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================
// Slidev CLI Commands
// ============================================

/**
 * Check if Slidev CLI is available
 * @returns true if Slidev CLI is installed and accessible
 */
export async function isSlidevAvailable(): Promise<boolean> {
  try {
    await execAsync('npx @slidev/cli --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Start Slidev dev server for live preview
 * @param projectPath Path to the Slidev project
 * @param options Dev server options
 * @returns Child process handle for the dev server
 */
export function runSlidevDev(
  projectPath: string,
  options: SlidevDevOptions = {}
): ChildProcess {
  // Use local slidev installation to ensure theme is available
  const slidevBin = path.join(projectPath, 'node_modules', '.bin', 'slidev');
  const args = ['slides.md'];

  if (options.port) {
    args.push('--port', options.port.toString());
  }

  if (options.open !== false) {
    args.push('--open');
  }

  // Spawn Slidev dev server using local installation
  const child = spawn(slidevBin, args, {
    cwd: projectPath,
    stdio: 'inherit',
    shell: true,
  });

  return child;
}

/**
 * Build static HTML from Slidev project
 * @param projectPath Path to the Slidev project
 * @param options Build options
 */
export async function runSlidevBuild(
  projectPath: string,
  options: SlidevBuildOptions = {}
): Promise<void> {
  // Use local slidev installation to ensure theme is available
  const slidevBin = path.join(projectPath, 'node_modules', '.bin', 'slidev');
  const args = [slidevBin, 'build', 'slides.md'];

  if (options.outDir) {
    args.push('--out', options.outDir);
  }

  if (options.base) {
    args.push('--base', options.base);
  }

  await execAsync(args.join(' '), { cwd: projectPath });
}

/**
 * Export Slidev presentation to PDF or other format
 * @param projectPath Path to the Slidev project
 * @param options Export options
 */
export async function runSlidevExport(
  projectPath: string,
  options: SlidevExportOptions = {}
): Promise<void> {
  // Use local slidev installation to ensure theme is available
  const slidevBin = path.join(projectPath, 'node_modules', '.bin', 'slidev');
  const args = [slidevBin, 'export', 'slides.md'];

  if (options.output) {
    args.push('--output', options.output);
  }

  if (options.format) {
    args.push('--format', options.format);
  }

  if (options.timeout) {
    args.push('--timeout', options.timeout.toString());
  }

  if (options.dark) {
    args.push('--dark');
  }

  await execAsync(args.join(' '), { cwd: projectPath });
}

// ============================================
// Slidev Markdown Formatting
// ============================================

/**
 * Generate Slidev frontmatter YAML
 * @param config Project configuration
 * @returns YAML frontmatter string
 */
export function generateSlidevFrontmatter(config: SlidevProjectConfig): string {
  const frontmatter: Record<string, unknown> = {
    theme: config.theme || 'default',
    title: config.title,
    highlighter: config.highlighter || 'shiki',
    drawings: { persist: false },
    transition: config.transition || 'slide-left',
    mdc: config.mdc !== false,
  };

  if (config.info) {
    frontmatter.info = config.info;
  }

  // Convert to YAML manually (simple implementation)
  const yamlLines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === 'object' && value !== null) {
      yamlLines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        yamlLines.push(`  ${subKey}: ${subValue}`);
      }
    } else if (typeof value === 'string' && value.includes('\n')) {
      yamlLines.push(`${key}: |`);
      for (const line of value.split('\n')) {
        yamlLines.push(`  ${line}`);
      }
    } else {
      yamlLines.push(`${key}: ${value}`);
    }
  }

  return `---\n${yamlLines.join('\n')}\n---`;
}

/**
 * Add a layout directive to a slide
 * @param content Slide content
 * @param layout Layout type
 * @returns Content with layout frontmatter
 */
export function addSlideLayout(content: string, layout: SlidevLayout): string {
  return `---\nlayout: ${layout}\n---\n\n${content}`;
}

/**
 * Create a two-column slide
 * @param leftContent Left column content
 * @param rightContent Right column content
 * @param title Optional slide title
 * @returns Two-column slide markdown
 */
export function createTwoColumnSlide(
  leftContent: string,
  rightContent: string,
  title?: string
): string {
  const lines: string[] = [
    '---',
    'layout: two-cols',
    '---',
    '',
  ];

  if (title) {
    lines.push(`# ${title}`, '');
  }

  lines.push(leftContent, '', '::right::', '', rightContent);

  return lines.join('\n');
}

/**
 * Add speaker notes to a slide
 * @param content Slide content
 * @param notes Speaker notes
 * @returns Content with speaker notes
 */
export function addSpeakerNotes(content: string, notes: string): string {
  return `${content}\n\n<!--\n${notes}\n-->`;
}
