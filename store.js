const jwt = require('jsonwebtoken');
const { canView, canWrite } = require('../data/roles');

const JWT_SECRET = process.env.JWT_SECRET || 'transitops-dev-secret-change-me';

/** Verifies the Bearer token and attaches { id, email, name, role } to req.user */
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Blocks the request unless the user's role may VIEW this module */
function requireView(module) {
  return (req, res, next) => {
    if (!canView(req.user.role, module)) {
      return res.status(403).json({ error: `Your role (${req.user.role}) cannot access "${module}"` });
    }
    next();
  };
}

/** Blocks the request unless the user's role may WRITE (create/update/delete) this module */
function requireWrite(module) {
  return (req, res, next) => {
    if (!canWrite(req.user.role, module)) {
      return res.status(403).json({ error: `Your role (${req.user.role}) does not have write access to "${module}"` });
    }
    next();
  };
}

module.exports = { authenticateToken, requireView, requireWrite, JWT_SECRET };
