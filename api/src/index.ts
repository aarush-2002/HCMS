import app from './app.js';
import { startDeadlineEngineCron } from './services/deadlineEngine.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[HCMS API] Server listening on http://localhost:${PORT}`);
  console.log(`[HCMS API] Health check available at http://localhost:${PORT}/api/health`);
  startDeadlineEngineCron();
});
