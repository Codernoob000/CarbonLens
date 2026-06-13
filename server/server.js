/**
 * @fileoverview CarbonLens Express Backend Server.
 * Security-first architecture implementing all 13 Taha Jaffri Security Rules.
 *
 * Rule 1:  All secrets from process.env only
 * Rule 2:  Rate limiting on all endpoints
 * Rule 3:  Zod validation on all POST bodies
 * Rule 6:  CORS locked to ALLOWED_ORIGIN
 * Rule 7:  Helmet security headers
 * Rule 9:  Generic error responses, detailed server-side logging
 * Rule 13: Groq API proxy — never exposed to browser
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const Groq = require('groq-sdk');

/* ============================================
   CONFIGURATION (Rule 1 — secrets from env only)
   ============================================ */
require('dotenv').config();

const PORT = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();

/* ============================================
   SECURITY MIDDLEWARE
   ============================================ */

/**
 * Rule 7 — HTTP Security Headers via Helmet.
 * CSP, X-Frame-Options: DENY, HSTS, nosniff, referrer-policy.
 * X-Powered-By automatically removed by Helmet.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.gstatic.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://www.gstatic.com', "'unsafe-inline'"],
      fontSrc: ['https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      frameSrc: ["'none'"],
    },
  },
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
if (process.env.ALLOWED_ORIGIN) {
  // Support comma-separated values for multiple production origins
  const origins = process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim());
  origins.forEach(o => {
    if (o && !allowedOrigins.includes(o)) {
      allowedOrigins.push(o);
    }
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Dynamically allow Vercel preview/deployment URLs for this project
    const isVercelOrigin = origin.startsWith('https://carbon-lens') && origin.endsWith('.vercel.app');
    if (isVercelOrigin) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));

/**
 * Rule 2 — Rate Limiting per endpoint type.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached. Please wait before asking again.' },
});

/* ============================================
   EMISSION FACTORS (Constants)
   ============================================ */
const EMISSION_FACTORS = {
  CAR_PER_KM: 0.21,
  BUS_PER_KM: 0.089,
  TRAIN_PER_KM: 0.041,
  FLIGHT_DOMESTIC_PER_KM: 0.255,
  FLIGHT_INTERNATIONAL_PER_KM: 0.195,
  ELECTRICITY_PER_KWH: 0.475,
  NATURAL_GAS_PER_KWH: 0.185,
  MEAL_HIGH_MEAT: 3.3,
  MEAL_MEDIUM_MEAT: 2.5,
  MEAL_LOW_MEAT: 1.7,
  MEAL_VEGETARIAN: 1.0,
  MEAL_VEGAN: 0.7,
  SHOPPING_CLOTHING_PER_USD: 0.02,
  SHOPPING_ELECTRONICS_PER_USD: 0.015,
  SHOPPING_GENERAL_PER_USD: 0.01,
};

const BENCHMARKS = {
  GLOBAL_AVERAGE: 4.7,
  US_AVERAGE: 15.5,
  EU_AVERAGE: 6.8,
  INDIA_AVERAGE: 1.9,
  CHINA_AVERAGE: 7.4,
  PARIS_TARGET: 2.0,
};

/* ============================================
   ZOD SCHEMAS (Rule 3 — Input Validation)
   ============================================ */

/**
 * Validation schema for carbon calculation requests.
 * Validates type, range, and required fields.
 */
const calculationSchema = z.object({
  carKm: z.number().min(0).max(10000).default(0),
  busKm: z.number().min(0).max(10000).default(0),
  trainKm: z.number().min(0).max(10000).default(0),
  flightsShort: z.number().int().min(0).max(200).default(0),
  flightsLong: z.number().int().min(0).max(100).default(0),
  electricityKwh: z.number().min(0).max(50000).default(0),
  gasKwh: z.number().min(0).max(50000).default(0),
  householdSize: z.number().int().min(1).max(20).default(1),
  dietType: z.enum(['high_meat', 'medium_meat', 'low_meat', 'vegetarian', 'vegan']).default('medium_meat'),
  mealsPerDay: z.number().int().min(1).max(10).default(3),
  foodWaste: z.number().min(0).max(100).default(15),
  clothingSpend: z.number().min(0).max(100000).default(0),
  electronicsSpend: z.number().min(0).max(100000).default(0),
  generalSpend: z.number().min(0).max(100000).default(0),
});

/**
 * Validation schema for AI insight requests.
 */
const insightSchema = z.object({
  message: z.string().min(1).max(1000).trim(),
  context: z.object({
    totalKg: z.number().optional(),
    totalTonnes: z.number().optional(),
    breakdown: z.object({
      transport: z.number().optional(),
      energy: z.number().optional(),
      food: z.number().optional(),
      lifestyle: z.number().optional(),
    }).optional(),
  }).optional().default({}),
});

/* ============================================
   GROQ CLIENT (Rule 13 — Server-side only)
   ============================================ */

/** @type {Object} Per-session token usage tracking (Rule 13) */
const tokenUsage = {};

/** Maximum tokens per user per day (Rule 13 — token budget) */
const MAX_TOKENS_PER_USER_PER_DAY = 50000;

/**
 * Creates a Groq client instance.
 * API key is from process.env only — never in frontend (Rule 13).
 * @returns {Object|null} Groq client or null if not configured.
 */
function createGroqClient() {
  if (!GROQ_API_KEY) {
    return null;
  }
  return new Groq({ apiKey: GROQ_API_KEY });
}

/**
 * Sanitizes user input before sending to LLM (Rule 13 — prompt injection prevention).
 * @param {string} input - Raw user input.
 * @returns {string} Sanitized input.
 */
function sanitizeLLMInput(input) {
  return input
    .replace(/[<>"']/g, '')
    .replace(/\b(ignore|forget|disregard|override|system|prompt)\b/gi, '[filtered]')
    .substring(0, 1000)
    .trim();
}

/**
 * Checks and updates token budget for a user session (Rule 13).
 * @param {string} sessionId - User session identifier.
 * @param {number} tokensUsed - Tokens consumed in this request.
 * @returns {boolean} True if within budget.
 */
function checkTokenBudget(sessionId, tokensUsed) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${sessionId}_${today}`;

  if (!tokenUsage[key]) {
    tokenUsage[key] = 0;
  }

  tokenUsage[key] += tokensUsed;

  return tokenUsage[key] <= MAX_TOKENS_PER_USER_PER_DAY;
}

/* ============================================
   SERVER-SIDE LOGGING (Rule 9)
   ============================================ */

/**
 * Logs a server-side event with context.
 * Never exposes these details to the client.
 * @param {string} level - 'info', 'warn', or 'error'.
 * @param {string} message - Log message.
 * @param {Object} [context={}] - Additional context.
 */
function serverLog(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    ...context,
  };

  if (NODE_ENV !== 'test') {
    if (level === 'error') {
      process.stderr.write(JSON.stringify(entry) + '\n');
    } else {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  }
}

/* ============================================
   API ROUTES
   ============================================ */

/**
 * POST /api/calculate — Carbon footprint calculation.
 * Rate limited, input validated with Zod (Rules 2, 3).
 */
app.post('/api/calculate', apiLimiter, (req, res) => {
  try {
    const result = calculationSchema.safeParse(req.body);
    if (!result.success) {
      serverLog('warn', 'Validation failed on /api/calculate', {
        route: '/api/calculate',
        errors: result.error.errors,
      });
      return res.status(400).json({
        error: 'Invalid input. Please check your values and try again.',
      });
    }

    const data = result.data;
    const calculation = performCalculation(data);

    serverLog('info', 'Calculation completed', {
      route: '/api/calculate',
      totalTonnes: calculation.totalTonnes,
    });

    return res.json(calculation);
  } catch (error) {
    serverLog('error', 'Calculation error', {
      route: '/api/calculate',
      error: error.message,
    });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/insights — AI-powered insights via Groq proxy.
 * All LLM calls happen here — NEVER from the browser (Rule 13).
 * Rate limited to 10/min, input sanitized, max_tokens set, token budget enforced.
 */
app.post('/api/insights', llmLimiter, async (req, res) => {
  try {
    const result = insightSchema.safeParse(req.body);
    if (!result.success) {
      serverLog('warn', 'Validation failed on /api/insights', {
        route: '/api/insights',
        errors: result.error.errors,
      });
      return res.status(400).json({
        error: 'Invalid message. Please keep it under 1000 characters.',
      });
    }

    const groq = createGroqClient();
    if (!groq) {
      serverLog('warn', 'Groq API key not configured', { route: '/api/insights' });
      return res.json({
        reply: getFallbackInsight(result.data.context),
      });
    }

    const sessionId = req.ip || 'anonymous';
    const sanitizedMessage = sanitizeLLMInput(result.data.message);

    const contextStr = result.data.context?.totalTonnes
      ? `The user's annual carbon footprint is ${result.data.context.totalTonnes} tonnes CO₂e. Breakdown — Transport: ${result.data.context.breakdown?.transport || 0} kg, Energy: ${result.data.context.breakdown?.energy || 0} kg, Food: ${result.data.context.breakdown?.food || 0} kg, Lifestyle: ${result.data.context.breakdown?.lifestyle || 0} kg.`
      : 'The user has not calculated their footprint yet.';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an expert sustainability coach. Provide practical, evidence-based advice to reduce carbon footprint. Be concise (under 200 words). ${contextStr}`,
        },
        {
          role: 'user',
          content: sanitizedMessage,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content || 'No insights available.';
    const tokensUsed = completion.usage?.total_tokens || 0;

    serverLog('info', 'Groq API call completed', {
      route: '/api/insights',
      tokensUsed: tokensUsed,
      sessionId: sessionId,
    });

    const withinBudget = checkTokenBudget(sessionId, tokensUsed);
    if (!withinBudget) {
      serverLog('warn', 'Token budget exceeded', { sessionId: sessionId });
      return res.json({
        reply: 'You have reached the daily AI usage limit. Please try again tomorrow.',
      });
    }

    return res.json({ reply: reply });
  } catch (error) {
    serverLog('error', 'Insights error', {
      route: '/api/insights',
      error: error.message,
    });

    if (error.status === 429) {
      return res.status(429).json({
        error: 'AI service is busy. Please wait a moment.',
      });
    }

    return res.status(500).json({
      error: 'Something went wrong. Please try again.',
    });
  }
});

/**
 * GET /api/tips — Curated carbon reduction tips.
 */
app.get('/api/tips', apiLimiter, (req, res) => {
  try {
    return res.json({
      tips: [
        { id: 1, title: 'Walk Short Distances', impact: 150, unit: 'kg CO₂/year', description: 'Replace car trips under 2km with walking.' },
        { id: 2, title: 'One Meatless Day per Week', impact: 200, unit: 'kg CO₂/year', description: 'Reduce food emissions by ~14%.' },
        { id: 3, title: 'Adjust Thermostat by 1°C', impact: 300, unit: 'kg CO₂/year', description: 'Lower heating saves significant energy.' },
        { id: 4, title: 'Fly One Less Round Trip', impact: 1600, unit: 'kg CO₂/year', description: 'Aviation is a major emission source.' },
        { id: 5, title: 'Cold Water Laundry', impact: 100, unit: 'kg CO₂/year', description: 'Wash at 30°C instead of 60°C.' },
        { id: 6, title: 'Switch to LED Bulbs', impact: 50, unit: 'kg CO₂/year', description: '75% less energy than incandescent.' },
      ],
    });
  } catch (error) {
    serverLog('error', 'Tips fetch error', { route: '/api/tips', error: error.message });
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

/**
 * GET /api/benchmarks — Global emission benchmarks.
 */
app.get('/api/benchmarks', apiLimiter, (req, res) => {
  try {
    return res.json({ benchmarks: BENCHMARKS });
  } catch (error) {
    serverLog('error', 'Benchmarks fetch error', { route: '/api/benchmarks', error: error.message });
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ============================================
   CALCULATION ENGINE
   ============================================ */

/**
 * Performs the carbon footprint calculation server-side.
 * @param {Object} data - Validated input data.
 * @returns {Object} Calculation results with breakdown.
 */
function performCalculation(data) {
  const transport = (
    data.carKm * EMISSION_FACTORS.CAR_PER_KM * 52 +
    data.busKm * EMISSION_FACTORS.BUS_PER_KM * 52 +
    data.trainKm * EMISSION_FACTORS.TRAIN_PER_KM * 52 +
    data.flightsShort * EMISSION_FACTORS.FLIGHT_DOMESTIC_PER_KM * 800 +
    data.flightsLong * EMISSION_FACTORS.FLIGHT_INTERNATIONAL_PER_KM * 7000
  );

  const householdDivisor = Math.max(data.householdSize, 1);
  const energy = (
    data.electricityKwh * EMISSION_FACTORS.ELECTRICITY_PER_KWH * 12 +
    data.gasKwh * EMISSION_FACTORS.NATURAL_GAS_PER_KWH * 12
  ) / householdDivisor;

  const dietFactors = {
    high_meat: EMISSION_FACTORS.MEAL_HIGH_MEAT,
    medium_meat: EMISSION_FACTORS.MEAL_MEDIUM_MEAT,
    low_meat: EMISSION_FACTORS.MEAL_LOW_MEAT,
    vegetarian: EMISSION_FACTORS.MEAL_VEGETARIAN,
    vegan: EMISSION_FACTORS.MEAL_VEGAN,
  };
  const mealFactor = dietFactors[data.dietType] || EMISSION_FACTORS.MEAL_MEDIUM_MEAT;
  const wasteMult = 1 + data.foodWaste / 100;
  const food = mealFactor * data.mealsPerDay * 365 * wasteMult;

  const lifestyle = (
    data.clothingSpend * EMISSION_FACTORS.SHOPPING_CLOTHING_PER_USD * 12 +
    data.electronicsSpend * EMISSION_FACTORS.SHOPPING_ELECTRONICS_PER_USD * 12 +
    data.generalSpend * EMISSION_FACTORS.SHOPPING_GENERAL_PER_USD * 12
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

/**
 * Returns a fallback insight when Groq is not configured.
 * @param {Object} context - User's footprint context.
 * @returns {string} Fallback recommendation text.
 */
function getFallbackInsight(context) {
  if (!context || !context.totalTonnes) {
    return 'Calculate your carbon footprint first, then I can give you personalized recommendations. In the meantime, consider reducing car trips, eating less meat, and switching to renewable energy.';
  }

  const tonnes = context.totalTonnes;
  if (tonnes > 10) {
    return `At ${tonnes} tonnes/year, your footprint is above average. Focus on your highest-emission category first. Reducing flights by one round-trip can save 1.6 tonnes. Switching to public transit saves ~2.4 tonnes/year.`;
  }
  if (tonnes > 4.7) {
    return `At ${tonnes} tonnes/year, you're near the global average. To reach the Paris target of 2 tonnes, focus on diet changes and energy efficiency. One meatless day/week saves ~200 kg CO₂/year.`;
  }
  return `At ${tonnes} tonnes/year, you're below the global average — great work! To go further, consider renewable energy for your home and offsetting remaining emissions through verified carbon credits.`;
}

/* ============================================
   SERVER STARTUP
   ============================================ */

if (NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    serverLog('info', `CarbonLens server running on port ${PORT}`, {
      environment: NODE_ENV,
      corsOrigin: ALLOWED_ORIGIN,
    });
  });
}

module.exports = { app, performCalculation, sanitizeLLMInput, checkTokenBudget };
