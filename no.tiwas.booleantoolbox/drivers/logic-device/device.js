'use strict';

const Homey = require('homey');

module.exports = class LogicDeviceDevice extends Homey.Device {

  async onInit() {
    this.log(`Logic Device '${this.getName()}' initializing.`);
    
    this.numInputs = this.getData().numInputs || 2;
    this.availableInputs = this.getAvailableInputIds();
    this.deviceListeners = new Map();
    this.pollingIntervals = new Map();
    
    // Legg til nødvendige capabilities
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    
    if (!this.hasCapability('alarm_generic')) {
      await this.addCapability('alarm_generic');
    }
    
    // Sett capabilities til read-only så Homey UI ikke prøver å kontrollere dem
    try {
      await this.setCapabilityOptions('onoff', {
        setable: false,
        getable: true
      });
      this.log('✅ Set onoff as read-only');
    } catch (e) {
      this.log('Could not set capability options:', e.message);
    }
    
    await this.initializeFormulas();
    await this.setupDeviceLinks();
    
    // VIKTIG: Poll umiddelbart for å hente initial values
    // this.log('Running initial poll for current values...');
    // await this.pollDeviceStates();
    
    // Start kontinuerlig polling
    // this.startPolling();
    
    // Evaluer alle formler etter polling
    this.log('Running initial formula evaluation...');
    await this.evaluateAllFormulasInitial();
    
    this.startTimeoutChecks();
    
    this.log(`Logic Device '${this.getName()}' initialized with ${this.numInputs} inputs`);
  }

  getAvailableInputIds() {
    const allInputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    return allInputs.slice(0, this.numInputs);
  }

  getAvailableInputsUppercase() {
    return this.availableInputs.map(i => i.toUpperCase());
  }

  async initializeFormulas() {
    const settings = this.getSettings();
    try {
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];
      
      this.formulas = formulasData.map(f => ({
        id: f.id,
        name: f.name,
        expression: f.expression,
        enabled: f.enabled !== false,
        timeout: f.timeout || 0,
        firstImpression: f.firstImpression === true, // Default FALSE for kontinuerlig evaluering
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false
      }));
      
      this.formulas.forEach(formula => {
        this.availableInputs.forEach(id => {
          formula.inputStates[id] = 'undefined';
          formula.lockedInputs[id] = false;
        });
      });
      
    } catch (e) {
      this.error('Failed to parse formulas:', e);
      this.formulas = [];
    }
    
    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: 'formula_1',
        name: 'Main Formula',
        expression: this.getDefaultExpression(),
        enabled: true,
        timeout: 0,
        firstImpression: false, // Default FALSE for kontinuerlig evaluering
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false
      };
      
      this.availableInputs.forEach(id => {
        defaultFormula.inputStates[id] = 'undefined';
        defaultFormula.lockedInputs[id] = false;
      });
      
      this.formulas = [defaultFormula];
    }
    
    this.log(`Initialized ${this.formulas.length} formulas`);
    this.formulas.forEach(f => {
      this.log(`  - ${f.name}: "${f.expression}" (enabled: ${f.enabled})`);
    });
  }

  getDefaultExpression() {
    const inputs = this.getAvailableInputsUppercase();
    return inputs.join(' AND ');
  }

  async setupDeviceLinks() {
    this.log('Setting up device links...');
    
    // Clean up old listeners
    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) {
          await listener.unregister();
          this.log(`Unregistered listener: ${key}`);
        }
      } catch (e) {
        this.error('Error unregistering listener:', e);
      }
    }
    this.deviceListeners.clear();

    const settings = this.getSettings();
    let inputLinks = [];
    
    try {
      inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.error('Failed to parse input_links:', e);
      return;
    }

    this.log(`Setting up ${inputLinks.length} device links`);

    // Setup all listeners sequentially and wait for each one
    for (const link of inputLinks) {
      try {
        this.log(`\n=== Setting up link for input ${link.input?.toUpperCase()} ===`);
        await this.setupDeviceListener(link);
        this.log(`=== Completed setup for input ${link.input?.toUpperCase()} ===\n`);
      } catch (e) {
        this.error(`Failed to setup listener for input ${link.input}:`, e);
      }
    }
    
    // NY KODE: Eksplisitt hent initial values etter at alle listeners er satt opp
    this.log('\n=== Fetching initial values for all inputs ===');
    await this.fetchInitialValues(inputLinks);
    this.log('=== Initial values fetch complete ===\n');
    
    this.log('Device links setup complete');
  }

  async fetchInitialValues(inputLinks) {
    if (!this.homey.app.api) {
      this.error('App API not available for fetching initial values');
      return;
    }

    for (const link of inputLinks) {
      const { input, deviceId, capability, deviceName } = link;
      
      if (!input || !deviceId || !capability) {
        continue;
      }

      try {
        this.log(`[${input.toUpperCase()}] Fetching initial value...`);
        
        // Get fresh device state from API
        const device = await this.homey.app.api.devices.getDevice({ id: deviceId });
        
        if (!device) {
          this.log(`[${input.toUpperCase()}] ❌ Device not found`);
          continue;
        }

        let initialValue = null;

        // Try multiple methods to get the value
        if (device.capabilitiesObj && device.capabilitiesObj[capability]) {
          initialValue = device.capabilitiesObj[capability].value;
          this.log(`[${input.toUpperCase()}] ✓ Got value from capabilitiesObj: ${initialValue}`);
        } else if (device.capabilityValues && device.capabilityValues[capability] !== undefined) {
          initialValue = device.capabilityValues[capability];
          this.log(`[${input.toUpperCase()}] ✓ Got value from capabilityValues: ${initialValue}`);
        } else if (device.state && device.state[capability] !== undefined) {
          initialValue = device.state[capability];
          this.log(`[${input.toUpperCase()}] ✓ Got value from state: ${initialValue}`);
        }

        if (initialValue !== null && initialValue !== undefined) {
          const boolValue = this.convertToBoolean(initialValue, capability);
          this.log(`[${input.toUpperCase()}] ✓ Initial value: ${initialValue} → ${boolValue}`);
          
          // Set initial value for all formulas
          for (const formula of this.formulas) {
            formula.inputStates[input] = boolValue;
            this.log(`[${input.toUpperCase()}] Set in '${formula.name}' to ${boolValue}`);
          }
        } else {
          this.log(`[${input.toUpperCase()}] ⚠️ No initial value found - waiting for first event`);
        }

      } catch (e) {
        this.error(`[${input.toUpperCase()}] Error fetching initial value:`, e.message);
      }
    }
  }

  async setupDeviceListener(link) {
    const { input, deviceId, capability, deviceName } = link;
    
    this.log(`\n[${input.toUpperCase()}] ========== SETUP START ==========`);
    this.log(`[${input.toUpperCase()}] Device Name: ${deviceName}`);
    this.log(`[${input.toUpperCase()}] Device ID: ${deviceId}`);
    this.log(`[${input.toUpperCase()}] Capability: ${capability}`);
    
    if (!input || !deviceId || !capability) {
      this.error(`[${input.toUpperCase()}] Invalid link configuration:`, link);
      return;
    }

    try {
      // Use app's API to get device
      if (!this.homey.app.api) {
        this.error(`[${input.toUpperCase()}] App API not available!`);
        return;
      }
      
      this.log(`[${input.toUpperCase()}] Getting all devices from API...`);
      const allDevices = await this.homey.app.api.devices.getDevices();
      this.log(`[${input.toUpperCase()}] Total devices found: ${Object.keys(allDevices).length}`);
      
      const targetDevice = allDevices[deviceId];
      
      if (!targetDevice) {
        this.error(`[${input.toUpperCase()}] ❌ Device not found: ${deviceId}`);
        const deviceIds = Object.keys(allDevices).slice(0, 5);
        this.error(`[${input.toUpperCase()}] Sample device IDs:`, deviceIds);
        return;
      }

      this.log(`[${input.toUpperCase()}] ✓ Found device: ${targetDevice.name}`);
      this.log(`[${input.toUpperCase()}] Device capabilities:`, targetDevice.capabilities);

      // Check if device has the capability
      if (!targetDevice.capabilities || !targetDevice.capabilities.includes(capability)) {
        this.error(`[${input.toUpperCase()}] ❌ Device missing capability: ${capability}`);
        this.error(`[${input.toUpperCase()}] Available:`, targetDevice.capabilities);
        return;
      }

      this.log(`[${input.toUpperCase()}] ✓ Device has capability: ${capability}`);

      // Get initial value - MANGE forsøk
      let initialValue = null;
      this.log(`[${input.toUpperCase()}] Attempting to get initial value...`);
      
      // Forsøk 1
      if (targetDevice.capabilityValues && targetDevice.capabilityValues[capability] !== undefined) {
        initialValue = targetDevice.capabilityValues[capability];
        this.log(`[${input.toUpperCase()}] ✓ Method 1 (capabilityValues): ${initialValue}`);
      }
      // Forsøk 2
      else if (targetDevice.capabilityInstances && targetDevice.capabilityInstances[capability]) {
        initialValue = targetDevice.capabilityInstances[capability].value;
        this.log(`[${input.toUpperCase()}] ✓ Method 2 (capabilityInstances): ${initialValue}`);
      }
      // Forsøk 3
      else if (targetDevice.state && targetDevice.state[capability] !== undefined) {
        initialValue = targetDevice.state[capability];
        this.log(`[${input.toUpperCase()}] ✓ Method 3 (state): ${initialValue}`);
      }
      // Forsøk 4 - prøv å hente direkte
      else {
        try {
          this.log(`[${input.toUpperCase()}] Trying to fetch current value...`);
          const deviceState = await this.homey.app.api.devices.getDevice({ id: deviceId });
          if (deviceState && deviceState.capabilityValues) {
            initialValue = deviceState.capabilityValues[capability];
            this.log(`[${input.toUpperCase()}] ✓ Method 4 (fresh fetch): ${initialValue}`);
          }
        } catch (e) {
          this.log(`[${input.toUpperCase()}] Method 4 failed:`, e.message);
        }
      }
      
      if (initialValue !== null && initialValue !== undefined) {
        const boolValue = this.convertToBoolean(initialValue, capability);
        this.log(`[${input.toUpperCase()}] ✓ Initial value: ${initialValue} → ${boolValue}`);
        
        for (const formula of this.formulas) {
          formula.inputStates[input] = boolValue;
          this.log(`[${input.toUpperCase()}] Set in '${formula.name}' to ${boolValue}`);
        }
      } else {
        this.log(`[${input.toUpperCase()}] ⚠️ No initial value - waiting for first event`);
      }

      // Create listener function
      const listenerFn = async (value) => {
        this.log(`\n*** [${input.toUpperCase()}] EVENT RECEIVED ***`);
        this.log(`Device: ${targetDevice.name}`);
        this.log(`Capability: ${capability}`);
        this.log(`Raw value: ${value}`);
        
        const boolValue = this.convertToBoolean(value, capability);
        this.log(`Boolean value: ${boolValue}`);
        
        for (const formula of this.formulas) {
          this.log(`Updating '${formula.name}' input ${input.toUpperCase()} → ${boolValue}`);
          await this.setInputForFormula(formula.id, input, boolValue).catch(this.error);
        }
        
        this.log(`*** [${input.toUpperCase()}] EVENT COMPLETE ***\n`);
      };

      // Register listener
      this.log(`[${input.toUpperCase()}] Registering capability listener...`);
      
      let registered = false;
      
      // Method 1: makeCapabilityInstance
      if (typeof targetDevice.makeCapabilityInstance === 'function') {
        try {
          this.log(`[${input.toUpperCase()}] Trying makeCapabilityInstance...`);
          targetDevice.makeCapabilityInstance(capability, listenerFn);
          this.log(`[${input.toUpperCase()}] ✓ Registered via makeCapabilityInstance`);
          registered = true;
        } catch (e) {
          this.error(`[${input.toUpperCase()}] makeCapabilityInstance failed:`, e.message);
        }
      } else {
        this.log(`[${input.toUpperCase()}] makeCapabilityInstance not available`);
      }
      
      // Method 2: device.on
      if (!registered && typeof targetDevice.on === 'function') {
        try {
          const eventName = `capability.${capability}`;
          this.log(`[${input.toUpperCase()}] Trying device.on('${eventName}')...`);
          targetDevice.on(eventName, listenerFn);
          this.log(`[${input.toUpperCase()}] ✓ Registered via device.on`);
          registered = true;
        } catch (e) {
          this.error(`[${input.toUpperCase()}] device.on failed:`, e.message);
        }
      }
      
      if (!registered) {
        this.error(`[${input.toUpperCase()}] ❌ Could not register listener!`);
        this.log(`[${input.toUpperCase()}] Available methods:`, Object.keys(targetDevice).filter(k => typeof targetDevice[k] === 'function').slice(0, 10));
      }
      
      // Store listener info
      const listenerKey = `${input}-${deviceId}-${capability}`;
      this.deviceListeners.set(listenerKey, {
        deviceId,
        capability,
        input,
        device: targetDevice,
        listener: listenerFn,
        registered
      });

      this.log(`[${input.toUpperCase()}] ========== SETUP COMPLETE ==========\n`);

    } catch (e) {
      this.error(`[${input.toUpperCase()}] ❌ SETUP FAILED:`, e.message);
      this.error(`[${input.toUpperCase()}] Stack:`, e.stack);
    }
  }

  convertToBoolean(value, capability) {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (capability.startsWith('alarm_')) {
      return !!value;
    }
    
    if (capability === 'onoff') {
      return !!value;
    }
    
    if (typeof value === 'number') {
      return value > 0;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'on' || lowerValue === 'yes';
    }
    
    return !!value;
  }

  async setInputForFormula(formulaId, inputId, value) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      return null;
    }
    
    // Kun låse hvis firstImpression er aktivert
    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.log(`⚠️ Input '${inputId.toUpperCase()}' locked for formula '${formula.name}' (firstImpression mode)`);
      return formula.result;
    }
    
    const oldValue = formula.inputStates[inputId];
    this.log(`Setting input '${inputId.toUpperCase()}' to ${value} for formula '${formula.name}' (was: ${oldValue})`);
    
    formula.inputStates[inputId] = value;
    formula.timedOut = false;
    
    // Kun låse hvis firstImpression er aktivert
    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
      this.log(`🔒 Input '${inputId.toUpperCase()}' locked at value ${value} (firstImpression mode)`);
    }
    
    if (value !== 'undefined') {
      formula.lastInputTime = Date.now();
    }
    
    return await this.evaluateFormula(formulaId);
  }

  async evaluateFormula(formulaId, resetLocks = false) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula || !formula.enabled) {
      this.log(`Formula '${formulaId}' not found or disabled.`);
      return null;
    }

    // Reset locks if requested (for manual re-evaluation)
    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach(id => {
        formula.lockedInputs[id] = false;
      });
      this.log(`🔓 Unlocked all inputs for formula '${formula.name}'`);
    }

    const expression = formula.expression;
    if (!expression) {
      this.log('No expression set, cannot evaluate.');
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    // Check if all REQUIRED inputs have a value
    const allInputsDefined = requiredInputs.every(id => 
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );
    
    if (!allInputsDefined) {
      this.log(`Formula '${formula.name}': Waiting for inputs. Required: [${requiredInputs.join(', ')}]`);
      return null;
    }

    const values = {};
    this.availableInputs.forEach(id => {
      values[id.toUpperCase()] = formula.inputStates[id];
    });

    this.log(`Formula '${formula.name}': Evaluating with inputs:`, values);

    // Replace operators with JavaScript equivalents
    let evalExpression = expression
      .replace(/\bAND\b|&|\*/gi, '&&')
      .replace(/\bOR\b|\||\+/gi, '||')
      .replace(/\bXOR\b|\^|!=/gi, '!=')
      .replace(/\bNOT\b/gi, '!');

    // Replace variable names with values
    for (const key in values) {
      if (values[key] !== 'undefined') {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        evalExpression = evalExpression.replace(regex, values[key]);
      }
    }

    this.log(`Evaluating: "${expression}" → "${evalExpression}"`);

    try {
      const evaluate = new Function(`return ${evalExpression}`);
      const result = !!evaluate();

      this.log(`✅ Formula '${formula.name}' result: ${result}`);
      
      const previousResult = formula.result;
      formula.result = result;
      formula.timedOut = false;
      
      // Oppdater capabilities med error handling
      try {
        await this.setCapabilityValue('onoff', result);
        await this.setCapabilityValue('alarm_generic', result);
      } catch (e) {
        // Silent fail hvis device er deleted
        if (e.statusCode === 404) {
          this.log('Device deleted, skipping capability update');
          return null;
        }
        throw e;
      }
      
      // Trigger flow cards kun hvis resultatet endret seg (ikke ved første evaluering)
      if (previousResult !== null && previousResult !== result) {
        const triggerData = {
          formula: {
            id: formulaId,
            name: formula.name
          }
        };
        
        const state = { formulaId };
        
        try {
          // Eksisterende triggers for true/false
          if (result) {
            await this.homey.flow.getDeviceTriggerCard('formula_changed_to_true')
              .trigger(this, triggerData, state);
          } else {
            await this.homey.flow.getDeviceTriggerCard('formula_changed_to_false')
              .trigger(this, triggerData, state);
          }
          
          // NYTT: Trigger state changed med token
          await this.homey.flow.getDeviceTriggerCard('device_state_changed')
            .trigger(this, { state: result }, {});
            
        } catch (e) {
          // Silent fail hvis device er deleted
          if (e.statusCode === 404) {
            this.log('Device deleted, skipping flow trigger');
            return null;
          }
          this.error('Error triggering flow:', e);
        }
      }

      return result;

    } catch (e) {
      this.error(`❌ Failed to evaluate formula '${formula.name}': ${e.message}`);
      return null;
    }
  }

  // NY metode: Initial evaluering uten å trigger flows
  async evaluateAllFormulasInitial() {
    this.log('Initial evaluation of all formulas...');
    
    let anyEvaluated = false;
    
    for (const formula of this.formulas) {
      if (!formula.enabled) continue;
      
      const expression = formula.expression;
      if (!expression) continue;
      
      const requiredInputs = this.parseExpression(expression);
      if (requiredInputs.length === 0) continue;
      
      // Sjekk om vi har alle nødvendige inputs
      const allInputsDefined = requiredInputs.every(id => 
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );
      
      if (allInputsDefined) {
        this.log(`Formula '${formula.name}': All inputs defined, evaluating...`);
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        requiredInputs.forEach(id => {
          states[id] = formula.inputStates[id.toLowerCase()];
        });
        this.log(`Formula '${formula.name}': Missing inputs:`, states);
      }
    }
    
    if (!anyEvaluated) {
      this.log('⚠️ No formulas could be evaluated - waiting for input values');
      // Sett en default verdi så enheten ikke er tom
      await this.setCapabilityValue('onoff', false).catch(this.error);
      await this.setCapabilityValue('alarm_generic', false).catch(this.error);
    }
  }

  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase();
    const pattern = new RegExp(`\\b(${inputs.join('|')})\\b`, 'gi');
    const matches = expression.match(pattern);
    return matches ? [...new Set(matches.map(char => char.toUpperCase()))] : [];
  }

  validateExpression(expression) {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression cannot be empty' };
    }

    const inputs = this.getAvailableInputsUppercase();
    const inputPattern = inputs.join('|');
    
    const validPattern = new RegExp(`^[${inputPattern}\\s\\(\\)&|\\*\\+\\^!=ANDORXOTandorxot]+$`);
    if (!validPattern.test(expression)) {
      return { 
        valid: false, 
        error: `Expression contains invalid characters or inputs outside range (${inputs.join(', ')})` 
      };
    }

    let depth = 0;
    for (const char of expression) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) return { valid: false, error: 'Unbalanced parentheses' };
    }
    if (depth !== 0) return { valid: false, error: 'Unbalanced parentheses' };

    try {
      const testValues = {};
      inputs.forEach(id => testValues[id] = true);
      
      let testExpr = expression
        .replace(/\bAND\b|&|\*/gi, '&&')
        .replace(/\bOR\b|\||\+/gi, '||')
        .replace(/\bXOR\b|\^|!=/gi, '!=')
        .replace(/\bNOT\b/gi, '!');

      for (const key of inputs) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        testExpr = testExpr.replace(regex, 'true');
      }

      const testFunc = new Function(`return ${testExpr}`);
      testFunc();
      
      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Invalid expression syntax: ${e.message}` };
    }
  }

  getFormulas() {
    return this.formulas
      .filter(f => f.enabled)
      .map(f => ({
        id: f.id,
        name: f.name,
        description: f.expression || '(no expression)'
      }));
  }

  getInputOptions() {
    return this.getAvailableInputsUppercase().map(input => ({
      id: input.toLowerCase(),
      name: input
    }));
  }

  getFormulaResult(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      this.log(`getFormulaResult: Formula '${formulaId}' not found`);
      return null;
    }
    
    return formula.result;
  }

  hasFormulaTimedOut(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) return false;
    return formula.timedOut;
  }

  async evaluateAllFormulas() {
    this.log('Re-evaluating all formulas (resetting locks)...');
    
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => {
          formula.lockedInputs[id] = false;
        });
        this.log(`🔓 Unlocked all inputs for formula '${formula.name}'`);
        
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    
    this.log(`Evaluated ${results.length} formulas`);
    return results;
  }

  startTimeoutChecks() {
    this.timeoutInterval = setInterval(() => {
      this.checkTimeouts();
    }, 1000);
  }

/*
  startPolling() {
    // Poll every 5 seconds to catch devices that don't send events
    this.log('Starting continuous polling (every 5s)...');
    
    this.pollingInterval = setInterval(async () => {
      await this.pollDeviceStates();
    }, 5000);
  }

  async pollDeviceStates() {
    try {
      let anyValuesFound = false;
      
      for (const [key, listenerInfo] of this.deviceListeners.entries()) {
        if (!listenerInfo.device || !listenerInfo.capability) continue;
        
        try {
          const deviceId = listenerInfo.deviceId;
          const capability = listenerInfo.capability;
          const input = listenerInfo.input;
          
          // Get current value from API
          const currentDevice = await this.homey.app.api.devices.getDevice({ id: deviceId });
          if (!currentDevice) {
            this.log(`[POLL] ${input.toUpperCase()} - device not found`);
            continue;
          }
          
          let currentValue = null;
          
          // Method 1: capabilitiesObj (most reliable)
          if (currentDevice.capabilitiesObj && currentDevice.capabilitiesObj[capability]) {
            currentValue = currentDevice.capabilitiesObj[capability].value;
            if (currentValue !== undefined) {
              this.log(`[POLL] ${input.toUpperCase()} - got value from capabilitiesObj: ${currentValue}`);
            }
          }
          // Method 2: capabilityValues (fallback)
          else if (currentDevice.capabilityValues && currentDevice.capabilityValues[capability] !== undefined) {
            currentValue = currentDevice.capabilityValues[capability];
            this.log(`[POLL] ${input.toUpperCase()} - got value from capabilityValues: ${currentValue}`);
          } 
          // Method 3: state (fallback)
          else if (currentDevice.state && currentDevice.state[capability] !== undefined) {
            currentValue = currentDevice.state[capability];
            this.log(`[POLL] ${input.toUpperCase()} - got value from state: ${currentValue}`);
          }
          // Method 4: stored device object
          else if (listenerInfo.device && listenerInfo.device.capabilityValues) {
            currentValue = listenerInfo.device.capabilityValues[capability];
            if (currentValue !== undefined) {
              this.log(`[POLL] ${input.toUpperCase()} - got value from stored device: ${currentValue}`);
            }
          }
          
          if (currentValue === null || currentValue === undefined) {
            this.log(`[POLL] ${input.toUpperCase()} - no value available`);
            continue;
          }
          
          anyValuesFound = true;
          const boolValue = this.convertToBoolean(currentValue, capability);
          
          // Get current stored value
          const formula = this.formulas[0];
          if (!formula) continue;
          
          const storedValue = formula.inputStates[input];
          
          // If value changed, trigger update
          if (storedValue !== boolValue && storedValue !== 'undefined') {
            this.log(`[POLL] ${input.toUpperCase()} changed: ${storedValue} → ${boolValue}`);
            
            // Update all formulas
            for (const f of this.formulas) {
              await this.setInputForFormula(f.id, input, boolValue);
            }
          }
          // If this is the first time we get a value
          else if (storedValue === 'undefined') {
            this.log(`[POLL] ${input.toUpperCase()} initial value: ${boolValue}`);
            
            // Set initial value for all formulas
            for (const f of this.formulas) {
              f.inputStates[input] = boolValue;
            }
            
            // Try to evaluate if all inputs are ready
            const allInputsReady = this.availableInputs.every(id => 
              formula.inputStates[id] !== 'undefined'
            );
            
            if (allInputsReady) {
              this.log(`[POLL] All inputs ready, evaluating formulas...`);
              await this.evaluateAllFormulasInitial();
            }
          }
          
        } catch (e) {
          this.log(`[POLL] Error for device ${key}:`, e.message);
        }
      }
      
      if (!anyValuesFound) {
        this.log(`[POLL] No values found in this poll cycle`);
      }
    } catch (e) {
      this.error('Polling error:', e.message);
    }
  }
*/ 

  checkTimeouts() {
    const now = Date.now();
    
    this.formulas.forEach(formula => {
      if (!formula.timeout || formula.timeout <= 0) return;
      if (formula.timedOut || !formula.enabled) return;
      if (!formula.lastInputTime) return;
      
      const hasAnyInput = this.availableInputs.some(id => 
        formula.inputStates[id] !== 'undefined'
      );
      
      if (!hasAnyInput) return;
      
      const requiredInputs = this.parseExpression(formula.expression);
      const allInputsDefined = requiredInputs.every(id => 
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );
      
      if (allInputsDefined) return;
      
      const timeoutMs = formula.timeout * 1000;
      const elapsed = now - formula.lastInputTime;
      
      if (elapsed >= timeoutMs) {
        this.log(`⏱️ Formula '${formula.name}' timed out after ${formula.timeout}s`);
        formula.timedOut = true;
        
        const triggerData = {
          formula: {
            id: formula.id,
            name: formula.name
          }
        };
        
        const state = {
          formulaId: formula.id
        };
        
        this.homey.flow.getDeviceTriggerCard('formula_timeout')
          .trigger(this, triggerData, state)
          .catch(err => this.error('Error triggering timeout:', err));
      }
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed:', changedKeys);
    
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }
    
    // if (this.pollingInterval) {
    //   clearInterval(this.pollingInterval);
    // }
    
    await this.initializeFormulas();
    
    if (changedKeys.includes('formulas')) {
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(`Formula '${formula.name}': ${validation.error}`);
        }
      }
    }
    
    if (changedKeys.includes('input_links')) {
      await this.setupDeviceLinks();
      // Re-evaluate etter at nye links er satt opp
      await this.evaluateAllFormulasInitial();
    }
    
    // this.startPolling();
    this.startTimeoutChecks();
    
    this.log('Settings applied successfully');
  }

  async onDeleted() {
    this.log('Device deleted');
    
    // Stop polling
    // if (this.pollingInterval) {
    //   clearInterval(this.pollingInterval);
    //   this.log('Stopped polling');
    // }
    
    // Clean up listeners
    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) {
          await listener.unregister();
        }
      } catch (e) {
        this.error('Error cleaning up listener:', e);
      }
    }
    this.deviceListeners.clear();
    
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }
  }
};