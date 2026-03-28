import { jest } from '@jest/globals';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

// We have to mock dependencies manually since we use ESM
jest.unstable_mockModule('@influxdata/influxdb-client', () => {
  const writePoint = jest.fn();
  const flush = jest.fn();
  const getWriteApi = jest.fn(() => ({ writePoint, flush }));
  return {
    InfluxDB: jest.fn().mockImplementation(() => ({ getWriteApi })),
    Point: class MockPoint {
      constructor(measurement) {
        this.measurement = measurement;
        this.tags = {};
        this.fields = {};
      }
      tag(k, v) { this.tags[k] = v; return this; }
      intField(k, v) { this.fields[k] = v; return this; }
      floatField(k, v) { this.fields[k] = v; return this; }
      stringField(k, v) { this.fields[k] = v; return this; }
      booleanField(k, v) { this.fields[k] = v; return this; }
    }
  };
});

jest.unstable_mockModule('../src/config.js', () => ({
  config: {
    miele: { dryRun: false },
    influx: { url: 'http://test', token: 'token', org: 'org', bucket: 'bucket' }
  }
}));

describe('Influx', () => {
  let influx;
  let influxClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    influx = await import('../src/influx.js');
    influxClient = await import('@influxdata/influxdb-client');
  });

  it('initializes and pushes correct device data', () => {
    influx.initInflux();
    const testData = {
      appliance_id: '1234',
      model_name: 'Washing Machine',
      status: 5,
      programId: 1,
      programPhase: 2,
      remainingTime: 120, // testing pure number logic
      elapsedTime: 90, // array transformation now handled prior to influx.js
      fillingLevels: {
        detergent: 80,
        doorOpen: false,
        stateStr: 'running'
      }
    };
    
    influx.pushDeviceData(testData);

    const mockedInfluxDB = new influxClient.InfluxDB();
    const writeApi = mockedInfluxDB.getWriteApi();
    
    expect(writeApi.writePoint).toHaveBeenCalledTimes(1);
    const pointArg = writeApi.writePoint.mock.calls[0][0];
    
    expect(pointArg.measurement).toBe('miele_appliances');
    expect(pointArg.tags.appliance_id).toBe('1234');
    expect(pointArg.tags.model_name).toBe('Washing Machine');
    expect(pointArg.fields.status).toBe(5);
    expect(pointArg.fields.remainingTime).toBe(120);
    expect(pointArg.fields.elapsedTime).toBe(90); // 1h 30m = 90
    expect(pointArg.fields.fillingLevel_detergent).toBe(80);
    expect(pointArg.fields.fillingLevel_doorOpen).toBe(false);
  });
});
