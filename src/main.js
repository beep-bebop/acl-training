import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';

import { createEmptySnapshot, normalizeCatalog, defaultProgram } from './core/schema.js';
import { fetchSeedCatalog, loadSnapshotInfo } from './services/persistence.js';
import { startReminderLoop } from './services/notifications.js';
import { useCatalogStore } from './stores/catalog.js';
import { useProgramStore } from './stores/program.js';
import { useLogsStore } from './stores/logs.js';
import { useSettingsStore } from './stores/settings.js';
import { useUiStore } from './stores/ui.js';
import { initPersistence } from './stores/persist.js';
import { weekStatus } from './core/periodization.js';

async function bootstrap() {
  const ui = useUiStore();
  const { snapshot, migrated } = loadSnapshotInfo();
  let data = snapshot;
  let seeded = false;

  if (!data) {
    data = createEmptySnapshot();
    try {
      const seed = await fetchSeedCatalog();
      data.catalog = normalizeCatalog(seed);
      data.program = defaultProgram(data.catalog);
      seeded = true;
    } catch (err) {
      console.error('[bootstrap] 种子数据加载失败', err);
    }
  }

  useCatalogStore().hydrate(data.catalog);
  useProgramStore().hydrate(data.program);
  useLogsStore().hydrate(data.logs);
  useSettingsStore().hydrate(data.settings);
  try {
    initPersistence();
  } catch (err) {
    console.error('[bootstrap] 持久化初始化失败', err);
  }

  if (migrated) ui.toast('已从旧版本自动迁移训练数据');
  else if (seeded) ui.toast('已载入默认 ACL 康复动作库');

  // 跟随系统主题
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    const settings = useSettingsStore();
    if (settings.theme === 'system') settings.applyTheme();
  });

  // 定时提醒（每日训练提醒 / 休息周前夕），应用保持打开期间有效
  const settings = useSettingsStore();
  const program = useProgramStore();
  startReminderLoop({
    getDailyConfig: () => settings.dailyReminder,
    getDeloadReminderEnabled: () => settings.deloadReminder,
    getVibrateEnabled: () => settings.vibrate,
    isDeloadTomorrow: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const key = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      return weekStatus(program.$state, key).isDeload;
    },
    dailyBody: '打开应用查看今天的安排'
  });
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
bootstrap().finally(() => {
  app.mount('#app');
});
