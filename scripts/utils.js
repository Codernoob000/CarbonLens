/**
 * @fileoverview Shared utility functions for CarbonLens.
 * All DOM manipulation uses safe methods (textContent, DOM API).
 * No innerHTML or eval per Security Rule 11.
 */

/**
 * Creates a debounced version of a function.
 * @param {Function} func - The function to debounce.
 * @param {number} delayMs - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
function debounce(func, delayMs) {
  let timeoutId;
  return function debouncedFn(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delayMs);
  };
}

/**
 * Creates a throttled version of a function.
 * @param {Function} func - The function to throttle.
 * @param {number} limitMs - Minimum interval in milliseconds.
 * @returns {Function} Throttled function.
 */
function throttle(func, limitMs) {
  let lastCall = 0;
  return function throttledFn(...args) {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

/**
 * Formats a number with locale-appropriate separators.
 * @param {number} value - The number to format.
 * @param {number} [decimals=1] - Decimal places.
 * @returns {string} Formatted number string.
 */
function formatNumber(value, decimals = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a CO2 value with appropriate unit (kg or tonnes).
 * @param {number} kgCO2 - Value in kilograms of CO2e.
 * @returns {string} Formatted string with unit.
 */
function formatCO2(kgCO2) {
  if (typeof kgCO2 !== 'number' || Number.isNaN(kgCO2)) {
    return '0 kg CO₂e';
  }
  if (Math.abs(kgCO2) >= 1000) {
    return formatNumber(kgCO2 / 1000, 2) + ' tonnes CO₂e';
  }
  return formatNumber(kgCO2, 1) + ' kg CO₂e';
}

/**
 * Sanitizes a string for safe display (client-side UX layer).
 * Server-side validation is authoritative (Security Rule 3).
 * @param {string} input - Raw user input.
 * @returns {string} Sanitized string.
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .trim()
    .replace(/[<>"'&]/g, (char) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return entities[char] || char;
    });
}

/**
 * Clamps a numeric value within a range.
 * @param {number} value - The value to clamp.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @returns {number} Clamped value.
 */
function clampNumber(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return min;
  }
  return Math.min(Math.max(num, min), max);
}

/**
 * Safely reads a value from localStorage.
 * @param {string} key - Storage key.
 * @param {*} defaultValue - Fallback if key doesn't exist or parsing fails.
 * @returns {*} Parsed value or default.
 */
function storageGet(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * Safely writes a value to localStorage.
 * @param {string} key - Storage key.
 * @param {*} value - Value to store (will be JSON-serialized).
 * @returns {boolean} True if successful.
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats an ISO date string to a user-friendly format.
 * @param {string} isoString - ISO 8601 date string.
 * @returns {string} Formatted date (e.g., "Jun 12, 2026").
 */
function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Generates a unique ID string.
 * @returns {string} UUID-like string.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Announces a message to screen readers via an ARIA live region.
 * @param {string} message - The message to announce.
 * @param {string} [priority='polite'] - 'polite' or 'assertive'.
 */
function announceToScreenReader(message, priority = 'polite') {
  const region = document.getElementById('sr-announcements');
  if (!region) {
    return;
  }
  region.setAttribute('aria-live', priority);
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * Traps keyboard focus within a modal/dialog element.
 * @param {HTMLElement} container - The container to trap focus in.
 * @returns {Function} Cleanup function to remove the trap.
 */
function trapFocus(container) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /**
   * Handles keydown to cycle focus within the container.
   * @param {KeyboardEvent} event - The keydown event.
   */
  function handleKeyDown(event) {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = container.querySelectorAll(focusableSelectors);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handleKeyDown);
  return function removeTrap() {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Returns the current month name and year.
 * @returns {string} Formatted month-year (e.g., "June 2026").
 */
function getCurrentMonthYear() {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Calculates a percentage with bounds checking.
 * @param {number} value - Current value.
 * @param {number} total - Total/maximum value.
 * @returns {number} Percentage (0–100).
 */
function calcPercentage(value, total) {
  if (!total || typeof value !== 'number' || typeof total !== 'number') {
    return 0;
  }
  return clampNumber((value / total) * 100, 0, 100);
}

/**
 * Checks if the current active theme is dark.
 * @returns {boolean} True if dark theme is active.
 */
function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

