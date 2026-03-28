import { jest } from '@jest/globals';

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({ data: { access_token: '123' } }),
    get: jest.fn().mockResolvedValue({ 
      data: { 
        '1234': { 
          ident: { 
            deviceName: 'Oven',
            type: { value_localized: 'Oven' },
            deviceIdentLabel: { techType: 'H 7860 BP' }
          }, 
          state: { status: { value_raw: 5 }, programPhase: { value_raw: 2 } }
        } 
      }
    })
  }
}));

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    readFile: jest.fn().mockResolvedValue(JSON.stringify({ access_token: '123', refresh_token: '456', obtained_at: Date.now(), expires_in: 3600 })),
    writeFile: jest.fn().mockResolvedValue()
  }
}));

describe('Miele API', () => {
  let miele;
  let axios;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    miele = await import('../src/miele.js');
    axios = (await import('axios')).default;
  });

  it('generates correct auth URL', () => {
    const url = miele.generateAuthUrl();
    expect(url).toContain('https://auth.domestic.miele-iot.com');
  });

  it('loads tokens properly', async () => {
    const tokens = await miele.loadTokens();
    expect(tokens.access_token).toBe('123');
  });

  it('exchanges code for token', async () => {
    const tokens = await miele.exchangeCodeForTokens('code123');
    expect(axios.post).toHaveBeenCalled();
    expect(tokens.access_token).toBe('123');
  });
  
  it('fetches devices and maps them correctly', async () => {
    await miele.loadTokens(); // Sets internal state
    const devices = await miele.fetchDevices();
    expect(axios.get).toHaveBeenCalled();
    expect(devices).toHaveLength(1);
    expect(devices[0].model_name).toBe('Oven H 7860 BP');
    expect(devices[0].status).toBe(5);
    expect(devices[0].programPhase).toBe(2);
  });
});
