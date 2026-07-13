/**
 * Role-Based Access Control matrix.
 * `tabs` = modules a role can VIEW (GET).
 * `write` maps module -> roles allowed to CREATE/UPDATE/DELETE in it.
 */
const ROLES = {
  fleet_manager: { label: 'Fleet Manager', tabs: ['dashboard', 'vehicles', 'drivers', 'trips', 'maintenance', 'fuel', 'reports'] },
  driver: { label: 'Driver', tabs: ['dashboard', 'trips', 'vehicles', 'drivers'] },
  safety_officer: { label: 'Safety Officer', tabs: ['dashboard', 'drivers', 'trips'] },
  financial_analyst: { label: 'Financial Analyst', tabs: ['dashboard', 'fuel', 'reports'] },
};

const WRITE_ACCESS = {
  vehicles: ['fleet_manager'],
  drivers: ['fleet_manager', 'safety_officer'],
  trips: ['driver', 'fleet_manager'],
  maintenance: ['fleet_manager'],
  fuel: ['financial_analyst', 'fleet_manager', 'driver'],
  reports: [],
};

function canView(role, module) {
  return !!ROLES[role] && ROLES[role].tabs.includes(module);
}
function canWrite(role, module) {
  return (WRITE_ACCESS[module] || []).includes(role);
}

module.exports = { ROLES, WRITE_ACCESS, canView, canWrite };
