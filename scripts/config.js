/**
 * @fileoverview Application configuration — public values only.
 * No secrets, API keys, or credentials belong in this file.
 * All sensitive values live in server-side .env (Security Rule 1).
 */

/** Base URL for the backend API — update for production deployment */
const API_BASE_URL = 'https://carbonlens-pglc.onrender.com/api';

/**
 * Emission factors in kg CO2e per unit.
 * Sources: EPA, DEFRA, IPCC AR6
 */
const EMISSION_FACTORS = {
  /** kg CO2e per km driven (average gasoline car) */
  CAR_PER_KM: 0.21,
  /** kg CO2e per km (public bus) */
  BUS_PER_KM: 0.089,
  /** kg CO2e per km (train/metro) */
  TRAIN_PER_KM: 0.041,
  /** kg CO2e per km (domestic flight) */
  FLIGHT_DOMESTIC_PER_KM: 0.255,
  /** kg CO2e per km (international flight) */
  FLIGHT_INTERNATIONAL_PER_KM: 0.195,
  /** kg CO2e per kWh (global average grid) */
  ELECTRICITY_PER_KWH: 0.475,
  /** kg CO2e per kWh (natural gas) */
  NATURAL_GAS_PER_KWH: 0.185,
  /** kg CO2e per meal (meat-heavy diet) */
  MEAL_HIGH_MEAT: 3.3,
  /** kg CO2e per meal (average omnivore) */
  MEAL_MEDIUM_MEAT: 2.5,
  /** kg CO2e per meal (low meat / pescatarian) */
  MEAL_LOW_MEAT: 1.7,
  /** kg CO2e per meal (vegetarian) */
  MEAL_VEGETARIAN: 1.0,
  /** kg CO2e per meal (vegan) */
  MEAL_VEGAN: 0.7,
  /** kg CO2e per USD spent on clothing */
  SHOPPING_CLOTHING_PER_USD: 0.02,
  /** kg CO2e per USD spent on electronics */
  SHOPPING_ELECTRONICS_PER_USD: 0.015,
  /** kg CO2e per USD spent on general goods */
  SHOPPING_GENERAL_PER_USD: 0.01,
};

/**
 * Global and national benchmark averages (tonnes CO2e per year per capita).
 * Source: Global Carbon Atlas, World Bank
 */
const BENCHMARKS = {
  GLOBAL_AVERAGE: 4.7,
  US_AVERAGE: 15.5,
  EU_AVERAGE: 6.8,
  INDIA_AVERAGE: 1.9,
  CHINA_AVERAGE: 7.4,
  PARIS_TARGET: 2.0,
};

/**
 * Application feature flags.
 */
const FEATURES = {
  ENABLE_AI_INSIGHTS: true,
  ENABLE_AUTH: true,
  ENABLE_CHARTS: true,
  ENABLE_ACTION_TRACKER: true,
};

/**
 * Maximum values for input validation (client-side UX only).
 * Server-side validation is authoritative (Security Rule 3).
 */
const INPUT_LIMITS = {
  MAX_KM_PER_WEEK: 10000,
  MAX_KWH_PER_MONTH: 50000,
  MAX_MEALS_PER_DAY: 10,
  MAX_SPENDING_PER_MONTH: 100000,
  MAX_MESSAGE_LENGTH: 1000,
};
