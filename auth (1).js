const express = require('express');
const { drivers, trips, nextId } = require('../data/store');
const { authenticateToken, requireView, requireWrite } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireView('drivers'));

// GET /api/drivers
router.get('/', (req, res) => {
  res.json(drivers);
});

// POST /api/drivers
router.post('/', requireWrite('drivers'), (req, res) => {
  const { name, licenseNo, licenseCategory, licenseExpiry, contact, safetyScore, status } = req.body || {};
  if (!name || !licenseNo || !licenseExpiry) {
    return res.status(400).json({ error: 'name, licenseNo and licenseExpiry are required' });
  }
  const driver = {
    id: nextId('DRV', 'drv'),
    name, licenseNo,
    licenseCategory: licenseCategory || 'LMV-TR',
    licenseExpiry,
    contact: contact || '',
    safetyScore: Number(safetyScore) || 0,
    status: status || 'Available',
  };
  drivers.push(driver);
  res.status(201).json(driver);
});

// PUT /api/drivers/:id
router.put('/:id', requireWrite('drivers'), (req, res) => {
  const driver = drivers.find((d) => d.id === req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  Object.assign(driver, req.body);
  res.json(driver);
});

// DELETE /api/drivers/:id
router.delete('/:id', requireWrite('drivers'), (req, res) => {
  const idx = drivers.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Driver not found' });

  const inUse = trips.some((t) => t.driverId === req.params.id && t.status === 'Dispatched');
  if (inUse) return res.status(409).json({ error: 'Cannot delete: driver is on an active trip' });

  drivers.splice(idx, 1);
  res.status(204).end();
});

module.exports = router;
