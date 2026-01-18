/**
 * GitHub Link Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parseGitHubRepoUrl,
  parseGitHubLinkUrl,
  isValidGitHubRepoUrl,
  normalizeGitHubRepoUrl,
  buildGitHubRepoUrl,
  buildGitHubIssueUrl,
  buildGitHubPRUrl,
  buildGitHubFileUrl,
  getProjectGitHubInfo,
  linkProjectToGitHub,
  extractRepoNameFromUrl,
  isSameGitHubRepo,
} from '../src/project/github-link.js';
import { createProject } from '../src/project/index.js';
import { initWorkspaceDirectories, writeJson, getConfigFilePath } from '../src/core/fs.js';
import { createDefaultWorkspaceConfig } from '../src/core/schema.js';

describe('GitHub Link Module', () => {
  describe('URL Parsing', () => {
    describe('parseGitHubRepoUrl', () => {
      it('should parse HTTPS URL', () => {
        const info = parseGitHubRepoUrl('https://github.com/owner/repo');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('owner');
        expect(info!.repo).toBe('repo');
        expect(info!.url).toBe('https://github.com/owner/repo');
        expect(info!.apiUrl).toBe('https://api.github.com/repos/owner/repo');
        expect(info!.cloneUrl).toBe('https://github.com/owner/repo.git');
        expect(info!.sshUrl).toBe('git@github.com:owner/repo.git');
      });

      it('should parse HTTPS URL with .git suffix', () => {
        const info = parseGitHubRepoUrl('https://github.com/owner/repo.git');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('owner');
        expect(info!.repo).toBe('repo');
      });

      it('should parse SSH URL', () => {
        const info = parseGitHubRepoUrl('git@github.com:owner/repo.git');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('owner');
        expect(info!.repo).toBe('repo');
      });

      it('should parse short format (owner/repo)', () => {
        const info = parseGitHubRepoUrl('owner/repo');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('owner');
        expect(info!.repo).toBe('repo');
      });

      it('should handle repos with dots and hyphens', () => {
        const info = parseGitHubRepoUrl('my-org/my-project.js');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('my-org');
        expect(info!.repo).toBe('my-project.js');
      });

      it('should return null for invalid URL', () => {
        expect(parseGitHubRepoUrl('')).toBeNull();
        expect(parseGitHubRepoUrl('invalid')).toBeNull();
        expect(parseGitHubRepoUrl('https://gitlab.com/owner/repo')).toBeNull();
      });
    });

    describe('parseGitHubLinkUrl', () => {
      it('should parse issue URL', () => {
        const info = parseGitHubLinkUrl('https://github.com/owner/repo/issues/123');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('owner');
        expect(info!.repo).toBe('repo');
        expect(info!.number).toBe(123);
        expect(info!.type).toBe('issue');
      });

      it('should parse PR URL', () => {
        const info = parseGitHubLinkUrl('https://github.com/owner/repo/pull/456');

        expect(info).not.toBeNull();
        expect(info!.owner).toBe('owner');
        expect(info!.repo).toBe('repo');
        expect(info!.number).toBe(456);
        expect(info!.type).toBe('pull');
      });

      it('should parse short format (owner/repo#123)', () => {
        const info = parseGitHubLinkUrl('owner/repo#123');

        expect(info).not.toBeNull();
        expect(info!.number).toBe(123);
        expect(info!.type).toBe('issue'); // 默认为 issue
      });

      it('should return null for invalid URL', () => {
        expect(parseGitHubLinkUrl('')).toBeNull();
        expect(parseGitHubLinkUrl('owner/repo')).toBeNull();
        expect(parseGitHubLinkUrl('https://github.com/owner/repo')).toBeNull();
      });
    });
  });

  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      expect(isValidGitHubRepoUrl('https://github.com/owner/repo')).toBe(true);
      expect(isValidGitHubRepoUrl('git@github.com:owner/repo.git')).toBe(true);
      expect(isValidGitHubRepoUrl('owner/repo')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidGitHubRepoUrl('')).toBe(false);
      expect(isValidGitHubRepoUrl('invalid')).toBe(false);
      expect(isValidGitHubRepoUrl('https://gitlab.com/owner/repo')).toBe(false);
    });
  });

  describe('URL Normalization', () => {
    it('should normalize various formats to HTTPS URL', () => {
      expect(normalizeGitHubRepoUrl('owner/repo')).toBe('https://github.com/owner/repo');
      expect(normalizeGitHubRepoUrl('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo');
      expect(normalizeGitHubRepoUrl('https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
    });

    it('should return original for invalid URL', () => {
      expect(normalizeGitHubRepoUrl('invalid')).toBe('invalid');
    });
  });

  describe('URL Building', () => {
    it('should build repo URL', () => {
      expect(buildGitHubRepoUrl('owner', 'repo')).toBe('https://github.com/owner/repo');
    });

    it('should build issue URL', () => {
      expect(buildGitHubIssueUrl('owner', 'repo', 123)).toBe('https://github.com/owner/repo/issues/123');
    });

    it('should build PR URL', () => {
      expect(buildGitHubPRUrl('owner', 'repo', 456)).toBe('https://github.com/owner/repo/pull/456');
    });

    it('should build file URL', () => {
      expect(buildGitHubFileUrl('owner', 'repo', 'src/index.ts')).toBe(
        'https://github.com/owner/repo/blob/main/src/index.ts'
      );
      expect(buildGitHubFileUrl('owner', 'repo', 'README.md', 'develop')).toBe(
        'https://github.com/owner/repo/blob/develop/README.md'
      );
    });
  });

  describe('Utility Functions', () => {
    it('should extract repo name from URL', () => {
      expect(extractRepoNameFromUrl('https://github.com/owner/my-repo')).toBe('my-repo');
      expect(extractRepoNameFromUrl('owner/another-repo')).toBe('another-repo');
      expect(extractRepoNameFromUrl('invalid')).toBeNull();
    });

    it('should check if two URLs point to same repo', () => {
      expect(isSameGitHubRepo(
        'https://github.com/owner/repo',
        'git@github.com:owner/repo.git'
      )).toBe(true);

      expect(isSameGitHubRepo(
        'owner/repo',
        'https://github.com/OWNER/REPO'
      )).toBe(true); // case insensitive

      expect(isSameGitHubRepo(
        'owner/repo1',
        'owner/repo2'
      )).toBe(false);
    });
  });

  describe('Project Integration', () => {
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
      await fs.rm(testWorkspace, { recursive: true, force: true });
    });

    it('should get project GitHub info', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'https://github.com/owner/test-repo',
      });

      const info = await getProjectGitHubInfo(testWorkspace, 'Test Project');

      expect(info).not.toBeNull();
      expect(info!.owner).toBe('owner');
      expect(info!.repo).toBe('test-repo');
    });

    it('should return null for non-existent project', async () => {
      const info = await getProjectGitHubInfo(testWorkspace, 'Non Existent');
      expect(info).toBeNull();
    });

    it('should link project to GitHub', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/old-repo',
      });

      const project = await linkProjectToGitHub(
        testWorkspace,
        'Test Project',
        'new-owner/new-repo'
      );

      expect(project.meta.project.github_repo).toBe('https://github.com/new-owner/new-repo');
    });

    it('should throw error for invalid GitHub URL when linking', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      await expect(
        linkProjectToGitHub(testWorkspace, 'Test Project', 'invalid-url')
      ).rejects.toThrow('Invalid GitHub repo URL');
    });
  });
});
