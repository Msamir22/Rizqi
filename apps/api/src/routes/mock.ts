/**
 * Mock API Routes
 * GET /api/mock/rates - Return static mock data for development
 */

import express from 'express';

const router = express.Router();

// GET /api/mock/rates - Mock data
router.get('/rates', (req, res) => {
  const mockData = {
    status: 'success',
    currency: 'USD',
    unit: 'toz',
    metals: {
      gold: 2045.75,
      silver: 24.32,
      platinum: 895.5,
      palladium: 1025.3,
    },
    currencies: {
      EGP: 30.85, // 1 USD = 30.85 EGP
      EUR: 1.0895,
      GBP: 1.2696,
      SAR: 3.75,
      AED: 3.67,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(mockData);
});

export default router;
