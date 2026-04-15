// 状态管理 - 所有运行时状态集中在此

export const state = {
  // 导航
  currentPage: 'pageLibrary',
  currentPlanId: null,
  isEditMode: false,

  // 数据
  plans: [],
  exerciseRest: {},       // key => rest seconds
  calendarLogs: {},       // 'YYYY-MM-DD' => [{ planId, name, planName, time }]
  trainingProgress: {},   // 每日训练进度
  trainingDate: null,
  userEdits: {},          // planId => { "mi_ei": { name, sets, tip } }
  defaultPlansCache: null,
  dataLoaded: false,

  // 日历
  calYear: null,
  calMonth: null,
};
