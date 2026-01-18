/**
 * Export Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  dailyToSlides,
  weeklyToSlides,
  projectToSlides,
} from '../src/export/slides.js';
import {
  markdownToHtml,
  renderDaily,
  renderWeekly,
  renderProject,
} from '../src/export/renderer.js';
import { createDaily } from '../src/daily/index.js';
import { createWeekly } from '../src/weekly/index.js';
import { createProject } from '../src/project/index.js';
import { initWorkspaceDirectories, writeJson, getConfigFilePath } from '../src/core/fs.js';
import { createDefaultWorkspaceConfig } from '../src/core/schema.js';

describe('Export Module', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = path.join(os.tmpdir(), `pwork-test-${Date.now()}`);
    await initWorkspaceDirectories(testWorkspace);
    await writeJson(
      getConfigFilePath(testWorkspace),
      createDefaultWorkspaceConfig('test-workspace')
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Cleanup warning: ${error}`);
    }
  });

  describe('Markdown Renderer', () => {
    it('should convert markdown to HTML', () => {
      const markdown = '# Hello World\n\nThis is a **test**.';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<h1');
      expect(html).toContain('Hello World');
      expect(html).toContain('<strong>test</strong>');
    });

    it('should render Daily as HTML', async () => {
      const daily = await createDaily(testWorkspace, { date: '2026-01-18' });
      const html = renderDaily(daily);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('2026-01-18');
      expect(html).toContain('Daily Log');
    });

    it('should render Weekly as HTML', async () => {
      const weekly = await createWeekly(testWorkspace, { week: '2026-W03' });
      const html = renderWeekly(weekly);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('2026-W03');
      expect(html).toContain('Week');
    });

    it('should render Project as HTML', async () => {
      const project = await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });
      const html = renderProject(project);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Test Project');
      expect(html).toContain('owner/repo');
    });
  });

  describe('Slides Conversion', () => {
    it('should convert Daily to slides', async () => {
      const daily = await createDaily(testWorkspace, {
        date: '2026-01-18',
        projects: ['Project A'],
      });

      const slides = dailyToSlides(daily);

      expect(slides).toContain('marp: true');
      expect(slides).toContain('2026-01-18');
      expect(slides).toContain('Daily Log');
      expect(slides).toContain('Project A');
      expect(slides).toContain('---'); // Slide separator
    });

    it('should convert Weekly to slides', async () => {
      const weekly = await createWeekly(testWorkspace, { week: '2026-W03' });

      const slides = weeklyToSlides(weekly);

      expect(slides).toContain('marp: true');
      expect(slides).toContain('2026-W03');
      expect(slides).toContain('Week');
      expect(slides).toContain('---');
    });

    it('should convert Project to slides', async () => {
      const project = await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        type: 'software',
        status: 'Doing',
      });

      const slides = projectToSlides(project);

      expect(slides).toContain('marp: true');
      expect(slides).toContain('Test Project');
      expect(slides).toContain('software');
      expect(slides).toContain('Doing');
      expect(slides).toContain('owner/repo');
      expect(slides).toContain('---');
    });

    it('should apply theme to slides', async () => {
      const daily = await createDaily(testWorkspace, { date: '2026-01-18' });

      const defaultSlides = dailyToSlides(daily, 'default');
      const gaiaSlides = dailyToSlides(daily, 'gaia');

      expect(defaultSlides).toContain('theme: default');
      expect(gaiaSlides).toContain('theme: gaia');
    });
  });
});
