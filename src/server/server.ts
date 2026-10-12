import * as dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Zupit Server running at http://localhost:${PORT}`);
  console.log(`   - Customer App:    http://localhost:${PORT}/`);
  console.log(`   - Admin Login:     http://localhost:${PORT}/admin/login`);
  console.log(`   - Admin Dashboard: http://localhost:${PORT}/admin/dashboard`);
  console.log(`   - Rider Login:     http://localhost:${PORT}/rider/login`);
  console.log(`   - Rider Dashboard: http://localhost:${PORT}/rider/dashboard`);
  console.log(`   - Public Config:   http://localhost:${PORT}/api/v1/public/config`);
  console.log(`======================================================\n`);
});
