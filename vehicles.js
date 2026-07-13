const express = require('express');
const { maintenance, vehicles, nextId } = require('../data/store');
const { authenticateToken, requireView, requireWrite } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireView('maintenance'));

// GET /api/maintenance
router.get('/', (req, res) => {
  res.json(maintenance);
});

// POST /api/maintenance -> creates Active record, forces vehicle to "In Shop"
router.post('/', requireWrite('maintenance'), (req, res) => {
  const { vehicleId, type, description, cost } = req.body || {};
  if (!vehicleId || !type) return res.status(400).json({ error: 'vehicleId and type are required' });

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  if (vehicle.status === 'Retired') return res.status(422).json({ error: 'Cannot service a retired vehicle' });

  const record = {
    id: nextId('MNT', 'mnt'),
    vehicleId, type,
    description: description || '',
    cost: Number(cost) || 0,
    status: 'Active',
    date: new Date().toISOString().slice(0, 10),
  };
  maintenance.push(record);
  vehicle.status = 'In Shop';
  res.status(201).json({ record, vehicle });
});

// POST /api/maintenance/:id/close -> restores vehicle to Available (unless Retired)
router.post('/:id/close', requireWrite('maintenance'), (req, res) => {
  const record = maintenance.find((m) => m.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Maintenance record not found' });
  if (record.status === 'Closed') return res.status(409).json({ error: 'Record is already closed' });

  record.status = 'Closed';
  const vehicle = vehicles.find((v) => v.id === record.vehicleId);
  if (vehicle && vehicle.status !== 'Retired') vehicle.status = 'Available';

  res.json({ record, vehicle });
});

module.exports = router;
