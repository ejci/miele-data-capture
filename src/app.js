import express from 'express';
import { validateConfig, config } from './config.js';
import { logger } from './logger.js';
import { initInflux, pushDeviceData, pushErrorData } from './influx.js';
import { generateAuthUrl, loadTokens, exchangeCodeForTokens, fetchDevices, getAuthStatus } from './miele.js';

const app = express();
let lastPolled = null;
let lastData = [];

// Initialize
validateConfig();
initInflux();
loadTokens().then(tokens => {
  if (tokens) {
    logger.info('Found existing tokens, starting polling loop...');
    startPollingLoop();
  }
});

const startPollingLoop = () => {
  // Clear any existing interval just in case
  if (global.pollingInterval) {
    clearInterval(global.pollingInterval);
  }

  const pollIntervalMs = config.miele.pollInterval * 1000;

  const poll = async () => {
    try {
      logger.info('Polling Miele API...');
      const devices = await fetchDevices();
      lastData = devices;
      lastPolled = new Date().toISOString();

      devices.forEach(device => {
        pushDeviceData(device);
      });
      logger.info(`Successfully polled and pushed data for ${devices.length} devices.`);
    } catch (error) {
      logger.error('Error during polling loop:', error.message);
      pushErrorData('pollingLoop', error.message);
    }
  };

  // Initial poll immediately
  poll();
  // Set up interval
  global.pollingInterval = setInterval(poll, pollIntervalMs);
};

// Serve static files from public directory
app.use(express.static('public'));

app.get('/health', (req, res) => {
  const authStatus = getAuthStatus();
  
  res.json({
    authenticated: authStatus.authenticated,
    lastPolled: lastPolled,
    lastData: lastData,
    pollInterval: config.miele.pollInterval
  });
});

app.get('/auth', (req, res) => {
  const authUrl = generateAuthUrl();
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No authorization code provided.');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    logger.info('Successfully exchanged code for tokens via web callback.');
    startPollingLoop(); // Start polling since we now have auth
    res.redirect('/');
  } catch (error) {
    logger.error('Callback error:', error.message);
    res.status(500).send(`Failed to authenticate: ${error.message}`);
  }
});

app.listen(config.miele.port, () => {
  logger.info(`Server running on port ${config.miele.port}`);
  if (config.miele.dryRun) {
    logger.warn('*** DRY RUN MODE ENABLED. Data will not be pushed to InfluxDB. ***');
  }
});
