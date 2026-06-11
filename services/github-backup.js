const DEFAULT_BRANCH = 'main';
const DEFAULT_PATH = 'acl-training-backup.json';
const TOKEN_STORAGE_KEY = 'acl_training_github_backup_token';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function cleanText(value) {
  return String(value || '').trim();
}

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_err) {
    return null;
  }
}

function stripSecretFields(snapshot) {
  const next = deepClone(snapshot);
  if (next.settings?.aiConfig) {
    next.settings.aiConfig.deepseekApiKey = '';
  }
  if (next.settings?.githubBackup) {
    delete next.settings.githubBackup.token;
  }
  return next;
}

function encodePath(path) {
  return cleanText(path)
    .split('/')
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join('/');
}

async function readErrorMessage(resp, fallback) {
  try {
    const data = await resp.json();
    return cleanText(data?.message) || fallback;
  } catch (_err) {
    return fallback;
  }
}

export function normalizeGitHubBackupConfig(config = {}) {
  const source = config || {};
  return {
    owner: cleanText(source.owner),
    repo: cleanText(source.repo),
    branch: cleanText(source.branch) || DEFAULT_BRANCH,
    path: cleanText(source.path) || DEFAULT_PATH,
  };
}

export function buildBackupPayload(snapshot) {
  const safeSnapshot = stripSecretFields(snapshot);
  return {
    app: 'acl-training',
    exportedAt: new Date().toISOString(),
    snapshot: safeSnapshot,
  };
}

export function textToBase64(text) {
  const value = String(text ?? '');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function base64ToText(base64) {
  const value = String(base64 ?? '').replace(/\s/g, '');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('utf8');
  }
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function loadGitHubBackupToken() {
  return cleanText(getStorage()?.getItem(TOKEN_STORAGE_KEY));
}

export function saveGitHubBackupToken(token) {
  const storage = getStorage();
  if (!storage) return;
  const value = cleanText(token);
  if (value) storage.setItem(TOKEN_STORAGE_KEY, value);
  else storage.removeItem(TOKEN_STORAGE_KEY);
}

export function clearGitHubBackupToken() {
  getStorage()?.removeItem(TOKEN_STORAGE_KEY);
}

export function buildContentsUrl(configInput) {
  const config = normalizeGitHubBackupConfig(configInput);
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodePath(config.path)}`;
}

export function validateGitHubBackupInputs(configInput, token) {
  const config = normalizeGitHubBackupConfig(configInput);
  if (!config.owner || !config.repo) {
    return { ok: false, msg: '请填写 GitHub owner 和数据仓库名。', config };
  }
  if (!cleanText(token)) {
    return { ok: false, msg: '请填写只授权数据仓库的 fine-grained token。', config };
  }
  return { ok: true, config };
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cleanText(token)}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function getGitHubBackupFile(configInput, token) {
  const validation = validateGitHubBackupInputs(configInput, token);
  if (!validation.ok) return validation;

  const config = validation.config;
  const url = `${buildContentsUrl(config)}?ref=${encodeURIComponent(config.branch)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: githubHeaders(token),
    cache: 'no-store',
  });

  if (resp.status === 404) {
    return { ok: true, exists: false, config };
  }
  if (!resp.ok) {
    const msg = await readErrorMessage(resp, `GitHub 读取失败（HTTP ${resp.status}）`);
    return { ok: false, msg, config };
  }

  const data = await resp.json();
  const text = base64ToText(data.content || '');
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (_err) {
    return { ok: false, msg: 'GitHub 备份文件不是有效 JSON。', config };
  }

  return {
    ok: true,
    exists: true,
    config,
    sha: cleanText(data.sha),
    text,
    payload,
  };
}

export async function pushGitHubBackup(snapshot, configInput, token) {
  const validation = validateGitHubBackupInputs(configInput, token);
  if (!validation.ok) return validation;

  const existing = await getGitHubBackupFile(validation.config, token);
  if (!existing.ok) return existing;

  const payload = buildBackupPayload(snapshot);
  const content = textToBase64(JSON.stringify(payload, null, 2));
  const body = {
    message: 'backup acl training data',
    content,
    branch: validation.config.branch,
  };
  if (existing.exists && existing.sha) body.sha = existing.sha;

  const resp = await fetch(buildContentsUrl(validation.config), {
    method: 'PUT',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const msg = await readErrorMessage(resp, `GitHub 备份失败（HTTP ${resp.status}）`);
    return { ok: false, msg, config: validation.config };
  }

  const data = await resp.json();
  return {
    ok: true,
    config: validation.config,
    exportedAt: payload.exportedAt,
    commitSha: cleanText(data.commit?.sha),
    htmlUrl: cleanText(data.content?.html_url),
  };
}

export async function pullGitHubBackup(configInput, token) {
  const file = await getGitHubBackupFile(configInput, token);
  if (!file.ok) return file;
  if (!file.exists) {
    return { ok: false, msg: '数据仓库里还没有备份文件。', config: file.config };
  }
  if (file.payload?.app !== 'acl-training' || !file.payload?.snapshot) {
    return { ok: false, msg: '备份文件不是 acl-training 快照。', config: file.config };
  }
  return {
    ok: true,
    config: file.config,
    snapshot: file.payload.snapshot,
    exportedAt: cleanText(file.payload.exportedAt),
    sha: file.sha,
  };
}
