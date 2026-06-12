/**
 * @fileoverview Google Charts integration for CarbonLens dashboard.
 * Provides emission breakdown (pie), monthly trend (line), and category comparison (bar) charts.
 * Graceful degradation if Google Charts is unavailable.
 *
 * Google Charts is a public JavaScript library loaded from gstatic.com.
 * It does NOT require an API key — it is intentionally loaded client-side (Security Rule 1 note).
 */

/** @type {boolean} Whether Google Charts has loaded successfully */
let chartsReady = false;

/**
 * Initializes Google Charts library and marks readiness.
 * Falls back gracefully if the library fails to load.
 */
function initGoogleCharts() {
  try {
    if (typeof google === 'undefined' || !google.charts) {
      showChartsFallback();
      return;
    }

    google.charts.load('current', {
      packages: ['corechart'],
      callback: onChartsLoaded,
    });
  } catch {
    showChartsFallback();
  }
}

/**
 * Callback when Google Charts packages are loaded.
 */
function onChartsLoaded() {
  chartsReady = true;
  announceToScreenReader('Dashboard charts are ready');
}

/**
 * Renders the emission breakdown pie chart.
 * @param {Object} breakdown - Emission values by category (kg CO2e).
 * @param {number} breakdown.transport - Transport emissions.
 * @param {number} breakdown.energy - Energy emissions.
 * @param {number} breakdown.food - Food emissions.
 * @param {number} breakdown.lifestyle - Lifestyle emissions.
 */
function renderBreakdownChart(breakdown) {
  if (!chartsReady) {
    showChartFallbackText('chart-breakdown', breakdown);
    return;
  }

  const container = document.getElementById('chart-breakdown');
  if (!container) {
    return;
  }

  const data = google.visualization.arrayToDataTable([
    ['Category', 'kg CO₂e'],
    ['Transport', breakdown.transport],
    ['Energy', breakdown.energy],
    ['Food', breakdown.food],
    ['Lifestyle', breakdown.lifestyle],
  ]);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const options = {
    backgroundColor: 'transparent',
    colors: ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6'],
    legend: {
      position: 'bottom',
      textStyle: {
        color: isDark ? '#94a3b8' : '#475569',
        fontName: 'Inter',
        fontSize: 12,
      },
    },
    pieHole: 0.45,
    pieSliceTextStyle: {
      color: '#fff',
      fontName: 'Inter',
      fontSize: 11,
    },
    chartArea: {
      width: '90%',
      height: '75%',
    },
    tooltip: {
      textStyle: { fontName: 'Inter', fontSize: 13 },
    },
  };

  container.textContent = '';
  const chart = new google.visualization.PieChart(container);
  chart.draw(data, options);
}

/**
 * Renders the monthly trend line chart.
 * @param {Array<Object>} history - Array of monthly footprint entries.
 * @param {string} history[].month - Month label (e.g., "Jan 2026").
 * @param {number} history[].value - Footprint value in tonnes CO2e.
 */
function renderTrendChart(history) {
  if (!chartsReady) {
    showChartFallbackText('chart-trend', null);
    return;
  }

  const container = document.getElementById('chart-trend');
  if (!container) {
    return;
  }

  const rows = history.map((entry) => [entry.month, entry.value]);
  const data = google.visualization.arrayToDataTable([
    ['Month', 'Tonnes CO₂e'],
    ...rows,
  ]);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const options = {
    backgroundColor: 'transparent',
    colors: ['#10b981'],
    curveType: 'function',
    legend: { position: 'none' },
    hAxis: {
      textStyle: {
        color: isDark ? '#94a3b8' : '#475569',
        fontName: 'Inter',
        fontSize: 11,
      },
      gridlines: { color: 'transparent' },
    },
    vAxis: {
      textStyle: {
        color: isDark ? '#94a3b8' : '#475569',
        fontName: 'Inter',
        fontSize: 11,
      },
      gridlines: { color: isDark ? '#1e293b' : '#e2e8f0' },
      minValue: 0,
    },
    chartArea: {
      width: '85%',
      height: '75%',
    },
    lineWidth: 3,
    pointSize: 6,
    tooltip: {
      textStyle: { fontName: 'Inter', fontSize: 13 },
    },
  };

  container.textContent = '';
  const chart = new google.visualization.LineChart(container);
  chart.draw(data, options);
}

/**
 * Renders the category comparison bar chart.
 * @param {Object} breakdown - Emission values by category (kg CO2e).
 * @param {number} breakdown.transport - Transport emissions.
 * @param {number} breakdown.energy - Energy emissions.
 * @param {number} breakdown.food - Food emissions.
 * @param {number} breakdown.lifestyle - Lifestyle emissions.
 */
function renderCategoryChart(breakdown) {
  if (!chartsReady) {
    showChartFallbackText('chart-categories', breakdown);
    return;
  }

  const container = document.getElementById('chart-categories');
  if (!container) {
    return;
  }

  const data = google.visualization.arrayToDataTable([
    ['Category', 'kg CO₂e', { role: 'style' }],
    ['Transport', breakdown.transport, '#10b981'],
    ['Energy', breakdown.energy, '#06b6d4'],
    ['Food', breakdown.food, '#f59e0b'],
    ['Lifestyle', breakdown.lifestyle, '#8b5cf6'],
  ]);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const options = {
    backgroundColor: 'transparent',
    legend: { position: 'none' },
    hAxis: {
      textStyle: {
        color: isDark ? '#94a3b8' : '#475569',
        fontName: 'Inter',
        fontSize: 11,
      },
      gridlines: { color: isDark ? '#1e293b' : '#e2e8f0' },
    },
    vAxis: {
      textStyle: {
        color: isDark ? '#94a3b8' : '#475569',
        fontName: 'Inter',
        fontSize: 11,
      },
      gridlines: { color: 'transparent' },
    },
    chartArea: {
      width: '80%',
      height: '75%',
    },
    bar: { groupWidth: '60%' },
    tooltip: {
      textStyle: { fontName: 'Inter', fontSize: 13 },
    },
  };

  container.textContent = '';
  const chart = new google.visualization.BarChart(container);
  chart.draw(data, options);
}

/**
 * Updates all dashboard charts with new data.
 * @param {Object} results - Calculation results from the API or offline calculation.
 */
function updateAllCharts(results) {
  if (!results || !results.breakdown) {
    return;
  }

  renderBreakdownChart(results.breakdown);
  renderCategoryChart(results.breakdown);

  const history = storageGet('footprint_history', []);
  if (history.length > 0) {
    renderTrendChart(history);
  }
}

/**
 * Redraws all charts (e.g., on theme change or resize).
 */
function redrawCharts() {
  const lastResult = storageGet('last_calculation', null);
  if (lastResult) {
    updateAllCharts(lastResult);
  }
}

/**
 * Shows a text-based fallback when Google Charts fails to load.
 * Ensures graceful degradation (Google Services requirement).
 */
function showChartsFallback() {
  const chartIds = ['chart-breakdown', 'chart-trend', 'chart-categories'];
  chartIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      const fallback = document.createElement('p');
      fallback.className = 'chart-placeholder';
      fallback.textContent = 'Charts unavailable. Data is shown in the results above.';
      el.appendChild(fallback);
    }
  });
}

/**
 * Shows text fallback for a specific chart when Google Charts is unavailable.
 * @param {string} containerId - Chart container element ID.
 * @param {Object|null} data - Data to display as text.
 */
function showChartFallbackText(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) {
    return;
  }
  el.textContent = '';
  const fallback = document.createElement('div');
  fallback.className = 'chart-placeholder';

  if (data) {
    const lines = Object.entries(data).map(
      ([key, val]) => `${key}: ${formatCO2(val)}`
    );
    fallback.textContent = lines.join(' | ');
  } else {
    fallback.textContent = 'Chart data will appear after calculation.';
  }

  el.appendChild(fallback);
}

/**
 * Sets up responsive chart resizing with debounce.
 */
function setupChartResize() {
  const debouncedRedraw = debounce(redrawCharts, 300);
  window.addEventListener('resize', debouncedRedraw);
}
