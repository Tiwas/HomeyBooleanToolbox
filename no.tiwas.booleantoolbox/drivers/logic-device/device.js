'use strict';

const Homey = require('homey');
const Logger = require('../../lib/Logger');

module.exports = class LogicDeviceDevice extends Homey.Device {

  async onInit() {
    const driverName = this.constructor.name || 'LogicDevice';
    this.logger = new Logger(this, driverName);

    this.logger.device(`Logic Device '${this.getName()}' initializing.`);

    const settings = this.getSettings();
    const detectedInputs = this.detectRequiredInputs(settings);

    const originalNumInputs = this.getData().numInputs || 2;
    this.numInputs = Math.max(detectedInputs, originalNumInputs);

    if (detectedInputs > originalNumInputs) {
      this.logger.info(`Detected ${detectedInputs} inputs needed (originally ${originalNumInputs}). Expanding capacity.`);
    }

    this.availableInputs = this.getAvailableInputIds();
    this.deviceListeners = new Map();
    this.pollingIntervals = new Map();

    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }

    if (!this.hasCapability('alarm_generic')) {
      await this.addCapability('alarm_generic');
    }

    try {
      await this.setCapabilityOptions('onoff', {
        setable: false,
        getable: true
      });
      this.logger.debug('Set onoff as read-only');
    } catch (e) {
      this.logger.warn('Could not set capability options:', e.message);
    }

    await this.initializeFormulas();
    await this.setupDeviceLinks();

    this.logger.info('Running initial formula evaluation...');
    await this.evaluateAllFormulasInitial();

    this.startTimeoutChecks();

    this.logger.info(`Logic Device '${this.getName()}' initialized with ${this.numInputs} inputs`);
  }

  getAvailableInputIds() {
    const allInputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    return allInputs.slice(0, this.numInputs);
  }

  getAvailableInputsUppercase() {
    return this.availableInputs.map(i => i.toUpperCase());
  }

  detectRequiredInputs(settings) {
    let maxInput = 2; // Default minimum

    try {
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];

      formulasData.forEach(formula => {
        if (!formula.expression) return;
        
        const pattern = /\b([A-J])\b/gi;
        const matches = formula.expression.match(pattern);

        if (matches) {
          matches.forEach(letter => {
            const inputNumber = letter.toUpperCase().charCodeAt(0) - 64; // A=1, B=2
            maxInput = Math.max(maxInput, inputNumber);
          });
        }
      });

      const inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];

      inputLinks.forEach(link => {
        if (link.input) {
          const inputNumber = link.input.toLowerCase().charCodeAt(0) - 96; // a=1, b=2
          maxInput = Math.max(maxInput, inputNumber);
        }
      });

      this.logger.debug(`Detected max input: ${String.fromCharCode(64 + maxInput)} (${maxInput} inputs needed)`);

    } catch (e) {
      this.logger.error('Error detecting required inputs:', e.message);
    }

    return maxInput;
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
        firstImpression: f.firstImpression === true,
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
      this.logger.error('Failed to parse formulas:', e);
      this.formulas = [];
    }

    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: 'formula_1',
        name: 'Main Formula',
        expression: this.getDefaultExpression(),
        enabled: true,
        timeout: 0,
        firstImpression: false,
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

    this.logger.info(`Initialized ${this.formulas.length} formulas`);
    this.formulas.forEach(f => {
      this.logger.debug(`  - ${f.name}: "${f.expression}" (enabled: ${f.enabled})`);
    });
  }

  getDefaultExpression() {
    const inputs = this.getAvailableInputsUppercase();
    return inputs.join(' AND ');
  }

  async setupDeviceLinks() {
    this.logger.info('Setting up device links...');

    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) {
          await listener.unregister();
          this.logger.debug(`Unregistered listener: ${key}`);
        }
      } catch (e) {
        this.logger.error('Error unregistering listener:', e);
      }
    }
    this.deviceListeners.clear();

    const settings = this.getSettings();
    let inputLinks = [];
    try {
      inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.logger.error('Failed to parse input_links:', e);
      return;
    }

    this.inputLinks = inputLinks;

    this.logger.debug(`Setting up ${inputLinks.length} device links`);
    for (const link of inputLinks) {
      try {
        await this.setupDeviceListener(link);
      } catch (e) {
        this.logger.error(`Failed to setup listener for input ${link.input}:`, e);
      }
    }

    this.logger.debug('Fetching initial values for all inputs...');
    await this.fetchInitialValues(inputLinks);

    this.logger.info('Device links setup complete');
  }


  async fetchInitialValues(inputLinks) {
    if (!this.homey.app.api) {
      this.logger.error('App API not available for fetching initial values');
      return;
    }

    for (const link of inputLinks) {
      const { input, deviceId, capability } = link;
      if (!input || !deviceId || !capability) continue;

      try {
        this.logger.debug(`[${input.toUpperCase()}] Fetching initial value...`);
        const device = await this.homey.app.api.devices.getDevice({ id: deviceId });
        if (!device) {
          this.logger.warn(`[${input.toUpperCase()}] Device not found`);
          continue;
        }

        let initialValue = null;

        if (device.capabilitiesObj && device.capabilitiesObj[capability]) {
          initialValue = device.capabilitiesObj[capability].value;
        } else if (device.capabilityValues && device.capabilityValues[capability] !== undefined) {
          initialValue = device.capabilityValues[capability];
        } else if (device.state && device.state[capability] !== undefined) {
          initialValue = device.state[capability];
        }
        
        this.logger.input(`[${input.toUpperCase()}] Received initial value:`, initialValue);
        
        if (initialValue !== null && initialValue !== undefined) {
          const boolValue = this.convertToBoolean(initialValue, capability);
          this.logger.debug(`[${input.toUpperCase()}] Converted value: ${initialValue} → ${boolValue}`);

          for (const formula of this.formulas) {
            formula.inputStates[input] = boolValue;
          }
        } else {
          this.logger.warn(`[${input.toUpperCase()}] No initial value found - waiting for first event`);
        }

      } catch (e) {
        this.logger.error(`[${input.toUpperCase()}] Error fetching initial value:`, e.message);
      }
    }
  }

  async refetchInputsAndEvaluate(source = 'unknown') {
    this.logger.info(`Refetch and evaluate invoked (source=${source})`);
    let links = [];
    try {
      const settings = this.getSettings();
      links = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.logger.error('Failed to parse input_links during refetch:', e.message);
    }

    if (!Array.isArray(links) || links.length === 0) {
      this.logger.warn('No input links available during refetch; skipping value fetch.');
      await this.evaluateAllFormulasInitial();
      return;
    }

    this.inputLinks = links;

    this.logger.debug('Refetching initial values before evaluation...');
    await this.fetchInitialValues(links);
    await this.evaluateAllFormulasInitial();
  }

  async setupDeviceListener(link) {
    const { input, deviceId, capability, deviceName } = link;
    
    this.logger.debug(`Setting up listener for input ${input.toUpperCase()}`, { deviceName, deviceId, capability });
    
    if (!input || !deviceId || !capability) {
      this.logger.error(`Invalid link configuration for input ${input?.toUpperCase()}`, link);
      return;
    }
    
    try {
      if (!this.homey.app.api) {
        this.logger.error(`App API not available for listener setup`);
        return;
      }

      const targetDevice = await this.homey.app.api.devices.getDevice({ id: deviceId });
      
      if (!targetDevice) {
        this.logger.error(`Device not found for listener: ${deviceId}`);
        return;
      }
      this.logger.debug(`Found device: ${targetDevice.name}`);

      if (!targetDevice.capabilities || !targetDevice.capabilities.includes(capability)) {
        this.logger.error(`Device is missing capability: ${capability}`, { available: targetDevice.capabilities });
        return;
      }
      this.logger.debug(`Device has capability: ${capability}`);

      const listenerFn = async (value) => {
        if (this._isDeleting) return;
        
        this.logger.input(`Event received for input ${input.toUpperCase()}`, { device: targetDevice.name, capability, rawValue: value });
        
        const boolValue = this.convertToBoolean(value, capability);
        this.logger.debug(`Converted boolean value: ${boolValue}`);
        
        for (const formula of this.formulas) {
          try {
            await this.setInputForFormula(formula.id, input, boolValue);
          } catch (err) {
            if (!this._isDeleting) this.logger.error('setInputForFormula error:', err);
          }
        }
      };
      
      this.logger.debug(`Registering capability listener for ${capability}...`);
      const capabilityInstance = targetDevice.makeCapabilityInstance(capability, listenerFn);
      
      const listenerKey = `${input}-${deviceId}-${capability}`;
      this.deviceListeners.set(listenerKey, {
        unregister: () => capabilityInstance.destroy(),
      });
      
      this.logger.debug(`Listener setup complete for input ${input.toUpperCase()}`);
    } catch (e) {
      this.logger.error(`Setup for listener on input ${input.toUpperCase()} failed:`, e.message);
      this.logger.debug(e.stack);
    }
  }


  convertToBoolean(value, capability) {
    if (typeof value === 'boolean') return value;
    if (capability.startsWith('alarm_')) return !!value;
    if (capability === 'onoff') return !!value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'on' || lowerValue === 'yes';
    }
    return !!value;
  }

  async safeSetCapabilityValue(cap, value) {
    if (this._isDeleting) return;
    try {
      if (!this.hasCapability(cap)) return;
      await this.setCapabilityValue(cap, value);
    } catch (e) {
      const msg = e?.message || '';
      if (e?.statusCode === 404 || /not\s*found/i.test(msg)) {
        this.logger.debug(`(safe) Skipping ${cap} – device no longer exists.`);
        return;
      }
      this.logger.error(`Capability update failed for ${cap}:`, msg);
    }
  }

  async setInputForFormula(formulaId, inputId, value) {
    if (this._isDeleting) return null;
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      return null;
    }

    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.logger.warn(`Input '${inputId.toUpperCase()}' locked for formula '${formula.name}' (firstImpression mode)`);
      return formula.result;
    }

    const oldValue = formula.inputStates[inputId];
    this.logger.debug(`Setting input '${inputId.toUpperCase()}' to ${value} for formula '${formula.name}' (was: ${oldValue})`);

    formula.inputStates[inputId] = value;
    formula.timedOut = false;

    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
      this.logger.debug(`🔒 Input '${inputId.toUpperCase()}' locked at value ${value} (firstImpression mode)`);
    }

    if (value !== 'undefined') {
      formula.lastInputTime = Date.now();
    }

    return await this.evaluateFormula(formulaId);
  }

  async evaluateFormula(formulaId, resetLocks = false) {
    if (this._isDeleting) return null;
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula || !formula.enabled) {
      this.logger.debug(`Formula '${formulaId}' not found or disabled.`);
      return null;
    }

    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach(id => {
        formula.lockedInputs[id] = false;
      });
      this.logger.debug(`🔓 Unlocked all inputs for formula '${formula.name}'`);
    }

    const expression = formula.expression;
    if (!expression) {
      this.logger.debug('No expression set, cannot evaluate.');
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allInputsDefined = requiredInputs.every(id =>
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );

    if (!allInputsDefined) {
      this.logger.debug(`Formula '${formula.name}': Waiting for inputs. Required: [${requiredInputs.join(', ')}]`);
      return null;
    }

    const values = {};
    this.availableInputs.forEach(id => {
      values[id.toUpperCase()] = formula.inputStates[id];
    });

    let evalExpression = expression
      .replace(/\bAND\b|&|\*/gi, '&&')
      .replace(/\bOR\b|\||\+/gi, '||')
      .replace(/\bXOR\b|\^|!=/gi, '!=')
      .replace(/\bNOT\b/gi, '!');

    for (const key in values) {
      if (values[key] !== 'undefined') {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        evalExpression = evalExpression.replace(regex, values[key]);
      }
    }

    this.logger.formula(`Evaluating: "${expression}" → "${evalExpression}"`);

    try {
      const evaluate = new Function(`return ${evalExpression}`);
      const result = !!evaluate();

      this.logger.debug(`Formula '${formula.name}' result: ${result}`);

      const previousResult = formula.result;
      formula.result = result;
      formula.timedOut = false;

      try {
        await this.safeSetCapabilityValue('onoff', result);
        await this.safeSetCapabilityValue('alarm_generic', result);
      } catch (e) {
        if (e.statusCode === 404) {
          this.logger.debug('Device deleted, skipping capability update');
          return null;
        }
        throw e;
      }

      if (previousResult !== null && previousResult !== result) {
        const triggerData = { formula: { id: formulaId, name: formula.name } };
        const state = { formulaId };

        try {
          this.logger.flow(`Triggering flow for formula '${formula.name}' change to ${result}`);
          if (result) {
            await this.homey.flow.getDeviceTriggerCard('formula_changed_to_true')
              .trigger(this, triggerData, state);
          } else {
            await this.homey.flow.getDeviceTriggerCard('formula_changed_to_false')
              .trigger(this, triggerData, state);
          }

          await this.homey.flow.getDeviceTriggerCard('device_state_changed')
            .trigger(this, { state: result }, {});

        } catch (e) {
          if (e.statusCode === 404) {
            this.logger.debug('Device deleted, skipping flow trigger');
            return null;
          }
          this.logger.error('Error triggering flow:', e);
        }
      }

      return result;

    } catch (e) {
      this.logger.error(`Failed to evaluate formula '${formula.name}': ${e.message}`);
      return null;
    }
  }

  async evaluateAllFormulasInitial() {
    this.logger.info('Initial evaluation of all formulas...');

    let anyEvaluated = false;

    for (const formula of this.formulas) {
      if (!formula.enabled) continue;

      const expression = formula.expression;
      if (!expression) continue;

      const requiredInputs = this.parseExpression(expression);
      if (requiredInputs.length === 0) continue;

      const allInputsDefined = requiredInputs.every(id =>
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );

      if (allInputsDefined) {
        this.logger.debug(`Formula '${formula.name}': All inputs defined, evaluating...`);
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        requiredInputs.forEach(id => {
          states[id] = formula.inputStates[id.toLowerCase()];
        });
        this.logger.debug(`Formula '${formula.name}': Missing inputs:`, states);
      }
    }

    if (!anyEvaluated) {
      this.logger.warn('No formulas could be evaluated - waiting for input values');
      await this.safeSetCapabilityValue('onoff', false);
      await this.safeSetCapabilityValue('alarm_generic', false);
    }
  }

  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase();
    if (!inputs.length) return [];
    const varRe = new RegExp(`\\b(${inputs.join('|')})\\b`, 'gi');
    const matches = expression.match(varRe);
    return matches ? [...new Set(matches.map(c => c.toUpperCase()))] : [];
  }

  validateExpression(expression) {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression cannot be empty' };
    }

    const upper = expression.toUpperCase();
    const inputs = this.getAvailableInputsUppercase();
    if (!inputs.length) return { valid: false, error: 'No inputs available' };

    const tokenRe = new RegExp(
      `\\b(?:AND|OR|XOR|NOT)\\b|&&|\\|\\||\\^|!=|\\*|\\+|!|\\(|\\)|\\b(?:${inputs.join('|')})\\b`,
      'gi'
    );

    const stripped = upper.replace(tokenRe, '').replace(/\s+/g, '');
    if (stripped.length > 0) {
      return { valid: false, error: `Invalid tokens in expression: "${stripped}"` };
    }

    let depth = 0;
    for (const ch of upper) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth < 0) return { valid: false, error: 'Unbalanced parentheses' };
    }
    if (depth !== 0) return { valid: false, error: 'Unbalanced parentheses' };

    let testExpr = upper
      .replace(/\bAND\b|&&|\*/g, '&&')
      .replace(/\bOR\b|\|\||\+/g, '||')
      .replace(/\bXOR\b|\^|!=/g, '!=')
      .replace(/\bNOT\b|!/g, '!');

    for (const key of inputs) {
      const re = new RegExp(`\\b${key}\\b`, 'g');
      testExpr = testExpr.replace(re, 'true');
    }

    try {
      const fn = new Function(`return ${testExpr}`);
      void fn();
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
      this.logger.warn(`getFormulaResult: Formula '${formulaId}' not found`);
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
    this.logger.info('Re-evaluating all formulas (resetting locks)...');
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => {
          formula.lockedInputs[id] = false;
        });
        this.logger.debug(`🔓 Unlocked all inputs for formula '${formula.name}'`);
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    this.logger.debug(`Evaluated ${results.length} formulas`);
    return results;
  }

  startTimeoutChecks() {
    this.timeoutInterval = setInterval(() => {
      this.checkTimeouts();
    }, 1000);
  }

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
        this.logger.info(`Formula '${formula.name}' timed out after ${formula.timeout}s`);
        formula.timedOut = true;

        const triggerData = { formula: { id: formula.id, name: formula.name } };
        const state = { formulaId: formula.id };
        this.homey.flow.getDeviceTriggerCard('formula_timeout')
          .trigger(this, triggerData, state)
          .catch(err => this.logger.error('Error triggering timeout:', err));
      }
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.logger.info('Settings changed:', changedKeys);

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    if (changedKeys.includes('formulas') || changedKeys.includes('input_links')) {
      const detectedInputs = this.detectRequiredInputs(newSettings);
      const originalNumInputs = this.getData().numInputs ?? 2;
      const newNumInputs = Math.max(detectedInputs, originalNumInputs);
      if (newNumInputs !== this.numInputs) {
        this.logger.info(`Updating capacity: ${this.numInputs} → ${newNumInputs} inputs`);
        this.numInputs = newNumInputs;
        this.availableInputs = this.getAvailableInputIds();
      }
    }

    const formatSettings = {};
    let needsFormat = false;

    let parsedFormulas = [];
    if (changedKeys.includes('formulas')) {
      try {
        let rawFormulas = newSettings.formulas;
        this.logger.debug('Raw formulas input from settings:', rawFormulas);
        parsedFormulas = typeof rawFormulas === 'string' ? JSON.parse(rawFormulas) : rawFormulas;
        
        const formatted = JSON.stringify(parsedFormulas, null, 2);
        const original = typeof newSettings.formulas === 'string' ? newSettings.formulas : JSON.stringify(newSettings.formulas);
        if (formatted !== original) {
          formatSettings.formulas = formatted;
          needsFormat = true;
          this.logger.debug('Will auto-format formulas JSON');
        }
      } catch (e) {
        this.logger.error('Could not parse formulas:', e.message);
        throw new Error(`Invalid formulas JSON: ${e.message}`);
      }
    }

    let parsedLinks = [];
    if (changedKeys.includes('input_links')) {
      try {
        let rawLinks = newSettings.input_links;
        this.logger.debug('Raw input_links from settings:', rawLinks);
        parsedLinks = typeof rawLinks === 'string' ? JSON.parse(rawLinks) : rawLinks;

        const formatted = JSON.stringify(parsedLinks, null, 2);
        const original = typeof newSettings.input_links === 'string' ? newSettings.input_links : JSON.stringify(newSettings.input_links);
        if (formatted !== original) {
          formatSettings.input_links = formatted;
          needsFormat = true;
          this.logger.debug('Will auto-format input_links JSON');
        }
      } catch (e) {
        this.logger.error('Could not parse input_links:', e.message);
        throw new Error(`Invalid input_links JSON: ${e.message}`);
      }
    }

    if (changedKeys.includes('formulas')) {
      this.formulas = parsedFormulas.map(f => ({
        id: f.id, name: f.name, expression: f.expression,
        enabled: f.enabled !== false, timeout: f.timeout ?? 0, firstImpression: f.firstImpression === true,
        inputStates: {}, lockedInputs: {}, lastInputTime: null, result: null, timedOut: false,
      }));
      this.availableInputs.forEach(id => {
        this.formulas.forEach(f => {
          f.inputStates[id] = 'undefined';
          f.lockedInputs[id] = false;
        });
      });
      this.logger.debug(`Re-initialized ${this.formulas.length} formulas`);
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(`Formula '${formula.name}': ${validation.error}`);
        }
      }
    }

    if (changedKeys.includes('input_links')) {
      await this.setupDeviceLinks();
      await this.evaluateAllFormulasInitial();
    }

    if (changedKeys.includes('formulas') && !changedKeys.includes('input_links')) {
      await this.refetchInputsAndEvaluate('formulas-change');
    }

    this.startTimeoutChecks();
    this.logger.info('Settings applied successfully');

    if (needsFormat) {
      setTimeout(async () => {
        try {
          this.logger.debug('Applying auto-formatted settings...');
          await this.setSettings(formatSettings);
          this.logger.info('Settings auto-formatted');
        } catch (e) {
          this.logger.error('Failed to auto-format settings:', e.message);
        }
      }, 500);
    }
  }

  async pollDeviceInputs() {
    this.logger.debug('Polling all linked device inputs...');

    const links = this.inputLinks || [];
    if (!links.length) {
      this.logger.warn('No inputLinks available for polling');
      return;
    }
    if (!this.homey.app.api) {
      this.logger.error('App API not available for polling');
      return;
    }

    for (const link of links) {
      this.logger.debug(`Polling input "${link.input}" from device "${link.deviceId}" capability "${link.capability}"`);
      try {
        const dev = await this.homey.app.api.devices.getDevice({ id: link.deviceId });
        if (!dev) {
          this.logger.warn(`Device not found: ${link.deviceId}`);
          continue;
        }

        let raw = null;
        if (dev.capabilitiesObj && dev.capabilitiesObj[link.capability]) {
          raw = dev.capabilitiesObj[link.capability].value;
        } else if (dev.capabilityValues && dev.capabilityValues[link.capability] !== undefined) {
          raw = dev.capabilityValues[link.capability];
        } else if (dev.state && dev.state[link.capability] !== undefined) {
          raw = dev.state[link.capability];
        }

        if (raw === null || raw === undefined) {
          this.logger.warn(`No value for ${link.input.toUpperCase()} (${link.capability})`);
          continue;
        }

        const boolValue = this.convertToBoolean(raw, link.capability);
        this.logger.input(`Polled ${link.input.toUpperCase()}: ${raw} → ${boolValue}`);

        for (const formula of this.formulas) {
          formula.inputStates[link.input] = boolValue;
          if (boolValue !== 'undefined') {
            formula.lastInputTime = Date.now();
          }
        }
      } catch (e) {
        this.logger.error(`Failed to poll ${link.input}:`, e.message);
      }
    }
  }

  async onDeleted() {
    this._isDeleting = true;
    this.logger.device('Device deleted — cleaning up listeners & timers');

    for (const [key, entry] of this.deviceListeners.entries()) {
      try {
        if (typeof entry?.unregister === 'function') {
          await entry.unregister();
          this.logger.debug(`Unregistered listener: ${key}`);
        }
      } catch (e) {
        this.logger.error('Error cleaning up listener:', e);
      }
    }
    this.deviceListeners.clear();

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }

    if (this.pollingIntervals && typeof this.pollingIntervals.clear === 'function') {
      try { this.pollingIntervals.clear(); } catch (_) {}
    }

    this.logger.info('Cleanup complete');
  }
};
