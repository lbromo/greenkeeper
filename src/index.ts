import { config } from 'dotenv';
import { startOrchestrator } from './orchestrator.js';

// Load .env variables
config();

console.log('🌱 Starting Greenkeeper Daemon...');
startOrchestrator().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
