'use strict';

/**
 * COMPLETE EXAMPLE: Logger usage in a Logic Driver
 * * This example shows how to use all the different
 * logging methods in Logger.js in a real driver.
 */

const Homey = require('homey');
const Logger = require('../../lib/Logger');

class ExampleLogicDriver extends Homey.Driver {
  
  async onInit() {
    // ✅ RECOMMENDED: Initialize WITHOUT level - uses loggerConfig.js
    const driverName = this.constructor.name || 'ExampleLogicDriver';
    this.logger = new Logger(this, driverName);
    
    // Important startup message with frame
    this.logger.banner('Example Logic Driver');
    
    // Normal info logging (shown at INFO level)
    this.logger.info('Driver initialization started');
    
    // Debug information (shown only at DEBUG level)
    this.logger.debug('Loading configuration');
    this.logger.debug('Driver settings:', this.getSettings());
    
    // Device logging (shown at INFO level)
    this.logger.device('Scanning for paired devices');
    
    this.logger.info('Driver initialized successfully');
  }
  
  async onPair(session) {
    this.logger.info('Pairing session started');
    this.logger.separator(); // Visual separator (DEBUG)
    
    session.setHandler('list_devices', async () => {
      this.logger.debug('Listing available devices');
      
      // Simulate an operation and measure the time
      this.logger.timeStart('device-discovery');
      
      // Simulate search for devices
      const devices = await this.discoverDevices();
      
      // Stop timer and get duration
      const duration = this.logger.timeEnd('device-discovery');
      
      this.logger.info(`Found ${devices.length} devices in ${duration}ms`);
      
      return devices;
    });
    
    session.setHandler('add_device', async (device) => {
      this.logger.device('Adding new device:', device.name);
      return device;
    });
  }
  
  async discoverDevices() {
    // API logging (DEBUG)
    this.logger.api('Calling device discovery API');
    
    try {
      // Simulate API call
      const response = { devices: [1, 2, 3] };
      
      this.logger.api('Discovery API response:', response);
      
      return [
        { name: 'Logic Unit 1', data: { id: 'unit-1' } },
        { name: 'Logic Unit 2', data: { id: 'unit-2' } }
      ];
    } catch (error) {
      this.logger.error('Device discovery failed', error);
      throw error;
    }
  }
  
  async calculateFormula(inputs) {
    this.logger.separator(); // Visual separator (DEBUG)
    
    // Log formula input (DEBUG)
    this.logger.input('Formula inputs received:', inputs);
    
    // Validation with warning
    if (!inputs.A && !inputs.B) {
      this.logger.warn('Both A and B are false, result will always be false');
    }
    
    // Start timer for performance measurement
    this.logger.timeStart('formula-eval');
    
    try {
      // Formula logging (DEBUG) - specialized for formulas
      this.logger.formula('Evaluating expression: (A AND B) OR C');
      this.logger.formula('Input values:', {
        A: inputs.A,
        B: inputs.B,
        C: inputs.C
      });
      
      // Calculate result
      const result = (inputs.A && inputs.B) || inputs.C;
      
      // Log result
      this.logger.formula('Formula result:', result);
      this.logger.output('Sending result to device:', { result });
      
      // Detailed debug for intermediate step
      this.logger.debug('Intermediate calculation:', {
        'A AND B': inputs.A && inputs.B,
        'OR C': result
      });
      
      // Stop timer
      const duration = this.logger.timeEnd('formula-eval');
      
      // Use once() to avoid spam in loops
      if (duration > 100) {
        this.logger.once('slow-formula', 'warn', 
          `Formula calculation took ${duration}ms - consider optimization`);
      }
      
      return result;
    } catch (error) {
      // Error logging (always visible)
      this.logger.error('Formula calculation failed', error);
      
      // Dump the entire object for debugging (DEBUG)
      this.logger.dump('Error context', {
        inputs,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  async handleFlowCard(args) {
    // Flow card logging (INFO)
    this.logger.flow('Flow card triggered:', args.cardName);
    this.logger.flow('Arguments:', args);
    
    try {
      const result = await this.calculateFormula(args.values);
      
      this.logger.flow('Flow card result:', result);
      
      return result;
    } catch (error) {
      this.logger.error('Flow card execution failed', error);
      throw error;
    }
  }
  
  async updateDeviceState(deviceId, state) {
    this.logger.device('Updating device state:', { deviceId, state });
    
    // API call to Homey
    this.logger.api('PUT /device/state');
    
    try {
      // Simulate API call
      const response = await this.updateViaAPI(deviceId, state);
      
      this.logger.api('Update response:', response);
      this.logger.device('Device state updated successfully');
      
      return response;
    } catch (error) {
      this.logger.error('Failed to update device state', error);
      throw error;
    }
  }
  
  async updateViaAPI(deviceId, state) {
    // Simulate API call
    return { success: true, deviceId, state };
  }
  
  async performComplexOperation() {
    // Banner for important operations (INFO)
    this.logger.banner('STARTING COMPLEX OPERATION');
    
    this.logger.info('Phase 1: Initialization');
    this.logger.timeStart('phase-1');
    await this.sleep(100);
    this.logger.timeEnd('phase-1');
    
    this.logger.info('Phase 2: Processing');
    this.logger.timeStart('phase-2');
    await this.sleep(150);
    this.logger.timeEnd('phase-2');
    
    this.logger.info('Phase 3: Finalization');
    this.logger.timeStart('phase-3');
    await this.sleep(50);
    this.logger.timeEnd('phase-3');
    
    this.logger.banner('OPERATION COMPLETED');
  }
  
  async debugObjectState() {
    const complexState = {
      devices: ['device-1', 'device-2'],
      formulas: {
        formula1: { expression: 'A AND B', active: true },
        formula2: { expression: 'C OR D', active: false }
      },
      settings: {
        logLevel: 'DEBUG',
        interval: 5000
      }
    };
    
    // Pretty-formatted object printing (DEBUG)
    this.logger.dump('Current driver state', complexState);
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ExampleLogicDriver;

/**
 * HOW TO USE THIS EXAMPLE:
 * * 1. Copy this file to drivers/example-logic/driver.js
 * * 2. Create lib/loggerConfig.js:
 * * module.exports = {
 * defaultLevel: 'INFO',
 * categoryLevels: {
 * 'ExampleLogicDriver': 'DEBUG'  // ← Set to DEBUG to see everything
 * }
 * };
 * * 3. Run the app:
 * homey app run
 * * 4. Experiment with different levels:
 * - DEBUG: See EVERYTHING (formulas, input, output, timing, etc.)
 * - INFO: See standard operation (info, device, flow, banner)
 * - WARN: See only warnings and errors
 * - ERROR: See only errors
 * * USEFUL COMMANDS FOR TESTING:
 * * // Switch to DEBUG for this driver
 * // Change categoryLevels in loggerConfig.js:
 * 'ExampleLogicDriver': 'DEBUG'
 * * // Switch to INFO (normal operation)
 * 'ExampleLogicDriver': 'INFO'
 * * // Switch to WARN (minimal logging)
 * 'ExampleLogicDriver': 'WARN'
 */