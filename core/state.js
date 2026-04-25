// 状态管理 - 所有运行时状态集中在此

export const state = {
  // 导航
  currentPage: 'pageLibrary',
  currentPlanId: null,
  isEditMode: false,

  // canonical v7
  catalog: { planGroups: [] },
  runtime: {
    progress: {},             // { [exerciseId_s0]: true }
    exerciseRest: {},         // { [exerciseId]: rest seconds }
    calendarLogs: {},         // 'YYYY-MM-DD' => [{ planId, exerciseId, name, planName, time }]
    trainingDate: null,
    trainingSessionStartAt: null,
  },
  settings: {
    aiConfig: {
      deepseekApiKey: '',
      deepseekModel: 'deepseek-v4-flash',
    },
  },

  // 兼容层（只保留派生数据）
  plans: [],
  defaultCatalogCache: null,
  dataLoaded: false,

  // 日历
  calYear: null,
  calMonth: null,
};
