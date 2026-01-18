/**
 * Project Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createProject,
  getProject,
  getProjectBySlug,
  updateProject,
  deleteProject,
  listProjects,
  queryProjects,
  getActiveProjects,
  getBlockedProjects,
  updateProjectStatus,
  startProject,
  blockProject,
  completeProject,
  resumeProject,
  updateProjectType,
  updateProjectGitHubRepo,
  getProjectStats,
  projectExists,
  getProjectSlug,
} from '../src/project/index.js';
import { initWorkspaceDirectories, writeJson, getConfigFilePath } from '../src/core/fs.js';
import { createDefaultWorkspaceConfig } from '../src/core/schema.js';

describe('Project Module', () => {
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

  describe('CRUD Operations', () => {
    it('should create a new project', async () => {
      const project = await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'https://github.com/owner/repo',
      });

      expect(project.meta.project.name).toBe('Test Project');
      expect(project.meta.project.github_repo).toBe('https://github.com/owner/repo');
      expect(project.meta.project.status).toBe('Planning');
      expect(project.meta.project.type).toBe('software');
      expect(project.filePath).toContain('test-project.md');
    });

    it('should create project with custom type and status', async () => {
      const project = await createProject(testWorkspace, {
        name: 'Research Project',
        github_repo: 'owner/research-repo',
        type: 'research',
        status: 'Doing',
      });

      expect(project.meta.project.type).toBe('research');
      expect(project.meta.project.status).toBe('Doing');
    });

    it('should throw error when name is empty', async () => {
      await expect(
        createProject(testWorkspace, {
          name: '',
          github_repo: 'owner/repo',
        })
      ).rejects.toThrow('Project name is required');
    });

    it('should throw error when github_repo is empty', async () => {
      await expect(
        createProject(testWorkspace, {
          name: 'Test Project',
          github_repo: '',
        })
      ).rejects.toThrow('GitHub repo URL is required');
    });

    it('should throw error when creating duplicate project', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      await expect(
        createProject(testWorkspace, {
          name: 'Test Project',
          github_repo: 'owner/another-repo',
        })
      ).rejects.toThrow('Project already exists');
    });

    it('should get project by name', async () => {
      await createProject(testWorkspace, {
        name: 'My Project',
        github_repo: 'owner/my-project',
      });

      const project = await getProject(testWorkspace, 'My Project');

      expect(project).not.toBeNull();
      expect(project!.meta.project.name).toBe('My Project');
    });

    it('should return null for non-existent project', async () => {
      const project = await getProject(testWorkspace, 'Non Existent');
      expect(project).toBeNull();
    });

    it('should get project by slug', async () => {
      await createProject(testWorkspace, {
        name: 'My Awesome Project',
        github_repo: 'owner/awesome',
      });

      const project = await getProjectBySlug(testWorkspace, 'my-awesome-project');

      expect(project).not.toBeNull();
      expect(project!.meta.project.name).toBe('My Awesome Project');
    });

    it('should update project', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      const updated = await updateProject(testWorkspace, 'Test Project', {
        project: { type: 'research' },
        content: 'Updated content',
      });

      expect(updated.meta.project.type).toBe('research');
      expect(updated.content).toBe('Updated content');
    });

    it('should delete project', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      await deleteProject(testWorkspace, 'Test Project');

      const project = await getProject(testWorkspace, 'Test Project');
      expect(project).toBeNull();
    });

    it('should throw error when deleting non-existent project', async () => {
      await expect(
        deleteProject(testWorkspace, 'Non Existent')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // 创建测试项目
      await createProject(testWorkspace, {
        name: 'Project A',
        github_repo: 'owner/project-a',
        type: 'software',
        status: 'Doing',
      });
      await createProject(testWorkspace, {
        name: 'Project B',
        github_repo: 'owner/project-b',
        type: 'research',
        status: 'Planning',
      });
      await createProject(testWorkspace, {
        name: 'Project C',
        github_repo: 'owner/project-c',
        type: 'software',
        status: 'Blocked',
      });
    });

    it('should list all projects', async () => {
      const projects = await listProjects(testWorkspace);

      expect(projects).toHaveLength(3);
      // 按名称排序
      expect(projects[0].meta.project.name).toBe('Project A');
      expect(projects[1].meta.project.name).toBe('Project B');
      expect(projects[2].meta.project.name).toBe('Project C');
    });

    it('should query projects by status', async () => {
      const doingProjects = await queryProjects(testWorkspace, { status: 'Doing' });

      expect(doingProjects).toHaveLength(1);
      expect(doingProjects[0].meta.project.name).toBe('Project A');
    });

    it('should query projects by type', async () => {
      const softwareProjects = await queryProjects(testWorkspace, { type: 'software' });

      expect(softwareProjects).toHaveLength(2);
    });

    it('should query projects by name pattern', async () => {
      const projects = await queryProjects(testWorkspace, { nameContains: 'Project A' });

      expect(projects).toHaveLength(1);
      expect(projects[0].meta.project.name).toBe('Project A');
    });

    it('should get active projects', async () => {
      const activeProjects = await getActiveProjects(testWorkspace);

      expect(activeProjects).toHaveLength(1);
      expect(activeProjects[0].meta.project.status).toBe('Doing');
    });

    it('should get blocked projects', async () => {
      const blockedProjects = await getBlockedProjects(testWorkspace);

      expect(blockedProjects).toHaveLength(1);
      expect(blockedProjects[0].meta.project.status).toBe('Blocked');
    });
  });

  describe('Status Management', () => {
    it('should update project status', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      const updated = await updateProjectStatus(testWorkspace, 'Test Project', 'Doing');

      expect(updated.meta.project.status).toBe('Doing');
    });

    it('should start project', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        status: 'Planning',
      });

      const updated = await startProject(testWorkspace, 'Test Project');

      expect(updated.meta.project.status).toBe('Doing');
    });

    it('should block project', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        status: 'Doing',
      });

      const updated = await blockProject(testWorkspace, 'Test Project');

      expect(updated.meta.project.status).toBe('Blocked');
    });

    it('should complete project and set end date', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        status: 'Doing',
      });

      const updated = await completeProject(testWorkspace, 'Test Project');

      expect(updated.meta.project.status).toBe('Done');
      expect(updated.meta.project.end_date).toBeDefined();
    });

    it('should resume blocked project', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        status: 'Blocked',
      });

      const updated = await resumeProject(testWorkspace, 'Test Project');

      expect(updated.meta.project.status).toBe('Doing');
    });

    it('should resume completed project and clear end date', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        status: 'Doing',
      });

      // 先完成
      await completeProject(testWorkspace, 'Test Project');

      // 再恢复
      const updated = await resumeProject(testWorkspace, 'Test Project');

      expect(updated.meta.project.status).toBe('Doing');
      expect(updated.meta.project.end_date).toBeUndefined();
    });

    it('should throw error for invalid status', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      await expect(
        updateProjectStatus(testWorkspace, 'Test Project', 'Invalid' as any)
      ).rejects.toThrow('Invalid project status');
    });
  });

  describe('Project Info Updates', () => {
    it('should update project type', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
        type: 'software',
      });

      const updated = await updateProjectType(testWorkspace, 'Test Project', 'research');

      expect(updated.meta.project.type).toBe('research');
    });

    it('should update project GitHub repo', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/old-repo',
      });

      const updated = await updateProjectGitHubRepo(
        testWorkspace,
        'Test Project',
        'https://github.com/owner/new-repo'
      );

      expect(updated.meta.project.github_repo).toBe('https://github.com/owner/new-repo');
    });
  });

  describe('Statistics', () => {
    it('should get project stats', async () => {
      await createProject(testWorkspace, {
        name: 'Project A',
        github_repo: 'owner/a',
        type: 'software',
        status: 'Doing',
      });
      await createProject(testWorkspace, {
        name: 'Project B',
        github_repo: 'owner/b',
        type: 'research',
        status: 'Planning',
      });
      await createProject(testWorkspace, {
        name: 'Project C',
        github_repo: 'owner/c',
        type: 'software',
        status: 'Done',
      });

      const stats = await getProjectStats(testWorkspace);

      expect(stats.total).toBe(3);
      expect(stats.byStatus.Doing).toBe(1);
      expect(stats.byStatus.Planning).toBe(1);
      expect(stats.byStatus.Done).toBe(1);
      expect(stats.byType.software).toBe(2);
      expect(stats.byType.research).toBe(1);
    });
  });

  describe('Utilities', () => {
    it('should check if project exists', async () => {
      await createProject(testWorkspace, {
        name: 'Test Project',
        github_repo: 'owner/repo',
      });

      expect(await projectExists(testWorkspace, 'Test Project')).toBe(true);
      expect(await projectExists(testWorkspace, 'Non Existent')).toBe(false);
    });

    it('should get project slug', () => {
      expect(getProjectSlug('My Project')).toBe('my-project');
      expect(getProjectSlug('Test-Project_123')).toBe('test-project-123');
    });
  });
});
