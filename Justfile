test:
    npm test

start:
    npm start

polish:
    npm run lint && npm run typecheck

build:
    npm run build 2>/dev/null || true

ci: polish test
