// 设置：主题 / 提醒 / AI / 备份。
import { defineStore } from 'pinia';
import { defaultSettings } from '../core/schema.js';

export const useSettingsStore = defineStore('settings', {
  state: () => ({ ...defaultSettings(), loaded: false }),

  getters: {
    backupConfigured(state) {
      return Boolean(state.backup.owner && state.backup.repo);
    }
  },

  actions: {
    hydrate(settings) {
      Object.assign(this, defaultSettings(), settings || {});
      this.loaded = true;
      this.applyTheme();
    },
    patch(patch) {
      Object.assign(this, patch);
    },
    patchBackup(patch) {
      this.backup = { ...this.backup, ...patch };
    },
    patchDailyReminder(patch) {
      this.dailyReminder = { ...this.dailyReminder, ...patch };
    },
    patchAi(patch) {
      this.ai = { ...this.ai, ...patch };
    },

    applyTheme() {
      if (typeof document === 'undefined') return;
      const theme = this.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
        : this.theme;
      document.documentElement.dataset.theme = theme;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f6f8' : '#0b0e13');
    }
  }
});
