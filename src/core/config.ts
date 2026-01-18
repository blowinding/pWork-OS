/**
 * Configuration Management
 * 全局配置管理，包括 workspace 路径、GitHub token 等
 */

import path from 'node:path';
import os from 'node:os';
import type { WorkspaceConfig } from './schema.js';
import {
  exists,
  readJson,
  writeJson,
  getConfigFilePath,
  createDirectory,
} from './fs.js';

// ============================================
// Types
// ============================================

/** 全局配置（存储在用户 home 目录） */
export interface GlobalConfig {
  /** 默认 workspace 路径 */
  defaultWorkspace?: string;
  /** GitHub Personal Access Token */
  githubToken?: string;
  /** 最近使用的 workspace 列表 */
  recentWorkspaces?: string[];
  /** 用户偏好设置 */
  preferences?: {
    /** 默认编辑器 */
    editor?: string;
    /** 日期格式 */
    dateFormat?: string;
    /** 周起始日（0=周日，1=周一） */
    weekStartsOn?: 0 | 1;
  };
}

/** 运行时配置上下文 */
export interface ConfigContext {
  /** 当前 workspace 路径 */
  workspacePath: string;
  /** workspace 配置 */
  workspaceConfig: WorkspaceConfig;
  /** 全局配置 */
  globalConfig: GlobalConfig;
}

// ============================================
// Constants
// ============================================

/** 全局配置目录名 */
const GLOBAL_CONFIG_DIR = '.pwork';

/** 全局配置文件名 */
const GLOBAL_CONFIG_FILE = 'config.json';

/** 默认全局配置 */
const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  recentWorkspaces: [],
  preferences: {
    weekStartsOn: 1, // 默认周一开始
    dateFormat: 'YYYY-MM-DD',
  },
};

// ============================================
// Global Config
// ============================================

/**
 * 获取全局配置目录路径
 * @returns 全局配置目录路径
 */
export function getGlobalConfigDir(): string {
  return path.join(os.homedir(), GLOBAL_CONFIG_DIR);
}

/**
 * 获取全局配置文件路径
 * @returns 全局配置文件路径
 */
export function getGlobalConfigPath(): string {
  return path.join(getGlobalConfigDir(), GLOBAL_CONFIG_FILE);
}

/**
 * 加载全局配置
 * @returns 全局配置对象
 */
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  const configPath = getGlobalConfigPath();

  if (!(await exists(configPath))) {
    return { ...DEFAULT_GLOBAL_CONFIG };
  }

  try {
    const config = await readJson<GlobalConfig>(configPath);
    return { ...DEFAULT_GLOBAL_CONFIG, ...config };
  } catch {
    return { ...DEFAULT_GLOBAL_CONFIG };
  }
}

/**
 * 保存全局配置
 * @param config 配置对象
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  const configDir = getGlobalConfigDir();
  const configPath = getGlobalConfigPath();

  await createDirectory(configDir);
  await writeJson(configPath, config);
}

/**
 * 更新全局配置
 * @param updates 要更新的配置项
 */
export async function updateGlobalConfig(
  updates: Partial<GlobalConfig>
): Promise<GlobalConfig> {
  const current = await loadGlobalConfig();
  const updated = { ...current, ...updates };
  await saveGlobalConfig(updated);
  return updated;
}

/**
 * 设置默认 workspace
 * @param workspacePath workspace 路径
 */
export async function setDefaultWorkspace(workspacePath: string): Promise<void> {
  await updateGlobalConfig({
    defaultWorkspace: path.resolve(workspacePath),
  });
}

/**
 * 获取默认 workspace 路径
 * @returns workspace 路径，如果未设置则返回 null
 */
export async function getDefaultWorkspace(): Promise<string | null> {
  const config = await loadGlobalConfig();
  return config.defaultWorkspace || null;
}

/**
 * 添加最近使用的 workspace
 * @param workspacePath workspace 路径
 */
export async function addRecentWorkspace(workspacePath: string): Promise<void> {
  const config = await loadGlobalConfig();
  const resolved = path.resolve(workspacePath);

  // 移除已存在的（如果有）
  const recent = (config.recentWorkspaces || []).filter(
    (w) => w !== resolved
  );

  // 添加到开头
  recent.unshift(resolved);

  // 最多保留 10 个
  await updateGlobalConfig({
    recentWorkspaces: recent.slice(0, 10),
  });
}

// ============================================
// Workspace Config
// ============================================

/**
 * 加载 workspace 配置
 * @param workspacePath workspace 路径
 * @returns workspace 配置对象
 */
export async function loadWorkspaceConfig(
  workspacePath: string
): Promise<WorkspaceConfig | null> {
  const configPath = getConfigFilePath(workspacePath);

  if (!(await exists(configPath))) {
    return null;
  }

  try {
    return await readJson<WorkspaceConfig>(configPath);
  } catch {
    return null;
  }
}

/**
 * 保存 workspace 配置
 * @param workspacePath workspace 路径
 * @param config 配置对象
 */
export async function saveWorkspaceConfig(
  workspacePath: string,
  config: WorkspaceConfig
): Promise<void> {
  const configPath = getConfigFilePath(workspacePath);
  await writeJson(configPath, config);
}

/**
 * 更新 workspace 配置
 * @param workspacePath workspace 路径
 * @param updates 要更新的配置项
 */
export async function updateWorkspaceConfig(
  workspacePath: string,
  updates: Partial<WorkspaceConfig>
): Promise<WorkspaceConfig> {
  const current = await loadWorkspaceConfig(workspacePath);
  if (!current) {
    throw new Error(`Workspace config not found: ${workspacePath}`);
  }

  const updated = { ...current, ...updates };
  await saveWorkspaceConfig(workspacePath, updated);
  return updated;
}

// ============================================
// GitHub Token Management
// ============================================

/**
 * 设置 GitHub token
 * @param token GitHub Personal Access Token
 */
export async function setGitHubToken(token: string): Promise<void> {
  await updateGlobalConfig({ githubToken: token });
}

/**
 * 获取 GitHub token
 * @returns token 字符串，如果未设置则返回 null
 */
export async function getGitHubToken(): Promise<string | null> {
  // 优先从环境变量获取
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) {
    return envToken;
  }

  // 从配置文件获取
  const config = await loadGlobalConfig();
  return config.githubToken || null;
}

/**
 * 检查是否配置了 GitHub token
 * @returns 是否已配置
 */
export async function hasGitHubToken(): Promise<boolean> {
  const token = await getGitHubToken();
  return token !== null && token.length > 0;
}

// ============================================
// Config Context
// ============================================

/**
 * 加载完整的配置上下文
 * @param workspacePath workspace 路径（可选，使用默认）
 * @returns 配置上下文
 */
export async function loadConfigContext(
  workspacePath?: string
): Promise<ConfigContext> {
  const globalConfig = await loadGlobalConfig();

  // 确定 workspace 路径
  let resolvedPath = workspacePath;
  if (!resolvedPath) {
    resolvedPath = globalConfig.defaultWorkspace;
  }
  if (!resolvedPath) {
    throw new Error(
      'No workspace specified and no default workspace configured. Run `pwork init` first.'
    );
  }

  resolvedPath = path.resolve(resolvedPath);

  // 加载 workspace 配置
  const workspaceConfig = await loadWorkspaceConfig(resolvedPath);
  if (!workspaceConfig) {
    throw new Error(
      `Invalid workspace: ${resolvedPath}. Run \`pwork init\` to initialize.`
    );
  }

  // 添加到最近使用
  await addRecentWorkspace(resolvedPath);

  return {
    workspacePath: resolvedPath,
    workspaceConfig,
    globalConfig,
  };
}

/**
 * 查找 workspace 路径（向上遍历目录）
 * @param startPath 起始路径
 * @returns workspace 路径，如果未找到则返回 null
 */
export async function findWorkspaceRoot(
  startPath: string = process.cwd()
): Promise<string | null> {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (current !== root) {
    const configPath = getConfigFilePath(current);
    if (await exists(configPath)) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * 自动检测或获取 workspace 路径
 * @returns workspace 路径
 */
export async function resolveWorkspace(): Promise<string> {
  // 1. 从环境变量获取
  const envWorkspace = process.env.PWORK_WORKSPACE;
  if (envWorkspace && (await exists(getConfigFilePath(envWorkspace)))) {
    return path.resolve(envWorkspace);
  }

  // 2. 从当前目录向上查找
  const found = await findWorkspaceRoot();
  if (found) {
    return found;
  }

  // 3. 使用默认 workspace
  const defaultWs = await getDefaultWorkspace();
  if (defaultWs && (await exists(getConfigFilePath(defaultWs)))) {
    return defaultWs;
  }

  throw new Error(
    'Could not find workspace. Run `pwork init` to create one, or specify path with --workspace.'
  );
}

/**
 * Get current workspace path (alias for resolveWorkspace)
 * @returns workspace path
 */
export async function getCurrentWorkspace(): Promise<string> {
  return resolveWorkspace();
}
