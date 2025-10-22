'use strict';

/**
 * Development Logger Configuration
 * * Detailed logging for development environment.
 * Copy this over lib/loggerConfig.js during development.
 */

module.exports = {
  // Show all logging in development
  defaultLevel: 'DEBUG',
  
  // Reduce noise from base classes
  categoryLevels: {
    'App': 'INFO',
    'BaseLogicDriver': 'INFO',
    'BaseLogicUnit': 'INFO'
  },
  
  options: {
    timestamps: false,
    colors: false
  }
};