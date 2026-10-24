# ACL 训练

ACL 康复训练的**周期管理 + 训练执行 + 动作库工作台**。手机端优先（PWA），桌面端提供 JSON 化的动作库编辑器。

线上地址：<https://beep-bebop.github.io/acl-training/>

## 功能

- **今日**：周期状态（渐进周/休息周）→ 晨检打卡（疼痛/肿胀安全门槛）→ 今日推荐计划 → 本周条带
- **训练执行**：≥52px 大组按钮（点按局部更新，不重排页面）、自动休息计时（振动+通知+提示音）、渐进建议横幅（采纳/忽略）、长按组记录负荷与疼痛、会话总结（RPE/备注）
- **渐进负荷引擎**：基于最近一次记录 + 动作处方（RPE/疼痛上限/进阶退阶文案），双重渐进规则给出确定性的进阶/维持/退阶建议
- **周期体系**：每周排班、每 N 周自动休息周（可手动标记）、阶段切换（展示进阶标准）、休息周前夕提醒
- **数据看板**：训练日历热力图、周训练次数、动作负荷趋势、疼痛趋势、连续周数
- **桌面工作台**（≥1024px）：阶段→计划→模块树导航、动作表格行内编辑与拖拽排序、处方全字段表单、**JSON 双向同步**（CodeMirror，校验后应用）、按子集导出/导入（覆盖/追加策略 + 冲突预览）、AI 动作详解（DeepSeek）
- **数据安全**：localStorage 单键持久化 + GitHub 私有仓库自动备份（fine-grained token），完整快照导入导出

## 技术栈

Vite + Vue 3（`<script setup>`）+ Pinia + vue-router（hash）。自建设计系统（深色优先 tokens，零 UI 组件库依赖），图表为手写 SVG。运行时依赖仅 vue / pinia / vue-router / sortablejs / codemirror。

## 开发

```bash
npm install
npm run dev        # 本地开发
npm test           # node:test 单元测试（领域逻辑全覆盖）
npm run build      # 构建到 dist/
npm run icons      # 重新生成 PWA 图标
```

## 结构

```
src/
  core/        领域纯函数：schema(v9) / migration / periodization / progression / metrics
  services/    persistence / notifications / github-backup / auto-backup / ai
  stores/      Pinia：catalog / program / logs / training / settings / ui / persist(接线)
  components/  ui（设计系统组件+SVG图表）/ training（训练组件）/ desktop（工作台组件）
  views/       Today / Library / PlanDetail / Training / Progress / Settings / Program / Workbench
public/data/catalog.json   种子动作库（3 阶段 / 11 计划 / 113 动作，含处方元数据）
```

**命名约定**：全仓库唯一版本号 `SCHEMA_VERSION`（src/core/schema.js），文件名/符号/存储键/数据文件一律不带版本号。localStorage 键 `acl-training`；旧键 `acl_v7`/`acl_v6` 只读迁移、不删除。

## 数据与部署

- 推送 `main` → GitHub Actions：`npm ci` → `npm test` → `npm run build` → 仅部署 `dist/`
- 备份：设置 → GitHub 数据备份，推荐使用只授权单一私有仓库的 fine-grained token
