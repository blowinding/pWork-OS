/**
 * Aggregator Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractSection,
  extractListItems,
  extractHighlightContent,
  generateExcerpt,
  createDailySummary,
  aggregateDailiesToWeekly,
} from '../src/core/aggregator.js';
import type { DailyLog, WeeklyMeta } from '../src/core/schema.js';

describe('Aggregator Engine', () => {
  describe('extractSection', () => {
    it('should extract section content', () => {
      const content = `
# Daily Log

## 今日计划
- Task 1
- Task 2

## 今日完成
- Done 1
- Done 2

## 备注
Some notes
`;
      const section = extractSection(content, '今日完成');
      expect(section).toContain('Done 1');
      expect(section).toContain('Done 2');
      expect(section).not.toContain('Task 1');
    });

    it('should return empty string for non-existent section', () => {
      const content = '# Test\n\n## Section A\nContent';
      const section = extractSection(content, 'Non Existent');
      expect(section).toBe('');
    });
  });

  describe('extractListItems', () => {
    it('should extract list items from section', () => {
      const content = `
## Tasks
- Task 1
- Task 2
- [ ] Unchecked task
- [x] Checked task

## Other
- Not this
`;
      const items = extractListItems(content, 'Tasks');
      expect(items).toHaveLength(4);
      expect(items).toContain('Task 1');
      expect(items).toContain('Task 2');
      expect(items).toContain('Unchecked task');
      expect(items).toContain('Checked task');
    });
  });

  describe('generateExcerpt', () => {
    it('should generate excerpt within limit', () => {
      const content = 'This is a short text';
      const excerpt = generateExcerpt(content, 100);
      expect(excerpt).toBe(content);
    });

    it('should truncate long content', () => {
      const content = 'A'.repeat(300);
      const excerpt = generateExcerpt(content, 100);
      expect(excerpt.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(excerpt.endsWith('...')).toBe(true);
    });

    it('should remove markdown headers', () => {
      const content = '# Header\nSome text\n## Another\nMore text';
      const excerpt = generateExcerpt(content);
      expect(excerpt).not.toContain('# Header');
      expect(excerpt).toContain('Some text');
    });
  });

  describe('createDailySummary', () => {
    it('should create summary from daily log', () => {
      const daily: DailyLog = {
        meta: {
          date: '2026-01-15',
          type: 'daily',
          week: '2026-W03',
          projects: ['project-a'],
          tags: ['tag1'],
          weekly_highlight: true,
          github: { issues: [], prs: [] },
        },
        content: '## 今日完成\n- Task done',
        filePath: '/test/daily/2026-01-15.md',
      };

      const summary = createDailySummary(daily);

      expect(summary.date).toBe('2026-01-15');
      expect(summary.projects).toEqual(['project-a']);
      expect(summary.tags).toEqual(['tag1']);
      expect(summary.isHighlight).toBe(true);
    });
  });

  describe('aggregateDailiesToWeekly', () => {
    it('should aggregate multiple dailies', () => {
      const dailies: DailyLog[] = [
        {
          meta: {
            date: '2026-01-15',
            type: 'daily',
            week: '2026-W03',
            projects: ['project-a'],
            tags: [],
            weekly_highlight: true,
            github: { issues: [], prs: [] },
          },
          content: '## 今日完成\n- Important work done',
          filePath: '/test/daily/2026-01-15.md',
        },
        {
          meta: {
            date: '2026-01-16',
            type: 'daily',
            week: '2026-W03',
            projects: ['project-b'],
            tags: [],
            weekly_highlight: false,
            github: { issues: [], prs: [] },
          },
          content: '## 今日完成\n- Regular work',
          filePath: '/test/daily/2026-01-16.md',
        },
      ];

      const weekMeta: WeeklyMeta = {
        week: '2026-W03',
        type: 'weekly',
        start_date: '2026-01-12',
        end_date: '2026-01-18',
        projects: [],
      };

      const result = aggregateDailiesToWeekly(dailies, weekMeta);

      expect(result.projects).toContain('project-a');
      expect(result.projects).toContain('project-b');
      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0].date).toBe('2026-01-15');
      expect(result.dailySummaries).toHaveLength(2);
      expect(result.content).toContain('Week 2026-W03');
    });

    it('should handle empty dailies', () => {
      const weekMeta: WeeklyMeta = {
        week: '2026-W03',
        type: 'weekly',
        start_date: '2026-01-12',
        end_date: '2026-01-18',
        projects: [],
      };

      const result = aggregateDailiesToWeekly([], weekMeta);

      expect(result.projects).toHaveLength(0);
      expect(result.highlights).toHaveLength(0);
      expect(result.dailySummaries).toHaveLength(0);
      expect(result.content).toContain('暂无 Daily Log');
    });
  });
});
