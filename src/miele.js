import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from './config.js';
import { logger } from './logger.js';

const TOKEN_FILE_PATH = path.resolve(process.cwd(), 'token.json');

const OAUTH_AUTH_URL = 'https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/auth';
const OAUTH_TOKEN_URL = 'https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/token';
const API_BASE_URL = 'https://api.mcs3.miele.com/v1';

let currentTokens = null;

export const generateAuthUrl = () => {
  const redirectUri = `http://localhost:${config.miele.port}/callback`;
  const params = new URLSearchParams({
    client_id: config.miele.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: 'miele-auth-state', // In a real prod app, use secure random value
    vg: 'de-DE', // Optional: default locale
    scope: 'openid mcs_thirdparty_read'
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
};

export const loadTokens = async () => {
  try {
    const data = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
    currentTokens = JSON.parse(data);
    logger.info('Tokens loaded from token.json');
    return currentTokens;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('No token.json found. User needs to authenticate via web interface.');
    } else {
      logger.error({ err: error }, 'Error reading token.json');
    }
    return null;
  }
};

export const saveTokens = async (tokens) => {
  try {
    // Add custom timestamp for our own tracking
    const tokenData = {
      ...tokens,
      obtained_at: Date.now(),
    };
    await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokenData, null, 2), 'utf-8');
    currentTokens = tokenData;
    logger.info('Tokens saved successfully to token.json');
  } catch (error) {
    logger.error({ err: error }, 'Failed to save tokens to token.json');
  }
};

export const exchangeCodeForTokens = async (code) => {
  const redirectUri = `http://localhost:${config.miele.port}/callback`;
  const params = new URLSearchParams({
    client_id: config.miele.clientId,
    client_secret: config.miele.clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  try {
    const response = await axios.post(OAUTH_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    await saveTokens(response.data);
    return response.data;
  } catch (error) {
    logger.error({ err: error, responseData: error.response?.data }, 'Failed to exchange code for tokens');
    throw error;
  }
};

export const refreshTokens = async () => {
  if (!currentTokens || !currentTokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  const params = new URLSearchParams({
    client_id: config.miele.clientId,
    client_secret: config.miele.clientSecret,
    refresh_token: currentTokens.refresh_token,
    grant_type: 'refresh_token'
  });

  try {
    const response = await axios.post(OAUTH_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    await saveTokens(response.data);
    logger.info('Token refreshed successfully');
    return response.data;
  } catch (error) {
    logger.error({ err: error, responseData: error.response?.data }, 'Failed to refresh tokens');
    throw error;
  }
};

const makeAuthenticatedRequest = async (url) => {
  if (!currentTokens || !currentTokens.access_token) {
    throw new Error('Not authenticated. Please login first.');
  }
  logger.debug({ url }, 'Making authenticated request');
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${currentTokens.access_token}`,
        'Accept': 'application/json'
      }
    });
    logger.debug({ fetchResult: 'Success', status: response.status }, 'API Response received');
    return response.data;
  } catch (error) {
    logger.error({ err: error, url }, 'API Request failed');
    if (error.response && error.response.status === 401) {
      logger.info('Access token expired, attempting refresh...');
      await refreshTokens();
      // Retry with new token
      const retryResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${currentTokens.access_token}`,
          'Accept': 'application/json'
        }
      });
      return retryResponse.data;
    }
    throw error;
  }
};

export const fetchDevices = async () => {
  const url = `${API_BASE_URL}/devices`;
  try {
    const devicesMap = await makeAuthenticatedRequest(url);
    const result = [];
    for (const [id, data] of Object.entries(devicesMap)) {
      const state = data.state || {};
      const ident = data.ident || {};

      let fillingLevels = {};
      try {
        // Fetch filling levels from specific endpoint
        const rawFillingLevels = await makeAuthenticatedRequest(`${API_BASE_URL}/devices/${id}/fillingLevels`);
        if (rawFillingLevels) {
          for (const [key, value] of Object.entries(rawFillingLevels)) {
            if (value !== null) {
              fillingLevels[key] = value;
            }
          }
        }
        logger.debug({ appliance_id: id, fillingLevels }, 'Filling levels fetched');
      } catch (err) {
        // If not available, fallback or ignore
        logger.debug({ appliance_id: id, err }, 'Could not fetch filling levels');
      }

      const status = state.status?.value_raw;
      const status_localized = state.status?.value_localized;

      const programType = state.programType?.value_raw;
      const programType_localized = state.programType?.value_localized;

      const programPhase = state.programPhase?.value_raw;
      const programPhase_localized = state.programPhase?.value_localized;

      // Transform time arrays [hours, minutes] to seconds
      const parseTime = (arr) => (Array.isArray(arr) && arr.length >= 2) ? (arr[0] * 3600 + arr[1] * 60) : undefined;
      const remainingTime = parseTime(state.remainingTime);
      const elapsedTime = parseTime(state.elapsedTime);

      const ecoFeedback = state.ecoFeedback || {};

      result.push({
        appliance_id: id,
        model_name: (ident.type?.value_localized || 'Unknown device') + ' ' + (ident.deviceIdentLabel?.techType || '------'),
        deviceType: ident.type?.value_localized,
        status,
        status_localized,
        programType,
        programType_localized,
        programPhase,
        programPhase_localized,
        remainingTime,
        elapsedTime,
        ecoFeedback,
        fillingLevels
      });
    }
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch devices');
    throw error;
  }
};

export const getAuthStatus = () => {
  if (!currentTokens) {
    return {
      authenticated: false,
      accessTokenExists: false,
      refreshTokenExists: false
    };
  }

  const now = Date.now();
  const obtainedAt = currentTokens.obtained_at || now;
  // Usually expires_in is seconds
  const expiresInMs = (currentTokens.expires_in || 0) * 1000;
  const expirationTime = new Date(obtainedAt + expiresInMs);

  return {
    authenticated: true,
    accessTokenExists: !!currentTokens.access_token,
    refreshTokenExists: !!currentTokens.refresh_token,
    tokenExpirationTime: expirationTime.toISOString(),
    obtainedAt: new Date(obtainedAt).toISOString()
  };
};
