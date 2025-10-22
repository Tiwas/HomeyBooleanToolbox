'use strict';

/**
 * Production Logger Configuration
 * * Minimal logging for production environment.
 * Copy this over lib/loggerConfig.js before deployment.
 */

module.exports = {
  // Only warnings and errors in production
  defaultLevel: 'WARN',
  
  // Show only important app messages
  categoryLevels: {
    'App': 'INFO'
  },
  
  options: {
    timestamps: false,
    colors: false
  }
};