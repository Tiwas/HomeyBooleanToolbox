'use strict';

/**
 * Global Logger Configuration for Boolean Toolbox
 * * This is the central configuration for all logging in the app.
 * Place this file in: lib/loggerConfig.js
 * * USAGE:
 * - Adjust defaultLevel to change the default log level everywhere
 * - Add specific categories in categoryLevels for finer control
 * - Logger automatically picks up this file if it exists
 */

module.exports = {
  // Default log level for all loggers not specified below
  // Options: 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'
  defaultLevel: 'INFO',
  
  // Override log level for specific categories
  // The category name matches what is used when Logger is created:
  // new Logger(this, 'CategoryName')
  categoryLevels: {
    // Example: Show detailed logging for specific drivers
    // 'LogicUnit2Driver': 'DEBUG',
    // 'LogicUnit10Device': 'DEBUG',
    
    // Example: Reduce logging for noisy components
    // 'FormulaEngine': 'WARN',
    // 'BaseLogicUnit': 'ERROR',
    
    // Example: Always show important messages
    'App': 'INFO'
  },
  
  // Global options (usually not necessary)
  options: {
    timestamps: false,  // Homey already adds timestamps
    colors: false       // Not supported in the Homey console
  }
};

/**
 * USAGE TIPS:
 * * 1. DEVELOPMENT (heavy logging):
 * defaultLevel: 'DEBUG'
 * * 2. PRODUCTION (minimal logging):
 * defaultLevel: 'WARN'
 * categoryLevels: { 'App': 'INFO' }
 * * 3. DEBUGGING (focused logging):
 * defaultLevel: 'WARN'
 * categoryLevels: { 
 * 'LogicUnit5Driver': 'DEBUG',
 * 'FormulaEngine': 'DEBUG'
 * }
 * * 4. TESTING (balanced):
 * defaultLevel: 'INFO'
 * categoryLevels: {
 * 'BaseLogicDriver': 'WARN',
 * 'BaseLogicUnit': 'WARN'
 * }
 */