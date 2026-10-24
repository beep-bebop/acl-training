// GitHub 数据备份：contents API 推送/拉取快照（fine-grained token，只授权数据仓库）。
// 从旧版移植并适配 v9 快照结构；token 存储键向后兼容旧键名。
const TOKEN_KEY = 'acl-training.github-token';
const LEGACY_TOKEN_KEY = 'acl_training_github_backup_token';
const DEFAULT_BRANCH = 'main';
const DEFAULT_PATH = 'acl-training-backup.json';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function cleanText(value) {
  return String(value || '').trim();
}

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function stripSecrets(snapshot) {
  const next = deepClone(snapshot);
  if (next.settings?.ai) next.settings.ai.apiKey = '';
  if (next.settings?.backup) next.settings.backup.token = undefined;
  return next;
}

export function normalizeBackupConfig(config = {}) {
  return {
    owner: cleanText(config.owner),
    repo: cleanText(config.repo),
    branch: cleanText(config.branch) || DEFAULT_BRANCH,
    path: cleanText(config.path) || DEFAULT_PATH
  };
}

export function buildBackupPayload(snapshot) {
  return {
    app: 'acl-training',
    schemaVersion: snapshot?.version,
    exportedAt: new Date().toISOString(),
    snapshot: stripSecrets(snapshot)
  };
}

export function textToBase64(text) {
  const value = String(text ?? '');
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function base64ToText(base64) {
  const value = String(base64 ?? '').replace(/\s/g, '');
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('utf8');
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function loadBackupToken() {
  const store = getStorage();
  if (!store) return '';
  return cleanText(store.getItem(TOKEN_KEY) || store.getItem(LEGACY_TOKEN_KEY));
}

export function saveBackupToken(token) {
  const store = getStorage();
  if (!store) return;
  const value = cleanText(token);
  if (value) store.setItem(TOKEN_KEY, value);
  else {
    store.removeItem(TOKEN_KEY);
    store.removeItem(LEGACY_TOKEN_KEY); // 清空时一并清旧键，避免旧值复活
  }
}

function encodePath(path) {
  return cleanText(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function buildContentsUrl({ owner, repo, path }) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
}

export function validateBackupInputs(configInput, token) {
  const config = normalizeBackupConfig(configInput);
  if (!config.owner || !config.repo) return { ok: false, msg: '请填写 GitHub owner 和数据仓库名', config };
  if (!cleanText(token)) return { ok: false, msg: '请填写只授权数据仓库的 fine-grained token', config };
  return { ok: true, config };
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cleanText(token)}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function readError(resp, fallback) {
  try {
    const data = await resp.json();
    return cleanText(data?.message) || fallback;
  } catch {
    return fallback;
  }
}

export async function getBackupFile(configInput, token) {
  const validation = validateBackupInputs(configInput, token);
  if (!validation.ok) return validation;
  const { config } = validation;
  const resp = await fetch(`${buildContentsUrl(config)}?ref=${encodeURIComponent(config.branch)}`, {
    headers: headers(token),
    cache: 'no-store'
  });
  if (resp.status === 404) return { ok: true, exists: false, config };
  if (!resp.ok) return { ok: false, msg: await readError(resp, `GitHub 读取失败（HTTP ${resp.status}）`), config };
  const data = await resp.json();
  let payload = null;
  try {
    payload = JSON.parse(base64ToText(data.content || ''));
  } catch {
    return { ok: false, msg: '备份文件不是有效 JSON', config };
  }
  return { ok: true, exists: true, config, sha: cleanText(data.sha), payload };
}

export async function pushBackup(snapshot, configInput, token) {
  const validation = validateBackupInputs(configInput, token);
  if (!validation.ok) return validation;
  const existing = await getBackupFile(validation.config, token);
  if (!existing.ok) return existing;

  const payload = buildBackupPayload(snapshot);
  const body = {
    message: `backup acl-training ${payload.exportedAt}`,
    content: textToBase64(JSON.stringify(payload, null, 2)),
    branch: validation.config.branch
  };
  if (existing.exists && existing.sha) body.sha = existing.sha;

  const resp = await fetch(buildContentsUrl(validation.config), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    return { ok: false, msg: await readError(resp, `GitHub 备份失败（HTTP ${resp.status}）`), config: validation.config };
  }
  const data = await resp.json();
  return {
    ok: true,
    config: validation.config,
    exportedAt: payload.exportedAt,
    commitSha: cleanText(data.commit?.sha)
  };
}

export async function pullBackup(configInput, token) {
  const file = await getBackupFile(configInput, token);
  if (!file.ok) return file;
  if (!file.exists) return { ok: false, msg: '数据仓库里还没有备份文件', config: file.config };
  if (file.payload?.app !== 'acl-training' || !file.payload?.snapshot) {
    return { ok: false, msg: '备份文件不是 acl-training 快照', config: file.config };
  }
  return {
    ok: true,
    config: file.config,
    snapshot: file.payload.snapshot,
    exportedAt: cleanText(file.payload.exportedAt),
    sha: file.sha
  };
}
