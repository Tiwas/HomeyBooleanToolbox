"use strict";

/**
 * Advanced Logger for Homey Apps
 *
 * NEW: Supports global configuration via loggerConfig.js
 * FIX: Manually performs variable substitution as this.homey.__() fails to do so.
 * FIX (User): Added log level (e.g., [INFO ], [DEBUG]) to the console output.
 * FIX (User): Moved log level to the front of the output.
 * FIX (User): Fixed 'minLevel = 0 || ...' bug.
 * FIX (User): Added config loaded logging and static cache.
 * FIX (User): Moved config log to appear *after* the banner.
 * FIX (User): Fixed bug in _getDefaultConfig catch block return shape.
 * FIX (User): Fixed null-logging in banner().
 * FIX (User): Reverted info() to log as INFO. Code should be explicit.
 */

class Logger {
  static LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
  };

  static SYMBOLS = {
    DEBUG: "🔍",
    INFO: "✅",
    WARN: "⚠️",
    ERROR: "❌",
    TIMER: "⏱️",
    FORMULA: "📐",
    INPUT: "📥",
    OUTPUT: "📤",
    DEVICE: "🔌",
    API: "🌐",
    FLOW: "🔄",
  };

  static _globalConfig = null;

  /**
   * Get default configuration
   * Tries to load from loggerConfig.js, falls back to defaults
   * @private
   */
  static _getDefaultConfig() {
    // Use cache if available
    if (Logger._globalConfig) {
      return Logger._globalConfig;
    }

    try {
      const config = require("./loggerConfig");
      Logger._globalConfig = { config: config, source: "custom" };
      return Logger._globalConfig;
    } catch (e) {
      const defaultConfig = {
        defaultLevel: "DEBUG", // ENDRET: Fallback til DEBUG
        categoryLevels: {},
        options: {},
      };
      // --- FIKS: Returner samme objektform som i 'try' ---
      Logger._globalConfig = { config: defaultConfig, source: "default" };
      return Logger._globalConfig;
      // --- SLUTT FIKS ---
    }
  }

  constructor(context, category = "App", options = {}) {
    // --- FIKS I KONSTRUKTØR ---
    // Finner det *ekte* homey-objektet uansett om 'context' er App eller Device
    if (context && context.homey) {
      this.homey = context.homey;
    } else if (context && context.app && context.app.homey) {
      // Fallback
      this.homey = context.app.homey;
    } else {
      console.error(
        `Logger: Could not find 'homey' object on context for category '${category}'.`,
      );
      // Oppretter en dummy for å unngå krasj
      this.homey = {
        app: { log: console.log, error: console.error },
        __: (s) => s, // Returnerer bare nøkkelen
      };
    }
    // --- SLUTT FIKS ---

    this.context = context;
    this.category = category;

    // Load global config
    const { config: globalConfig, source: configSource } =
      Logger._getDefaultConfig();
    this.configSource = configSource; // Lagrer kilden for bruk i banner()

    // Determine log level (priority: options > categoryLevels > defaultLevel)
    let level = options.level;
    if (!level && globalConfig.categoryLevels[category]) {
      level = globalConfig.categoryLevels[category];
    }
    if (!level) {
      level = globalConfig.defaultLevel || "DEBUG"; // ENDRET: Fallback til DEBUG
    }

    this.options = {
      level: level.toUpperCase(),
      timestamps:
        options.timestamps || globalConfig.options.timestamps || false,
      colors: options.colors || globalConfig.options.colors || false,
    }; // --- FIKS: Manglende } lagt til ---

    // --- FIKS: Korrekt sjekk for 0 (DEBUG) ---
    if (Logger.LEVELS[this.options.level] !== undefined) {
      this.minLevel = Logger.LEVELS[this.options.level];
    } else {
      this.minLevel = Logger.LEVELS.DEBUG; // Fallback
    }
    // --- SLUTT FIKS ---

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
    let message = keyOrMessage; // Start with the original key/message

    // 1. Attempt Translation IF it looks like a key and __ exists
    if (
      typeof keyOrMessage === "string" &&
      keyOrMessage.includes(".") &&
      this.homey &&
      typeof this.homey.__ === "function"
    ) {
      try {
        const translated = this.homey.__(keyOrMessage, data);
        // Use translation ONLY if it's a non-empty string and DIFFERENT from the key
        if (
          typeof translated === "string" &&
          translated.trim() !== "" &&
          translated !== keyOrMessage
        ) {
          message = translated;
        }
        // If translated is null, undefined, empty, or same as key, 'message' remains keyOrMessage
      } catch (e) {
        // If translation throws error, 'message' remains keyOrMessage
        // console.error(`Logger: Error during this.homey.__ for key '${keyOrMessage}'. Using key.`, e);
      }
    }

    // 2. Ensure 'message' is now DEFINITELY a string (fallback if translation failed badly)
    let messageStr = String(message ?? keyOrMessage); // Use keyOrMessage if message became null/undefined

    // 3. Perform Manual Substitution on the resulting string
    if (data && typeof data === "object" && data !== null) {
      try {
        messageStr = messageStr.replace(/\{([^{}]+)\}/g, (match, key) => {
          // Use value from data if exists and is not null/undefined, otherwise keep placeholder
          return data.hasOwnProperty(key) &&
            data[key] !== null &&
            data[key] !== undefined
            ? String(data[key]) // Ensure replacement is a string
            : match;
        });
      } catch (e) {
        console.error(
          `Logger: Manual substitution failed for: "${messageStr}"`,
          e,
        );
        // messageStr remains as it was before substitution attempt
      }
    }

    // Return the final string
    return messageStr;
  }

  _log(level, symbol, keyOrMessage, data) {
    if (!this._shouldLog(level)) {
      return;
    }

    // --- FIKS: Log-nivå lagt til ---
    const levelString = `[${level.padEnd(5)}]`;
    const prefix = this._getPrefix(symbol);
    const formattedMessage = this._formatMessage(keyOrMessage, data);

    try {
      // Bruk ALLTID this.homey.app.log
      // --- FIKS: Flyttet levelString FØRST ---
      this.homey.app.log(levelString, prefix, formattedMessage);
    } catch (error) {
      console.error("Logger internal error:", error);
      console.log(levelString, prefix, formattedMessage); // Fallback til console.log
    }
  }

  _logError(keyOrMessage, error) {
    if (!this._shouldLog("ERROR")) {
      return;
    }

    // --- FIKS: Log-nivå lagt til ---
    const levelString = `[${"ERROR".padEnd(5)}]`;

    const prefix = this._getPrefix(Logger.SYMBOLS.ERROR);

    // Data-objektet kan være gjemt i 'error' hvis det ikke er en ekte Error
    let data = error instanceof Error ? null : error;
    const formattedMessage = this._formatMessage(keyOrMessage, data);

    try {
      // --- FIKS: Flyttet levelString FØRST ---
      this.homey.app.error(levelString, prefix, formattedMessage);
      if (error instanceof Error) {
        this.homey.app.error(error); // Logg stack trace hvis det er en Error
      } else if (data) {
        // Hvis 'error' bare var data, er den allerede i formattedMessage
      }
    } catch (err) {
      console.error("Logger internal error (error):", err);
      console.error(levelString, prefix, formattedMessage);
      if (error) {
        console.error(error);
      }
    }
  }

  debug(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.DEBUG, message, data);
  }

  // --- FIKS: info() logger nå som INFO ---
  info(message, data) {
    this._log("INFO", Logger.SYMBOLS.INFO, message, data);
  }

  warn(message, data) {
    this._log("WARN", Logger.SYMBOLS.WARN, message, data);
  }

  error(message, error) {
    this._logError(message, error);
  }

  formula(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.FORMULA, message, data);
  }

  input(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.INPUT, message, data);
  }

  output(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.OUTPUT, message, data);
  }

  // --- FIKS: device() logger nå som DEBUG ---
  device(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.DEVICE, message, data);
  }

  api(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.API, message, data);
  }

  // --- FIKS: flow() logger nå som DEBUG ---
  flow(message, data) {
    this._log("DEBUG", Logger.SYMBOLS.FLOW, message, data);
  }

  timeStart(label) {
    this.timers.set(label, Date.now());
    if (this._shouldLog("DEBUG")) {
      this._log("DEBUG", Logger.SYMBOLS.TIMER, `Timer started: ${label}`);
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

    if (this._shouldLog("DEBUG")) {
      this._log(
        "DEBUG",
        Logger.SYMBOLS.TIMER,
        `Timer '${label}': ${duration}ms`,
      );
    }

    return duration;
  }

  dump(label, object) {
    if (!this._shouldLog("DEBUG")) {
      return;
    }

    try {
      const formatted = JSON.stringify(object, null, 2);
      this._log("DEBUG", Logger.SYMBOLS.DEBUG, `${label}:\n${formatted}`);
    } catch (error) {
      this._log("DEBUG", Logger.SYMBOLS.DEBUG, `${label}:`, object);
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
    if (typeof this[method] === "function") {
      this[method](message, data);
    } else {
      console.warn(
        `Logger: Invalid level "${level}" provided to 'once' method.`,
      );
    }
  }

  child(subCategory) {
    return new Logger(
      this.context,
      `${this.category}:${subCategory}`,
      this.options,
    );
  }

  separator() {
    if (this._shouldLog("DEBUG")) {
      this._log("DEBUG", "", "─".repeat(50));
    }
  }

  banner(message) {
    if (this._shouldLog("INFO")) {
      const line = "═".repeat(message.length + 4);
      // Banner kaller logg-funksjonen direkte for å unngå prefiks
      try {
        this.homey.app.log(line);
        this.homey.app.log(`  ${message}  `);
        this.homey.app.log(line);

        // --- FIKS: Bruker this.homey.app.log direkte ---
        // _log() feilet fordi this.homey.__() ikke var klar for strenger
        // som ikke var locale-nøkler på dette tidlige stadiet.
        if (this.configSource) {
          const configMessage =
            this.configSource === "custom"
              ? "Loaded custom configuration from ./loggerConfig.js"
              : "Using default log settings (./loggerConfig.js not found)";

          // Logger med [INFO] og 🔍-symbolet, som du foreslo
          // Bruker this.homey.app.log direkte for å unngå _formatMessage-feil
          this.homey.app.log(
            `[INFO ] ${Logger.SYMBOLS.DEBUG} [${this.category}]`,
            configMessage,
          );

          // Nullstill, så den ikke logger dette igjen hvis banner() kalles på nytt
          this.configSource = null;
        }
        // --- SLUTT FIKS ---
      } catch (e) {
        console.log(line);
        console.log(`  ${message}  `);
        console.log(line);
      }
    }
  }
}

module.exports = Logger;