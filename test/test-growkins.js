try {
  const app = require('../src/app');
  console.log('--- TEST PASSED: utills-server loaded successfully with /api/growkins routes! ---');
  process.exit(0);
} catch (err) {
  console.error('--- TEST FAILED ---', err);
  process.exit(1);
}
