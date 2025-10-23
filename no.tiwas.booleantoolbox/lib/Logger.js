'use strict';

/**
 * Advanced Logger for Homey Apps
 *
 * NEW: Supports global configuration via loggerConfig.js
 * FIX: Manually performs variable substitution as this.homey.__() fails to do so.
 */

class Logger {
  static LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };

  static SYMBOLS = {
    DEBUG: '🔍',
    INFO: '✅',
    WARN: '⚠️',
    ERROR: '❌',
    TIMER: '⏱️',
    FORMULA: '📐',
    INPUT: '📥',
    OUTPUT: '📤',
    DEVICE: '🔌',
    API: '🌐',
    FLOW: '🔄'
  };

  /**
   * Get default configuration
   * Tries to load from loggerConfig.js, falls back to defaults
   * @private
   */
  static _getDefaultConfig() {
    try {
      const config = require('./loggerConfig');
      return config;
    } catch (e) {
      // Config file not found, use defaults
      return {
        defaultLevel: 'INFO',
        categoryLevels: {},
        options: {}
      };
    }
  }

  constructor(context, category = 'App', options = {}) {
    this.context = context; // This is the App or Device instance
    
    // --- FIKS I KONSTRUKTØR ---
    // Finner det *ekte* homey-objektet uansett om 'context' er App eller Device
    if (context && context.homey) {
      this.homey = context.homey;
    } else if (context && context.app && context.app.homey) { // Fallback
      this.homey = context.app.homey;
    } else {
      console.error(`Logger: Could not find 'homey' object on context for category '${category}'.`);
      // Oppretter en dummy for å unngå krasj
      this.homey = { 
        app: { log: console.log, error: console.error },
        __: (s) => s // Returnerer bare nøkkelen
      };
    }
    // --- SLUTT FIKS ---

    this.category = category;
    
    // Load global config
    const globalConfig = Logger._getDefaultConfig();
    
    // Determine log level (priority: options > categoryLevels > defaultLevel)
    let level = options.level;
    if (!level && globalConfig.categoryLevels[category]) {
      level = globalConfig.categoryLevels[category];
    }
    if (!level) {
      level = globalConfig.defaultLevel || 'INFO';
    }
    
    this.options = {
      level: level.toUpperCase(),
      timestamps: options.timestamps || globalConfig.options.timestamps || false,
      colors: options.colors || globalConfig.options.colors || false,
      ...options
    };

    this.minLevel = Logger.LEVELS[this.options.level] || Logger.LEVELS.INFO;
    this.timers = new Map();
  }

  setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (Logger.LEVELS[upperLevel] !== undefined) {
      this.minLevel = Logger.LEVELS[upperLevel];
      this.options.level = upperLevel;
    }
  }

  getLevel() {
    return this.options.level;
  }

  _shouldLog(level) {
    return Logger.LEVELS[level] >= this.minLevel;
  }

  _getPrefix(symbol) {
    return `${symbol} [${this.category}]`;
  }

  _formatMessage(keyOrMessage, data) {
    let message;
    try {
      // 1. Hent mal-strengen (f.eks. "Logic Device '{name}'...")
      message = this.homey.__(keyOrMessage, data);
    } catch (e) {
      // Hvis __-funksjonen feiler, bruk nøkkelen som melding
      message = keyOrMessage;
      console.error(`Logger: this.homey.__() failed for key: ${keyOrMessage}`, e);
    }
    
    // 2. MANUELL ERSTATNING (dette er den nye, kritiske fiks-en)
    if (data && typeof data === 'object' && data !== null) {
      try {
        for (const key in data) {
          // Lag en regex for å erstatte {key}
          const regex = new RegExp(`\\{${key}\\}`, 'g');
          message = message.replace(regex, data[key]);
        }
      } catch (e) {
         console.error(`Logger: Manuell erstatning feilet for: ${message}`, e);
      }
    }

    return message;
  }

  _log(level, symbol, keyOrMessage, data) {
    if (!this._shouldLog(level)) {
      return;
    }

    const prefix = this._getPrefix(symbol);
    const formattedMessage = this._formatMessage(keyOrMessage, data);
    
    try {
      // Bruk ALLTID this.homey.app.log
      this.homey.app.log(prefix, formattedMessage);

    } catch (error) {
      console.error('Logger internal error:', error);
      console.log(prefix, formattedMessage); // Fallback til console.log
    }
  }

  _logError(keyOrMessage, error) {
    if (!this._shouldLog('ERROR')) {
      return;
    }

    const prefix = this._getPrefix(Logger.SYMBOLS.ERROR);
    
    // Data-objektet kan være gjemt i 'error' hvis det ikke er en ekte Error
    let data = (error instanceof Error) ? null : error;
    const formattedMessage = this._formatMessage(keyOrMessage, data);
    
    try {
      this.homey.app.error(prefix, formattedMessage);
      if (error instanceof Error) {
        this.homey.app.error(error); // Logg stack trace hvis det er en Error
      } else if (data) {
        // Hvis 'error' bare var data, er den allerede i formattedMessage
      }
    } catch (err) {
      console.error('Logger internal error (error):', err);
      console.error(prefix, formattedMessage);
      if (error) {
        console.error(error);
      }
    }
  }

  debug(message, data) {
    this._log('DEBUG', Logger.SYMBOLS.DEBUG, message, data);
  }

  info(message, data) {
    this._log('INFO', Logger.SYMBOLS.INFO, message, data);
  }

  warn(message, data) {
    this._log('WARN', Logger.SYMBOLS.WARN, message, data);
  }

  error(message, error) {
    this._logError(message, error);
  }

  formula(message, data) {
    this._log('DEBUG', Logger.SYMBOLS.FORMULA, message, data);
  }

  input(message, data) {
    this._log('DEBUG', Logger.SYMBOLS.INPUT, message, data);
  }

  output(message, data) {
    this._log('DEBUG', Logger.SYMBOLS.OUTPUT, message, data);
  }

  device(message, data) {
    this._log('INFO', Logger.SYMBOLS.DEVICE, message, data);
  }

  api(message, data) {
    this._log('DEBUG', Logger.SYMBOLS.API, message, data);
  }

  flow(message, data) {
    this._log('INFO', Logger.SYMBOLS.FLOW, message, data);
  }

  timeStart(label) {
    this.timers.set(label, Date.now());
    if (this._shouldLog('DEBUG')) {
      this._log('DEBUG', Logger.SYMBOLS.TIMER, `Timer started: ${label}`);
    }
  }

  timeEnd(label) {
    const startTime = this.timers.get(label);
    if (!startTime) {
      this.warn(`Timer '${label}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    if (this._shouldLog('DEBUG')) {
      this._log('DEBUG', Logger.SYMBOLS.TIMER, `Timer '${label}': ${duration}ms`);
    }

    return duration;
  }

  dump(label, object) {
    if (!this._shouldLog('DEBUG')) {
      return;
    }

    try {
      const formatted = JSON.stringify(object, null, 2);
      this._log('DEBUG', Logger.SYMBOLS.DEBUG, `${label}:\n${formatted}`);
    } catch (error) {
      this._log('DEBUG', Logger.SYMBOLS.DEBUG, `${label}:`, object);
    }
  }

  once(key, level, message, data) {
    if (!this._onceKeys) {
      this._onceKeys = new Set();
    }

    if (this._onceKeys.has(key)) {
      return;
    }

    this._onceKeys.add(key);
    const method = level.toLowerCase();
     if (typeof this[method] === 'function') {
        this[method](message, data);
    } else {
        console.warn(`Logger: Invalid level "${level}" provided to 'once' method.`);
    }
  }

  child(subCategory) {
    return new Logger(this.context, `${this.category}:${subCategory}`, this.options);
  }

  separator() {
    if (this._shouldLog('DEBUG')) {
      this._log('DEBUG', '', '─'.repeat(50));
    }
  }

  banner(message) {
    if (this._shouldLog('INFO')) {
      const line = '═'.repeat(message.length + 4);
      // Banner kaller logg-funksjonen direkte for å unngå prefiks
      try {
        this.homey.app.log(line);
        this.homey.app.log(`  ${message}  `);
        this.homey.app.log(line);
      } catch (e) {
        console.log(line);
        console.log(`  ${message}  `);
        console.log(line);
      }
    }
  }
}

module.exports = Logger;

