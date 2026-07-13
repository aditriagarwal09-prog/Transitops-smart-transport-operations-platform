# Copy this file to .env before running the server

# Port the API server listens on
PORT=4000

# Secret used to sign JWT auth tokens - change this in production
JWT_SECRET=transitops-dev-secret-change-me

# Token lifetime (e.g. 12h, 7d)
JWT_EXPIRES_IN=12h

# Allowed origin for CORS (the URL your frontend is served from)
CORS_ORIGIN=*
