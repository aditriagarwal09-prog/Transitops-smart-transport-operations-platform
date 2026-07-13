const express = require('express');
const { fuelLogs, expenses, vehicles, nextId } = require('../data/store');
const { authenticateToken, requireView, requireWrite } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireView('fuel'));

// GET /api/fuel
router.get('/', (req, res) => {
  res.json(fuelLogs);
});

// POST /api/fuel
router.post('/', requireWrite('fuel'), (req, res) => {
  const { vehicleId, liters, cost, date } = req.body || {};
  if (!vehicleId || !liters || !cost) return res.status(400).json({ error: 'vehicleId, liters and cost are required' });
  if (!vehicles.find((v) => v.id === vehicleId)) return res.status(404).json({ error: 'Vehicle not found' });

  const log = {
    id: nextId('FUE', 'fue'),
    vehicleId, liters: Number(liters), cost: Number(cost),
    date: date || new Date().toISOString().slice(0, 10),
  };
  fuelLogs.push(log);
  res.status(201).json(log);
});

// GET /api/fuel/expenses
router.get('/expenses', (req, res) => {
  res.json(expenses);
});

// POST /api/fuel/expenses
router.post('/expenses', requireWrite('fuel'), (req, res) => {
  const { vehicleId, type, amount, date, note } = req.body || {};
  if (!vehicleId || !amount) return res.status(400).json({ error: 'vehicleId and amount are required' });
  if (!vehicles.find((v) => v.id === vehicleId)) return res.status(404).json({ error: 'Vehicle not found' });

  const expense = {
    id: nextId('EXP', 'exp'),
    vehicleId, type: type || 'Other', amount: Number(amount),
    date: date || new Date().toISOString().slice(0, 10),
    note: note || '',
  };
  expenses.push(expense);
  res.status(201).json(expense);
});

module.exports = router;
