/**
 * Weekly Report Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createWeekly,
  getWeekly,
  generateWeekly,
  listWeeklies,
  deleteWeekly,
  getCurrentWeek,
  isValidWeekString,
  getWeekDateRange,
  getDailiesForWeek,
} from '../src/weekly/index.js';
import { createDaily } from '../src/daily/index.js';
import { initWorkspaceDirectories, writeJson, getConfigFilePath } from '../src/core/fs.js';
import { createDefaultWorkspaceConfig } from '../src/core/schema.js';

describe('Weekly Module', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    // 创建临时 workspace
    testWorkspace = path.join(os.tmpdir(), `pwork-test-${Date.now()}`);
    await initWorkspaceDirectories(testWorkspace);
    await writeJson(
      getConfigFilePath(testWorkspace),
      createDefaultWorkspaceConfig('test-workspace')
    );
  });

  afterEach(async () => {
    // 清理临时 workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors - they shouldn't fail the test
      console.warn(`Cleanup warning: ${error}`);
    }
  });

  describe('Week Utilities', () => {
    it('should get current week', () => {
      const week = getCurrentWeek();
      expect(week).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should validate week string', () => {
      expect(isValidWeekString('2026-W03')).toBe(true);
      expect(isValidWeekString('2026-W01')).toBe(true);
      expect(isValidWeekString('2026-W53')).toBe(true);
      expect(isValidWeekString('2026-W00')).toBe(false);
      expect(isValidWeekString('2026-W54')).toBe(false);
      expect(isValidWeekString('invalid')).toBe(false);
      expect(isValidWeekString('2026-03')).toBe(false);
    });

    it('should get week date range', () => {
      const range = getWeekDateRange('2026-W03');
      expect(range.start).toBe('2026-01-12');
      expect(range.end).toBe('2026-01-18');
    });
  });

  describe('CRUD Operations', () => {
    it('should create a new weekly report', async () => {
      const weekly = await createWeekly(testWorkspace, { week: '2026-W03' });

      expect(weekly.meta.week).toBe('2026-W03');
      expect(weekly.meta.type).toBe('weekly');
      expect(weekly.meta.start_date).toBe('2026-01-12');
      expect(weekly.meta.end_date).toBe('2026-01-18');
      expect(weekly.filePath).toContain('2026-W03.md');
    });

    it('should throw error when creating duplicate weekly', async () => {
      await createWeekly(testWorkspace, { week: '2026-W03' });

      await expect(
        createWeekly(testWorkspace, { week: '2026-W03' })
      ).rejects.toThrow('Weekly report already exists');
    });

    it('should get weekly report by week', async () => {
      await createWeekly(testWorkspace, { week: '2026-W03' });

      const weekly = await getWeekly(testWorkspace, '2026-W03');

      expect(weekly).not.toBeNull();
      expect(weekly!.meta.week).toBe('2026-W03');
    });

    it('should return null for non-existent weekly', async () => {
      const weekly = await getWeekly(testWorkspace, '2026-W99');
      expect(weekly).toBeNull();
    });

    it('should list weekly reports', async () => {
      await createWeekly(testWorkspace, { week: '2026-W01' });
      await createWeekly(testWorkspace, { week: '2026-W02' });
      await createWeekly(testWorkspace, { week: '2026-W03' });

      const weeklies = await listWeeklies(testWorkspace);

      expect(weeklies).toHaveLength(3);
      // 应按周降序排列
      expect(weeklies[0].meta.week).toBe('2026-W03');
      expect(weeklies[1].meta.week).toBe('2026-W02');
      expect(weeklies[2].meta.week).toBe('2026-W01');
    });

    it('should delete weekly report', async () => {
      await createWeekly(testWorkspace, { week: '2026-W03' });

      await deleteWeekly(testWorkspace, '2026-W03');

      const weekly = await getWeekly(testWorkspace, '2026-W03');
      expect(weekly).toBeNull();
    });
  });

  describe('Aggregation', () => {
    it('should aggregate from daily logs', async () => {
      // 创建该周的 daily logs
      await createDaily(testWorkspace, { date: '2026-01-12' });
      await createDaily(testWorkspace, { date: '2026-01-13' });
      await createDaily(testWorkspace, { date: '2026-01-14' });

      const weekly = await generateWeekly(testWorkspace, '2026-W03');

      expect(weekly.meta.week).toBe('2026-W03');
      expect(weekly.content).toContain('Week 2026-W03');
      expect(weekly.content).toContain('2026-01-12');
      expect(weekly.content).toContain('2026-01-13');
      expect(weekly.content).toContain('2026-01-14');
    });

    it('should get dailies for week', async () => {
      await createDaily(testWorkspace, { date: '2026-01-12' });
      await createDaily(testWorkspace, { date: '2026-01-15' });
      // 这个不在 W03
      await createDaily(testWorkspace, { date: '2026-01-20' });

      const dailies = await getDailiesForWeek(testWorkspace, '2026-W03');

      expect(dailies).toHaveLength(2);
    });

    it('should preserve user edits when regenerating', async () => {
      // 创建 daily logs
      await createDaily(testWorkspace, { date: '2026-01-12' });

      // 生成周报
      await generateWeekly(testWorkspace, '2026-W03');

      // 手动编辑周报
      const weekly1 = await getWeekly(testWorkspace, '2026-W03');
      const editedContent = weekly1!.content.replace(
        '## 本周总结（一句话）\n\n',
        '## 本周总结（一句话）\n\n这是手动编辑的总结\n'
      );
      await fs.writeFile(
        weekly1!.filePath,
        `---\nweek: 2026-W03\ntype: weekly\nstart_date: 2026-01-12\nend_date: 2026-01-18\nprojects: []\n---\n\n${editedContent}`
      );

      // 添加新的 daily
      await createDaily(testWorkspace, { date: '2026-01-13' });

      // 重新生成
      const weekly2 = await generateWeekly(testWorkspace, '2026-W03');

      // 应保留用户编辑
      expect(weekly2.content).toContain('这是手动编辑的总结');
      // 但也应包含新的 daily
      expect(weekly2.content).toContain('2026-01-13');
    });
  });
});
