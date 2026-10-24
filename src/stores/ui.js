// 界面全局状态：toast / 确认对话框 / 底部抽屉。
import { defineStore } from 'pinia';

let toastSeq = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    confirm: { open: false, title: '', body: '', confirmText: '确认', cancelText: '取消', danger: false, resolve: null }
  }),

  actions: {
    toast(text, type = 'info') {
      const id = ++toastSeq;
      this.toasts.push({ id, text, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 2600);
    },

    /** 替代原生 confirm()，返回 Promise<boolean> */
    confirmAsync({ title, body = '', confirmText = '确认', cancelText = '取消', danger = false } = {}) {
      return new Promise((resolve) => {
        this.confirm = { open: true, title, body, confirmText, cancelText, danger, resolve };
      });
    },
    settleConfirm(result) {
      this.confirm.resolve?.(result);
      this.confirm = { open: false, title: '', body: '', confirmText: '确认', cancelText: '取消', danger: false, resolve: null };
    }
  }
});
