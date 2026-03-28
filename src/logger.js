export const logger = {
  info: (...args) => console.log(`[INFO]`, new Date().toISOString(), ...args),
  error: (...args) => console.error(`[ERROR]`, new Date().toISOString(), ...args),
  warn: (...args) => console.warn(`[WARN]`, new Date().toISOString(), ...args),
  debug: (...args) => {
    // Enable debug logging via an env variable if needed, or by default just log
    if (process.env.DEBUG) {
      console.debug(`[DEBUG]`, new Date().toISOString(), ...args);
    }
  },
};
