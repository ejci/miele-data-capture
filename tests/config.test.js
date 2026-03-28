import { jest } from '@jest/globals';

jest.unstable_mockModule('dotenv', () => ({
  default: { config: jest.fn() }
}));

describe('Config', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('loads default config when env is partially empty', async () => {
    process.env.MIELE_DRYRUN = 'true';
    const { config } = await import('../src/config.js');
    expect(config.miele.dryRun).toBe(true);
    expect(config.miele.pollInterval).toBe(60); // default
  });

  it('validates config successfully with all required vars', async () => {
    process.env.MIELE_CLIENT_ID = 'test';
    process.env.MIELE_CLIENT_SECRET = 'test';
    process.env.MIELE_INFLUX_URL = 'http://localhost';
    process.env.MIELE_INFLUX_TOKEN = 'token';
    process.env.MIELE_INFLUX_ORG = 'org';
    process.env.MIELE_INFLUX_BUCKET = 'bucket';
    
    const { validateConfig } = await import('../src/config.js');
    expect(() => validateConfig()).not.toThrow();
  });

  it('throws error when required vars are missing', async () => {
    delete process.env.MIELE_CLIENT_ID;
    delete process.env.MIELE_CLIENT_SECRET;
    const { validateConfig } = await import('../src/config.js');
    expect(() => validateConfig()).toThrow(/Missing required environment variables/);
  });
});
