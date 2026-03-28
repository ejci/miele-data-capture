import dotenv from 'dotenv';
dotenv.config();

export const config = {
  miele: {
    clientId: process.env.MIELE_CLIENT_ID,
    clientSecret: process.env.MIELE_CLIENT_SECRET,
    pollInterval: parseInt(process.env.MIELE_POLL_INTERVAL || '60', 10),
    port: parseInt(process.env.MIELE_PORT || '3000', 10),
    dryRun: process.env.MIELE_DRYRUN === 'true',
  },
  influx: {
    url: process.env.MIELE_INFLUX_URL,
    token: process.env.MIELE_INFLUX_TOKEN,
    org: process.env.MIELE_INFLUX_ORG,
    bucket: process.env.MIELE_INFLUX_BUCKET,
  }
};

export const validateConfig = () => {
  const required = [
    'MIELE_CLIENT_ID',
    'MIELE_CLIENT_SECRET',
    'MIELE_INFLUX_URL',
    'MIELE_INFLUX_TOKEN',
    'MIELE_INFLUX_ORG',
    'MIELE_INFLUX_BUCKET'
  ];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
