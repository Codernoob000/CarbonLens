/**
 * @fileoverview Main application controller for CarbonLens.
 * Manages calculator flow, action tracker, theme toggle, and orchestrates all modules.
 * No innerHTML with user data (Security Rule 11). No console.log in production.
 * All event listeners cleaned up properly — no memory leaks.
 */

/* ============================================
   CONSTANTS
   ============================================ */
const TOTAL_STEPS = 4;
const STORAGE_KEY_THEME = 'carbonlens_theme';
const STORAGE_KEY_ACTIONS = 'carbonlens_actions';
const STORAGE_KEY_STREAK = 'carbonlens_streak';
const STORAGE_KEY_HISTORY = 'footprint_history';
const STORAGE_KEY_LAST_CALC = 'last_calculation';
const STORAGE_KEY_BADGES = 'carbonlens_badges';

/** Scale maximum in tonnes CO2 for comparison bar */
const COMPARISON_MAX_TONNES = 20;
/** Maximum history months to retain */
const MAX_HISTORY_MONTHS = 12;
/** Total circumference of the eco-score SVG circle */
const ECO_SCORE_CIRCUMFERENCE = 327;
/** Eco-score threshold for 'excellent' rating */
const SCORE_EXCELLENT = 80;
/** Eco-score threshold for 'good' rating */
const SCORE_GOOD = 60;
/** Eco-score threshold for 'average' rating */
const SCORE_AVERAGE = 40;
/** Duration in ms for toast fade transitions */
const TOAST_TRANSITION_MS = 300;
/** Streak count threshold (days) for Week Warrior achievement */
const BADGE_STREAK_WEEK = 7;
/** Streak count threshold (days) for Eco Champion achievement */
const BADGE_STREAK_CHAMPION = 30;
/** Minimum months of history required for Eco Champion achievement */
const BADGE_HISTORY_MONTHS = 3;
/** Minimum household size allowed */
const MIN_HOUSEHOLD_SIZE = 1;
/** Maximum household size allowed */
const MAX_HOUSEHOLD_SIZE = 20;

/* ============================================
   APPLICATION STATE
   ============================================ */
/** @type {number} Current calculator step (1-based) */
let currentStep = 1;

/** @type {Object|null} Latest calculation results */
let latestResults = null;

/* ============================================
   INITIALIZATION
   ============================================ */

/**
 * Initializes the entire application when DOM is ready.
 */
function initApp() {
  initTheme();
  initCalculator();
  initInsightsChat();
  initActionTracker();
  initNavigation();
  initGoogleCharts();
  setupChartResize();
  initRateLimitModal();
  loadSavedState();
}

/**
 * Loads saved state from localStorage on startup.
 */
function loadSavedState() {
  const lastCalc = storageGet(STORAGE_KEY_LAST_CALC, null);
  if (lastCalc) {
    latestResults = lastCalc;
    displayResults(lastCalc);
    updateAllCharts(lastCalc);
    updateEcoScore(lastCalc.totalTonnes);
    updateHeroStat(lastCalc.totalTonnes);
  }

  updateStreakDisplay();
  loadActionState();
  updateBadges();
}

/* ============================================
   THEME MANAGEMENT
   ============================================ */

/**
 * Initializes theme based on saved preference or system preference.
 */
function initTheme() {
  const saved = storageGet(STORAGE_KEY_THEME, null);
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTheme);
  }
}

/**
 * Toggles between dark and light theme.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  storageSet(STORAGE_KEY_THEME, next);
  announceToScreenReader(`Switched to ${next} mode`);
  redrawCharts();
}

/* ============================================
   NAVIGATION
   ============================================ */

/**
 * Initializes mobile navigation toggle and smooth scroll.
 */
function initNavigation() {
  const menuToggle = document.getElementById('nav-menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = !mobileNav.hidden;
      mobileNav.hidden = isOpen;
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
    });

    const mobileLinks = mobileNav.querySelectorAll('.mobile-nav-link');
    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.hidden = true;
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

/* ============================================
   CALCULATOR
   ============================================ */

/**
 * Initializes the multi-step calculator form.
 */
function initCalculator() {
  const prevBtn = document.getElementById('calc-prev');
  const nextBtn = document.getElementById('calc-next');
  const submitBtn = document.getElementById('calc-submit');
  const form = document.getElementById('calculator-form');
  const recalcBtn = document.getElementById('recalculate-btn');
  const insightsBtn = document.getElementById('get-insights-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', goToPreviousStep);
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', goToNextStep);
  }
  if (form) {
    form.addEventListener('submit', handleCalculation);
  }
  if (recalcBtn) {
    recalcBtn.addEventListener('click', resetCalculator);
  }
  if (insightsBtn) {
    insightsBtn.addEventListener('click', requestInsightsFromResults);
  }

  const stepButtons = document.querySelectorAll('.calc-step');
  stepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.getAttribute('data-step'), 10);
      if (target <= currentStep) {
        navigateToStep(target);
      }
    });
  });

  updateStepUI();
}

/**
 * Advances to the next calculator step.
 */
function goToNextStep() {
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateStepUI();
    announceToScreenReader(`Step ${currentStep} of ${TOTAL_STEPS}`);
  }
}

/**
 * Returns to the previous calculator step.
 */
function goToPreviousStep() {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
    announceToScreenReader(`Step ${currentStep} of ${TOTAL_STEPS}`);
  }
}

/**
 * Navigates directly to a specific step.
 * @param {number} step - Target step number (1-based).
 */
function navigateToStep(step) {
  currentStep = clampNumber(step, 1, TOTAL_STEPS);
  updateStepUI();
}

/**
 * Shows the active panel and hides all others.
 * @param {number} step - Current step number.
 */
function updatePanelVisibility(step) {
  const panels = document.querySelectorAll('.calc-panel');
  panels.forEach((panel) => {
    const panelStep = parseInt(panel.getAttribute('data-step'), 10);
    const isActive = panelStep === step;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

/**
 * Updates step button classes and aria-current attributes.
 * @param {number} step - Current step number.
 */
function updateStepButtonStates(step) {
  const stepBtns = document.querySelectorAll('.calc-step');
  stepBtns.forEach((btn) => {
    const btnStep = parseInt(btn.getAttribute('data-step'), 10);
    btn.classList.toggle('active', btnStep === step);
    btn.classList.toggle('completed', btnStep < step);
    btn.setAttribute('aria-current', btnStep === step ? 'step' : 'false');
  });
}

/**
 * Calculates and sets the progress bar fill width.
 * @param {number} step - Current step number.
 * @param {number} totalSteps - Total number of steps.
 */
function updateProgressBarWidth(step, totalSteps) {
  const progressBar = document.getElementById('calc-progress-bar');
  if (progressBar) {
    const trackContainer = document.querySelector('.calc-progress');
    if (trackContainer) {
      /* Track spans from left:48px to right:48px inside the container.
         The usable track width = container width - 96px.
         Step fraction = (step - 1) / (totalSteps - 1) */
      const containerWidth = trackContainer.offsetWidth;
      const trackWidth = containerWidth - 96; /* 48px padding on each side */
      const fraction = (step - 1) / (totalSteps - 1);
      progressBar.style.width = `${Math.round(fraction * trackWidth)}px`;
    }
  }

  const progressRegion = document.querySelector('.calc-progress');
  if (progressRegion) {
    progressRegion.setAttribute('aria-valuenow', String(step));
  }
}

/**
 * Shows or hides the prev/next/submit buttons based on the current step.
 * @param {number} step - Current step number.
 * @param {number} totalSteps - Total number of steps.
 */
function updateNavigationButtons(step, totalSteps) {
  const prevBtn = document.getElementById('calc-prev');
  const nextBtn = document.getElementById('calc-next');
  const submitBtn = document.getElementById('calc-submit');

  if (prevBtn) {
    prevBtn.disabled = step === 1;
  }
  if (nextBtn) {
    nextBtn.hidden = step === totalSteps;
    nextBtn.style.display = step === totalSteps ? 'none' : '';
  }
  if (submitBtn) {
    submitBtn.hidden = step !== totalSteps;
    submitBtn.style.display = step === totalSteps ? '' : 'none';
  }
}

/**
 * Updates the calculator UI to reflect the current step.
 */
function updateStepUI() {
  updatePanelVisibility(currentStep);
  updateStepButtonStates(currentStep);
  updateProgressBarWidth(currentStep, TOTAL_STEPS);
  updateNavigationButtons(currentStep, TOTAL_STEPS);
}

/**
 * Attempts online calculation; falls back to offline on failure.
 * @param {Object} formData - Gathered form input data.
 * @returns {Promise<Object>} Calculation results.
 */
async function calculateWithFallback(formData) {
  try {
    return await calculateFootprint(formData);
  } catch {
    return calculateFootprintOffline(formData);
  }
}

/**
 * Handles form submission and triggers carbon calculation.
 * @param {Event} event - Form submit event.
 */
async function handleCalculation(event) {
  event.preventDefault();

  const formData = gatherFormData();
  const submitBtn = document.getElementById('calc-submit');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Calculating...';
  }

  try {
    const results = await calculateWithFallback(formData);

    latestResults = results;
    storageSet(STORAGE_KEY_LAST_CALC, results);
    saveToHistory(results);
    displayResults(results);
    updateAllCharts(results);
    updateEcoScore(results.totalTonnes);
    updateHeroStat(results.totalTonnes);
    showToast('Footprint calculated successfully!', 'success');
    announceToScreenReader(
      `Your annual carbon footprint is ${results.totalTonnes} tonnes CO2 equivalent`
    );
  } catch (error) {
    showToast(error.message || 'Calculation failed. Please try again.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Calculate My Footprint';
    }
  }
}

/**
 * Gathers all form input values into a data object.
 * @returns {Object} Form data with all calculator inputs.
 */
function gatherFormData() {
  return {
    carKm: clampNumber(document.getElementById('car-km')?.value, 0, INPUT_LIMITS.MAX_KM_PER_WEEK),
    busKm: clampNumber(document.getElementById('bus-km')?.value, 0, INPUT_LIMITS.MAX_KM_PER_WEEK),
    trainKm: clampNumber(document.getElementById('train-km')?.value, 0, INPUT_LIMITS.MAX_KM_PER_WEEK),
    flightsShort: clampNumber(document.getElementById('flights-short')?.value, 0, INPUT_LIMITS.MAX_FLIGHTS_SHORT),
    flightsLong: clampNumber(document.getElementById('flights-long')?.value, 0, INPUT_LIMITS.MAX_FLIGHTS_LONG),
    electricityKwh: clampNumber(document.getElementById('electricity-kwh')?.value, 0, INPUT_LIMITS.MAX_KWH_PER_MONTH),
    gasKwh: clampNumber(document.getElementById('gas-kwh')?.value, 0, INPUT_LIMITS.MAX_KWH_PER_MONTH),
    householdSize: clampNumber(document.getElementById('household-size')?.value, MIN_HOUSEHOLD_SIZE, MAX_HOUSEHOLD_SIZE),
    dietType: document.getElementById('diet-type')?.value || 'medium_meat',
    mealsPerDay: clampNumber(document.getElementById('meals-per-day')?.value, 1, INPUT_LIMITS.MAX_MEALS_PER_DAY),
    foodWaste: clampNumber(document.getElementById('food-waste')?.value, 0, 100),
    clothingSpend: clampNumber(document.getElementById('clothing-spend')?.value, 0, INPUT_LIMITS.MAX_SPENDING_PER_MONTH),
    electronicsSpend: clampNumber(document.getElementById('electronics-spend')?.value, 0, INPUT_LIMITS.MAX_SPENDING_PER_MONTH),
    generalSpend: clampNumber(document.getElementById('general-spend')?.value, 0, INPUT_LIMITS.MAX_SPENDING_PER_MONTH),
  };
}

/**
 * Displays calculation results in the results section.
 * Uses safe DOM methods — no innerHTML with data (Security Rule 11).
 * @param {Object} results - Calculation results.
 */
function displayResults(results) {
  const form = document.getElementById('calculator-form');
  const resultsDiv = document.getElementById('calc-results');
  const totalEl = document.getElementById('results-total-value');
  const breakdownDiv = document.getElementById('results-breakdown');

  if (form) {
    form.hidden = true;
  }
  if (resultsDiv) {
    resultsDiv.hidden = false;
  }
  if (totalEl) {
    totalEl.textContent = formatNumber(results.totalTonnes, 2);
  }

  const calcNav = document.querySelector('.calc-nav');
  if (calcNav) {
    calcNav.hidden = true;
  }
  const calcProgress = document.querySelector('.calc-progress');
  if (calcProgress) {
    calcProgress.hidden = true;
  }

  updateComparisonMarker(results.totalTonnes);

  if (breakdownDiv && results.breakdown) {
    renderBreakdownItems(breakdownDiv, results.breakdown);
  }
}

/**
 * Renders individual breakdown items in the results panel.
 * @param {HTMLElement} container - The container element.
 * @param {Object} breakdown - Calculation breakdown.
 */
function renderBreakdownItems(container, breakdown) {
  container.textContent = '';
  const categories = [
    { key: 'transport', icon: '🚗', label: 'Transport' },
    { key: 'energy', icon: '⚡', label: 'Energy' },
    { key: 'food', icon: '🍽️', label: 'Food' },
    { key: 'lifestyle', icon: '🛍️', label: 'Lifestyle' },
  ];
  categories.forEach((cat) => {
    const item = document.createElement('div');
    item.className = 'breakdown-item';

    const icon = document.createElement('div');
    icon.className = 'breakdown-icon';
    icon.textContent = cat.icon;

    const label = document.createElement('span');
    label.className = 'breakdown-label';
    label.textContent = cat.label;

    const value = document.createElement('span');
    value.className = 'breakdown-value';
    value.textContent = formatCO2(breakdown[cat.key]);

    item.appendChild(icon);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  });
}

/**
 * Updates the comparison bar marker position.
 * @param {number} tonnes - User's annual footprint in tonnes.
 */
function updateComparisonMarker(tonnes) {
  const marker = document.getElementById('marker-yours');
  if (!marker) {
    return;
  }
  const maxScale = COMPARISON_MAX_TONNES;
  const position = clampNumber((tonnes / maxScale) * 100, 2, 98);
  marker.style.left = `${position}%`;
}

/**
 * Updates the hero stat with the user's footprint.
 * @param {number} tonnes - User's annual footprint in tonnes.
 */
function updateHeroStat(tonnes) {
  const el = document.getElementById('stat-yours');
  if (el) {
    el.textContent = formatNumber(tonnes, 1);
  }
}

/**
 * Resets the calculator to its initial state.
 */
function resetCalculator() {
  currentStep = 1;
  const form = document.getElementById('calculator-form');
  const resultsDiv = document.getElementById('calc-results');
  const calcNav = document.querySelector('.calc-nav');
  const calcProgress = document.querySelector('.calc-progress');

  if (form) {
    form.hidden = false;
    form.reset();
  }
  if (resultsDiv) {
    resultsDiv.hidden = true;
  }
  if (calcNav) {
    calcNav.hidden = false;
  }
  if (calcProgress) {
    calcProgress.hidden = false;
  }

  updateStepUI();
  announceToScreenReader('Calculator reset. Start from step 1.');
}

/**
 * Saves the current result to monthly history.
 * @param {Object} results - Calculation results.
 */
function saveToHistory(results) {
  const history = storageGet(STORAGE_KEY_HISTORY, []);
  const monthLabel = getCurrentMonthYear();
  const existingIndex = history.findIndex((entry) => entry.month === monthLabel);

  if (existingIndex >= 0) {
    history[existingIndex].value = results.totalTonnes;
  } else {
    history.push({ month: monthLabel, value: results.totalTonnes });
  }

  if (history.length > MAX_HISTORY_MONTHS) {
    history.shift();
  }

  storageSet(STORAGE_KEY_HISTORY, history);
}

/* ============================================
   ECO SCORE
   ============================================ */

/**
 * Updates the eco score ring based on user's footprint.
 * Lower footprint = higher score.
 * @param {number} tonnes - User's annual footprint in tonnes.
 */
function updateEcoScore(tonnes) {
  const maxTonnes = COMPARISON_MAX_TONNES;
  const score = Math.round(clampNumber(((maxTonnes - tonnes) / maxTonnes) * 100, 0, 100));

  const circle = document.getElementById('eco-score-circle');
  const valueEl = document.getElementById('eco-score-value');
  const labelEl = document.getElementById('eco-score-label');

  if (circle) {
    const circumference = ECO_SCORE_CIRCUMFERENCE;
    const offset = circumference - (score / 100) * circumference;
    circle.setAttribute('stroke-dashoffset', String(offset));
  }

  if (valueEl) {
    valueEl.textContent = String(score);
  }

  if (labelEl) {
    const labels = {
      excellent: 'Excellent! Well below global average.',
      good: 'Good! Below global average.',
      average: 'Average. Room for improvement.',
      high: 'Above average. Consider reducing emissions.',
    };
    if (score >= SCORE_EXCELLENT) {
      labelEl.textContent = labels.excellent;
    } else if (score >= SCORE_GOOD) {
      labelEl.textContent = labels.good;
    } else if (score >= SCORE_AVERAGE) {
      labelEl.textContent = labels.average;
    } else {
      labelEl.textContent = labels.high;
    }
  }
}

/* ============================================
   AI INSIGHTS CHAT
   ============================================ */

/**
 * Initializes the AI insights chat form.
 */
function initInsightsChat() {
  const form = document.getElementById('insights-form');
  if (form) {
    form.addEventListener('submit', handleInsightsSubmit);
  }
}

/**
 * Handles AI insights form submission.
 * @param {Event} event - Form submit event.
 */
async function handleInsightsSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('insights-input');
  const submitBtn = document.getElementById('insights-submit');

  if (!input || !input.value.trim()) {
    return;
  }

  const message = input.value.trim().substring(0, 1000);
  input.value = '';

  addChatMessage(message, 'user');

  if (submitBtn) {
    submitBtn.disabled = true;
  }

  try {
    const context = latestResults || {};
    await fetchAndDisplayInsights(message, context);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

/**
 * Triggers AI insight request from the calculator results.
 */
async function requestInsightsFromResults() {
  if (!latestResults) {
    return;
  }

  const section = document.getElementById('insights');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const summaryParts = [];
  if (latestResults.breakdown) {
    summaryParts.push(`Transport: ${formatCO2(latestResults.breakdown.transport)}`);
    summaryParts.push(`Energy: ${formatCO2(latestResults.breakdown.energy)}`);
    summaryParts.push(`Food: ${formatCO2(latestResults.breakdown.food)}`);
    summaryParts.push(`Lifestyle: ${formatCO2(latestResults.breakdown.lifestyle)}`);
  }
  const prompt = `My annual carbon footprint is ${latestResults.totalTonnes} tonnes CO₂e. Breakdown: ${summaryParts.join(', ')}. Give me the top 3 most impactful actions I can take to reduce it.`;

  addChatMessage(prompt, 'user');
  await fetchAndDisplayInsights(prompt, latestResults);
}

/**
 * Fetches and displays AI insights.
 * @param {string} message - User query message.
 * @param {Object} context - Emission data context.
 */
async function fetchAndDisplayInsights(message, context) {
  showTypingIndicator();
  try {
    const response = await getAIInsights(message, context);
    removeTypingIndicator();
    addChatMessage(response.reply || response.message || 'No insights available.', 'bot');
  } catch (error) {
    removeTypingIndicator();
    addChatMessage(error.message || 'Unable to get insights. Please try again.', 'bot');
  }
}

/**
 * Adds a chat message to the insights chat using safe DOM methods.
 * No innerHTML — uses textContent and createElement (Security Rule 11).
 * @param {string} text - Message text.
 * @param {string} sender - 'user' or 'bot'.
 */
function addChatMessage(text, sender) {
  const chat = document.getElementById('insights-chat');
  if (!chat) {
    return;
  }

  const msg = document.createElement('div');
  msg.className = `chat-message ${sender}-message`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = sender === 'user' ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.appendChild(paragraph);

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  chat.appendChild(msg);

  chat.scrollTop = chat.scrollHeight;
}

/**
 * Shows a typing indicator in the chat.
 */
function showTypingIndicator() {
  const chat = document.getElementById('insights-chat');
  if (!chat) {
    return;
  }

  const indicator = document.createElement('div');
  indicator.className = 'chat-message bot-message';
  indicator.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = '🤖';

  const dots = document.createElement('div');
  dots.className = 'typing-indicator';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'typing-dot';
    dots.appendChild(dot);
  }

  indicator.appendChild(avatar);
  indicator.appendChild(dots);
  chat.appendChild(indicator);
  chat.scrollTop = chat.scrollHeight;
}

/**
 * Removes the typing indicator from the chat.
 */
function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/* ============================================
   ACTION TRACKER
   ============================================ */

/**
 * Initializes the action tracker buttons.
 */
function initActionTracker() {
  const actionButtons = document.querySelectorAll('.action-toggle');
  actionButtons.forEach((btn) => {
    btn.addEventListener('click', handleActionToggle);
  });
}

/**
 * Handles toggling an eco-action on/off.
 * @param {Event} event - Click event.
 */
function handleActionToggle(event) {
  const btn = event.currentTarget;
  const isPressed = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', String(!isPressed));

  const actionItem = btn.closest('.action-item');
  const actionKey = actionItem?.getAttribute('data-action');
  const savings = parseFloat(actionItem?.getAttribute('data-savings')) || 0;

  saveActionState();
  updateTodaySavings();
  updateStreak();
  updateBadges();

  if (!isPressed) {
    showToast(`Great job! Saved ${savings} kg CO₂`, 'success');
    announceToScreenReader(`Action completed. Saved ${savings} kilograms CO2.`);
  }
}

/**
 * Calculates and displays today's total CO2 savings.
 */
function updateTodaySavings() {
  const activeButtons = document.querySelectorAll('.action-toggle[aria-pressed="true"]');
  let total = 0;

  activeButtons.forEach((btn) => {
    const item = btn.closest('.action-item');
    total += parseFloat(item?.getAttribute('data-savings')) || 0;
  });

  const display = document.getElementById('today-savings');
  if (display) {
    display.textContent = formatNumber(total, 1);
  }
}

/**
 * Saves current action states to localStorage.
 */
function saveActionState() {
  const states = {};
  const today = new Date().toISOString().split('T')[0];

  document.querySelectorAll('.action-toggle').forEach((btn) => {
    const item = btn.closest('.action-item');
    const key = item?.getAttribute('data-action');
    if (key) {
      states[key] = btn.getAttribute('aria-pressed') === 'true';
    }
  });

  storageSet(STORAGE_KEY_ACTIONS, { date: today, states: states });
}

/**
 * Loads saved action states from localStorage.
 */
function loadActionState() {
  const saved = storageGet(STORAGE_KEY_ACTIONS, null);
  const today = new Date().toISOString().split('T')[0];

  if (!saved || saved.date !== today) {
    return;
  }

  Object.entries(saved.states).forEach(([key, isActive]) => {
    const item = document.querySelector(`[data-action="${key}"]`);
    const btn = item?.querySelector('.action-toggle');
    if (btn && isActive) {
      btn.setAttribute('aria-pressed', 'true');
    }
  });

  updateTodaySavings();
}

/**
 * Updates the daily action streak counter.
 */
function updateStreak() {
  const streak = storageGet(STORAGE_KEY_STREAK, { count: 0, lastDate: '' });
  const today = new Date().toISOString().split('T')[0];
  const hasActions = document.querySelectorAll('.action-toggle[aria-pressed="true"]').length > 0;

  if (hasActions && streak.lastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (streak.lastDate === yesterdayStr) {
      streak.count++;
    } else if (streak.lastDate !== today) {
      streak.count = 1;
    }
    streak.lastDate = today;
    storageSet(STORAGE_KEY_STREAK, streak);
  }

  updateStreakDisplay();
}

/**
 * Updates the streak counter display.
 */
function updateStreakDisplay() {
  const streak = storageGet(STORAGE_KEY_STREAK, { count: 0 });
  const el = document.getElementById('streak-count');
  if (el) {
    el.textContent = String(streak.count);
  }
}

/**
 * Updates achievement badges based on user progress.
 */
function updateBadges() {
  const badges = storageGet(STORAGE_KEY_BADGES, {
    firstSteps: false,
    weekWarrior: false,
    carbonCutter: false,
    ecoChampion: false,
  });
  const streak = storageGet(STORAGE_KEY_STREAK, { count: 0 });
  const history = storageGet(STORAGE_KEY_HISTORY, []);
  const actionsToday = document.querySelectorAll('.action-toggle[aria-pressed="true"]').length;

  if (actionsToday >= 1) {
    badges.firstSteps = true;
  }
  if (streak.count >= BADGE_STREAK_WEEK) {
    badges.weekWarrior = true;
  }
  if (latestResults && latestResults.totalTonnes < BENCHMARKS.GLOBAL_AVERAGE) {
    badges.carbonCutter = true;
  }
  if (history.length >= BADGE_HISTORY_MONTHS && streak.count >= BADGE_STREAK_CHAMPION) {
    badges.ecoChampion = true;
  }

  storageSet(STORAGE_KEY_BADGES, badges);

  const badgeMap = {
    firstSteps: 0,
    weekWarrior: 1,
    carbonCutter: 2,
    ecoChampion: 3,
  };

  const badgeItems = document.querySelectorAll('.badge-item');
  Object.entries(badgeMap).forEach(([key, index]) => {
    if (badgeItems[index]) {
      badgeItems[index].classList.toggle('locked', !badges[key]);
      badgeItems[index].classList.toggle('unlocked', badges[key]);
    }
  });
}

/* ============================================
   TOAST NOTIFICATIONS
   ============================================ */

/**
 * Shows a toast notification.
 * @param {string} message - Notification message.
 * @param {string} [type='info'] - Toast type: 'success', 'error', 'warning', 'info'.
 * @param {number} [durationMs=4000] - Auto-dismiss duration.
 */
function showToast(message, type = 'info', durationMs = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, TOAST_TRANSITION_MS);
  }, durationMs);
}

/* ============================================
   RATE LIMIT MODAL
   ============================================ */

/**
 * Initializes the rate limit modal close handler.
 */
function initRateLimitModal() {
  const modal = document.getElementById('rate-limit-modal');
  const closeBtn = document.getElementById('rate-modal-close');

  if (modal && closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.close();
    });

    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        modal.close();
      }
    });
  }
}

/* ============================================
   DOM READY
   ============================================ */
document.addEventListener('DOMContentLoaded', initApp);
