import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { config } from './config.js';
import { logger } from './logger.js';

let writeApi;

export const initInflux = () => {
  if (config.miele.dryRun) {
    logger.info('Dry run mode enabled. InfluxDB will not be updated.');
    return;
  }
  const influxDB = new InfluxDB({ url: config.influx.url, token: config.influx.token });
  writeApi = influxDB.getWriteApi(config.influx.org, config.influx.bucket, 'ns');
  logger.info('InfluxDB initialized');
};

export const pushDeviceData = (deviceData) => {
  if (config.miele.dryRun) {
    logger.info({ deviceData }, 'Dry Run [Device Data]');
    return;
  }
  
  if (!writeApi) {
    logger.error('Influx writing API not initialized');
    return;
  }
  
  try {
    const point = new Point('miele_appliances')
      .tag('appliance_id', deviceData.appliance_id)
      .tag('model_name', deviceData.model_name || 'unknown');

    if (deviceData.deviceType) point.stringField('deviceType', deviceData.deviceType);

    if (deviceData.status !== undefined) point.intField('status', deviceData.status);
    if (deviceData.status_localized) point.stringField('status_localized', deviceData.status_localized);
    
    if (deviceData.programType !== undefined) point.intField('programType', deviceData.programType);
    if (deviceData.programType_localized) point.stringField('programType_localized', deviceData.programType_localized);
    
    if (deviceData.programPhase !== undefined) point.intField('programPhase', deviceData.programPhase);
    if (deviceData.programPhase_localized) point.stringField('programPhase_localized', deviceData.programPhase_localized);
    
    // Time values are already in seconds, just check if it's a number
    if (typeof deviceData.remainingTime === 'number') {
       point.intField('remainingTime', deviceData.remainingTime);
    }
    if (typeof deviceData.elapsedTime === 'number') {
       point.intField('elapsedTime', deviceData.elapsedTime);
    }

    if (deviceData.ecoFeedback) {
       for (const [key, valObj] of Object.entries(deviceData.ecoFeedback)) {
           // ecoFeedback is often an object with structured data
           // but Miele docs usually represent ecoFeedback with value keys
           if (typeof valObj === 'object' && valObj !== null) {
              if (valObj.value !== undefined) point.floatField(`ecoFeedback_${key}`, Number(valObj.value));
              if (valObj.value_raw !== undefined) point.floatField(`ecoFeedback_${key}_raw`, Number(valObj.value_raw));
              if (valObj.value_localized !== undefined) point.stringField(`ecoFeedback_${key}_localized`, String(valObj.value_localized));
           } else if (typeof valObj === 'number') {
              point.floatField(`ecoFeedback_${key}`, valObj);
           } else if (typeof valObj === 'boolean') {
              point.booleanField(`ecoFeedback_${key}`, valObj);
           } else if (valObj !== undefined && valObj !== null) {
              point.stringField(`ecoFeedback_${key}`, String(valObj));
           }
       }
    }

    if (deviceData.fillingLevels) {
       for (const [key, valObj] of Object.entries(deviceData.fillingLevels)) {
           if (typeof valObj === 'object' && valObj !== null) {
              if (valObj.value_raw !== undefined) point.floatField(`fillingLevel_${key}_raw`, Number(valObj.value_raw));
              if (valObj.value_localized !== undefined) point.stringField(`fillingLevel_${key}_localized`, String(valObj.value_localized));
           } else if (typeof valObj === 'number') {
              point.floatField(`fillingLevel_${key}`, valObj);
           } else if (typeof valObj === 'boolean') {
              point.booleanField(`fillingLevel_${key}`, valObj);
           } else if (valObj !== null && valObj !== undefined) {
              point.stringField(`fillingLevel_${key}`, String(valObj));
           }
       }
    }

    writeApi.writePoint(point);
    writeApi.flush();
    logger.debug({ appliance_id: deviceData.appliance_id }, 'Data pushed to InfluxDB');
  } catch (error) {
    logger.error({ err: error }, 'Failed to push device data to InfluxDB');
    pushErrorData('pushDeviceData', error.message);
  }
};

export const pushErrorData = (context, errorMessage) => {
  if (config.miele.dryRun) {
    logger.error({ errorContext: context, errorMessage }, 'Dry Run [Error Data]');
    return;
  }
  
  if (!writeApi) {
    return;
  }
  
  try {
    const point = new Point('miele_errors')
      .tag('context', context)
      .stringField('message', errorMessage);
    writeApi.writePoint(point);
    writeApi.flush();
  } catch (err) {
    logger.error({ err }, 'Failed to log error to InfluxDB');
  }
};

export const pingInflux = async () => {
    if (config.miele.dryRun) return true;
    try {
        const influxDB = new InfluxDB({ url: config.influx.url, token: config.influx.token });
        const pingApi = influxDB.getPingApi();
        await pingApi.getPing();
        return true;
    } catch (err) {
        return false;
    }
};
