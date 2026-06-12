/**
 * @fileoverview API communication layer for CarbonLens.
 * All backend calls are routed through this module.
 * AI/LLM calls NEVER happen from the browser — they go through the backend proxy (Security Rule 13).
 * Handles loading states, error messages, and rate limit (429) feedback.
 */

/**
 * Makes a fetch request to the backend API with error handling.
 * @param {string} endpoint - API endpoint path (e.g., '/calculate').
 * @param {Object} [options={}] - Fetch options override.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} On network failure, rate limit, or server error.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const token = storageGet('auth_token', null);
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      handleRateLimit(retryAfter);
      throw new Error('Too many requests. Please wait before trying again.');
    }

    if (response.status === 401) {
      storageSet('auth_token', null);
      throw new Error('Session expired. Please log in again.');
    }

    if (response.status === 403) {
      throw new Error('You do not have permission to perform this action.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Something went wrong. Please try again.');
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    throw error;
  }
}

/**
 * Sends carbon footprint data to the backend for calculation.
 * @param {Object} formData - Calculator form data.
 * @param {number} formData.carKm - Weekly car kilometres.
 * @param {number} formData.busKm - Weekly bus kilometres.
 * @param {number} formData.trainKm - Weekly train kilometres.
 * @param {number} formData.flightsShort - Annual short-haul flights.
 * @param {number} formData.flightsLong - Annual long-haul flights.
 * @param {number} formData.electricityKwh - Monthly electricity kWh.
 * @param {number} formData.gasKwh - Monthly natural gas kWh.
 * @param {number} formData.householdSize - Number of people in household.
 * @param {string} formData.dietType - Diet category.
 * @param {number} formData.mealsPerDay - Meals per day.
 * @param {number} formData.foodWaste - Food waste percentage.
 * @param {number} formData.clothingSpend - Monthly clothing spend (USD).
 * @param {number} formData.electronicsSpend - Monthly electronics spend (USD).
 * @param {number} formData.generalSpend - Monthly general goods spend (USD).
 * @returns {Promise<Object>} Calculation results with breakdown.
 */
async function calculateFootprint(formData) {
  return apiRequest('/calculate', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
}

/**
 * Requests AI-powered insights from the backend Groq proxy.
 * Never calls Groq directly from the browser (Security Rule 13).
 * @param {string} message - User's question or request.
 * @param {Object} [context={}] - User's footprint data for context.
 * @returns {Promise<Object>} AI response with insights.
 */
async function getAIInsights(message, context = {}) {
  return apiRequest('/insights', {
    method: 'POST',
    body: JSON.stringify({
      message: message,
      context: context,
    }),
  });
}

/**
 * Fetches curated carbon reduction tips from the backend.
 * @returns {Promise<Object>} Array of reduction tips.
 */
async function fetchTips() {
  return apiRequest('/tips', {
    method: 'GET',
  });
}

/**
 * Fetches benchmark comparison data.
 * @returns {Promise<Object>} Benchmark data object.
 */
async function fetchBenchmarks() {
  return apiRequest('/benchmarks', {
    method: 'GET',
  });
}

/**
 * Handles rate limit (429) responses by showing user feedback.
 * Never silently swallows rate limit errors (Security Rule 2).
 * @param {string} retryAfterSeconds - Seconds to wait before retrying.
 */
function handleRateLimit(retryAfterSeconds) {
  const seconds = parseInt(retryAfterSeconds, 10) || 60;
  const modal = document.getElementById('rate-limit-modal');
  const messageEl = document.getElementById('rate-modal-message');

  if (modal && messageEl) {
    messageEl.textContent = `You've made too many requests. Please wait ${seconds} seconds before trying again.`;
    modal.showModal();
  }

  announceToScreenReader(
    `Rate limit reached. Please wait ${seconds} seconds before trying again.`,
    'assertive'
  );
}

/**
 * Performs a client-side carbon calculation as a fallback.
 * Used when the backend is unavailable for graceful degradation.
 * @param {Object} data - Calculator form data.
 * @returns {Object} Calculation results with breakdown.
 */
function calculateFootprintOffline(data) {
  const transport = (
    (data.carKm || 0) * EMISSION_FACTORS.CAR_PER_KM * 52 +
    (data.busKm || 0) * EMISSION_FACTORS.BUS_PER_KM * 52 +
    (data.trainKm || 0) * EMISSION_FACTORS.TRAIN_PER_KM * 52 +
    (data.flightsShort || 0) * EMISSION_FACTORS.FLIGHT_DOMESTIC_PER_KM * 800 +
    (data.flightsLong || 0) * EMISSION_FACTORS.FLIGHT_INTERNATIONAL_PER_KM * 7000
  );

  const householdDivisor = Math.max(data.householdSize || 1, 1);
  const energy = (
    (data.electricityKwh || 0) * EMISSION_FACTORS.ELECTRICITY_PER_KWH * 12 +
    (data.gasKwh || 0) * EMISSION_FACTORS.NATURAL_GAS_PER_KWH * 12
  ) / householdDivisor;

  const dietFactors = {
    high_meat: EMISSION_FACTORS.MEAL_HIGH_MEAT,
    medium_meat: EMISSION_FACTORS.MEAL_MEDIUM_MEAT,
    low_meat: EMISSION_FACTORS.MEAL_LOW_MEAT,
    vegetarian: EMISSION_FACTORS.MEAL_VEGETARIAN,
    vegan: EMISSION_FACTORS.MEAL_VEGAN,
  };
  const mealFactor = dietFactors[data.dietType] || EMISSION_FACTORS.MEAL_MEDIUM_MEAT;
  const wasteMult = 1 + (data.foodWaste || 0) / 100;
  const food = mealFactor * (data.mealsPerDay || 3) * 365 * wasteMult;

  const lifestyle = (
    (data.clothingSpend || 0) * EMISSION_FACTORS.SHOPPING_CLOTHING_PER_USD * 12 +
    (data.electronicsSpend || 0) * EMISSION_FACTORS.SHOPPING_ELECTRONICS_PER_USD * 12 +
    (data.generalSpend || 0) * EMISSION_FACTORS.SHOPPING_GENERAL_PER_USD * 12
  );

  const totalKg = transport + energy + food + lifestyle;
  const totalTonnes = totalKg / 1000;

  return {
    totalKg: Math.round(totalKg * 10) / 10,
    totalTonnes: Math.round(totalTonnes * 100) / 100,
    breakdown: {
      transport: Math.round(transport * 10) / 10,
      energy: Math.round(energy * 10) / 10,
      food: Math.round(food * 10) / 10,
      lifestyle: Math.round(lifestyle * 10) / 10,
    },
    percentages: {
      transport: totalKg > 0 ? Math.round((transport / totalKg) * 100) : 0,
      energy: totalKg > 0 ? Math.round((energy / totalKg) * 100) : 0,
      food: totalKg > 0 ? Math.round((food / totalKg) * 100) : 0,
      lifestyle: totalKg > 0 ? Math.round((lifestyle / totalKg) * 100) : 0,
    },
  };
}
