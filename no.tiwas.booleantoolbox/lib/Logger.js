'use strict';

/**
 * Advanced Logger for Homey Apps
 * 
 * NEW: Supports global configuration via loggerConfig.js
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
    this.context = context;
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
      level: level,
      timestamps: options.timestamps || globalConfig.options.timestamps || false,
      colors: options.colors || globalConfig.options.colors || false,
      ...options
    };

    this.minLevel = Logger.LEVELS[this.options.level] || Logger.LEVELS.INFO;
    this.timers = new Map();
  }

  setLevel(level) {
    if (Logger.LEVELS[level] !== undefined) {
      this.minLevel = Logger.LEVELS[level];
      this.options.level = level;
    }
  }

  getLevel() {
    return this.options.level;
  }

  _shouldLog(level) {
    return Logger.LEVELS[level] >= this.minLevel;
  }

  _formatMessage(symbol, message, data) {
    const parts = [];
    
    if (symbol) {
      parts.push(symbol);
    }
    
    parts.push(`[${this.category}]`);
    parts.push(message);
    
    const formattedMessage = parts.join(' ');
    
    if (data !== undefined) {
      return [formattedMessage, data];
    }
    
    return [formattedMessage];
  }

  _log(level, symbol, message, data) {
    if (!this._shouldLog(level)) {
      return;
    }

    const args = this._formatMessage(symbol, message, data);
    
    try {
      if (this.context && this.context.log) {
        this.context.log(...args);
      } else if (this.context && this.context.homey && this.context.homey.app && this.context.homey.app.log) {
        this.context.homey.app.log(...args);
      } else {
        console.log(...args);
      }
    } catch (error) {
      console.error('Logger error:', error);
      console.log(...args);
    }
  }

  _logError(message, error) {
    if (!this._shouldLog('ERROR')) {
      return;
    }

    const args = this._formatMessage(Logger.SYMBOLS.ERROR, message);
    
    try {
      if (this.context && this.context.error) {
        this.context.error(...args);
        if (error) {
          this.context.error(error);
        }
      } else if (this.context && this.context.homey && this.context.homey.app && this.context.homey.app.error) {
        this.context.homey.app.error(...args);
        if (error) {
          this.context.homey.app.error(error);
        }
      } else {
        console.error(...args);
        if (error) {
          console.error(error);
        }
      }
    } catch (err) {
      console.error('Logger error:', err);
      console.error(...args);
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
    this[level.toLowerCase()](message, data);
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
      this._log('INFO', '', line);
      this._log('INFO', '', `  ${message}  `);
      this._log('INFO', '', line);
    }
  }
}

module.exports = Logger;