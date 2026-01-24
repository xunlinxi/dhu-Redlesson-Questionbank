/**
 * 全局状态和常量
 */

const API_BASE = '';

// ==================== 环境检测 ====================
const isElectron = window.electronAPI !== undefined;
const isMobile = window.Capacitor !== undefined;
const isOffline = !isElectron && (isMobile || window.location.protocol === 'file:');

console.log('环境检测 - isElectron:', isElectron, 'isMobile:', isMobile, 'isOffline:', isOffline);

// 全局状态变量
let currentPage = 'dashboard';
let practiceQuestions = [];
let currentQuestionIndex = 0;
let selectedAnswers = [];
let correctCount = 0;
let wrongCount = 0;
let currentBankName = '';
let editingQuestionId = null;
let serverOnline = true;
let healthCheckInterval = null;
let practiceTimer = null;
let remainingTime = 0;
let practiceStartTime = null;
let isExamMode = false;
let questionResults = [];
let lastPracticeSettings = null;
let isBackMode = false;
let editOptionsState = [];
let currentPracticeMode = 'random';
let currentWrongBankName = '';
let currentProgressId = null;
let loadedElapsedTime = 0;
let navCurrentPage = 1;
const NAV_PAGE_SIZE = 56;
