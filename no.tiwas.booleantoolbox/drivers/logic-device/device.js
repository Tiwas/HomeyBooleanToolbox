'use strict';

const Homey = require('homey');

module.exports = class LogicDeviceDevice extends Homey.Device {

  async onInit() {
    const settings = this.getSettings();
    const detectedInputs = this.detectRequiredInputs(settings);
    const originalNumInputs = this.getData().numInputs || 2;
    this.numInputs = Math.max(detectedInputs, originalNumInputs);
    
    this.availableInputs = this.getAvailableInputIds();
    this.deviceListeners = new Map();
    
    if (!this.hasCapability('onoff')) await this.addCapability('onoff');
    if (!this.hasCapability('alarm_generic')) await this.addCapability('alarm_generic');
    
    try {
      await this.setCapabilityOptions('onoff', { setable: false, getable: true });
    } catch (e) {}
    
    await this.initializeFormulas();
    await this.setupDeviceLinks();
    await this.evaluateAllFormulasInitial();
    this.startTimeoutChecks();
  }

  getAvailableInputIds() {
    const allInputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    return allInputs.slice(0, this.numInputs);
  }

  getAvailableInputsUppercase() {
    return this.availableInputs.map(i => i.toUpperCase());
  }

  detectRequiredInputs(settings) {
    let maxInput = 2;
    
    try {
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];
      formulasData.forEach(formula => {
        if (!formula.expression) return;
        const matches = formula.expression.match(/\b([A-J])\b/gi);
        if (matches) {
          matches.forEach(letter => {
            const inputNumber = letter.toUpperCase().charCodeAt(0) - 64;
            maxInput = Math.max(maxInput, inputNumber);
          });
        }
      });
      
      const inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
      inputLinks.forEach(link => {
        if (link.input) {
          const inputNumber = link.input.toLowerCase().charCodeAt(0) - 96;
          maxInput = Math.max(maxInput, inputNumber);
        }
      });
    } catch (e) {
      this.error('Error detecting required inputs:', e.message);
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
  }

  getDefaultExpression() {
    return this.getAvailableInputsUppercase().join(' AND ');
  }

  async setupDeviceLinks() {
    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) await listener.unregister();
      } catch (e) {}
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

    for (const link of inputLinks) {
      try {
        await this.setupDeviceListener(link);
      } catch (e) {
        this.error(`Failed to setup listener for input ${link.input}:`, e);
      }
    }
    
    await this.fetchInitialValues(inputLinks);
  }

  async fetchInitialValues(inputLinks) {
    if (!this.homey.app.api) return;

    for (const link of inputLinks) {
      const { input, deviceId, capability } = link;
      if (!input || !deviceId || !capability) continue;

      try {
        const device = await this.homey.app.api.devices.getDevice({ id: deviceId });
        if (!device) continue;

        let initialValue = null;
        if (device.capabilitiesObj && device.capabilitiesObj[capability]) {
          initialValue = device.capabilitiesObj[capability].value;
        } else if (device.capabilityValues && device.capabilityValues[capability] !== undefined) {
          initialValue = device.capabilityValues[capability];
        } else if (device.state && device.state[capability] !== undefined) {
          initialValue = device.state[capability];
        }

        if (initialValue !== null && initialValue !== undefined) {
          const boolValue = this.convertToBoolean(initialValue, capability);
          for (const formula of this.formulas) {
            formula.inputStates[input] = boolValue;
          }
        }
      } catch (e) {}
    }
  }

  async setupDeviceListener(link) {
    const { input, deviceId, capability } = link;
    if (!input || !deviceId || !capability) return;

    try {
      if (!this.homey.app.api) return;
      
      const allDevices = await this.homey.app.api.devices.getDevices();
      const targetDevice = allDevices[deviceId];
      
      if (!targetDevice) return;
      if (!targetDevice.capabilities || !targetDevice.capabilities.includes(capability)) return;

      let initialValue = null;
      if (targetDevice.capabilityValues && targetDevice.capabilityValues[capability] !== undefined) {
        initialValue = targetDevice.capabilityValues[capability];
      } else if (targetDevice.capabilityInstances && targetDevice.capabilityInstances[capability]) {
        initialValue = targetDevice.capabilityInstances[capability].value;
      } else if (targetDevice.state && targetDevice.state[capability] !== undefined) {
        initialValue = targetDevice.state[capability];
      }
      
      if (initialValue !== null && initialValue !== undefined) {
        const boolValue = this.convertToBoolean(initialValue, capability);
        for (const formula of this.formulas) {
          formula.inputStates[input] = boolValue;
        }
      }

      const listenerFn = async (value) => {
        const boolValue = this.convertToBoolean(value, capability);
        for (const formula of this.formulas) {
          await this.setInputForFormula(formula.id, input, boolValue).catch(this.error);
        }
      };

      let registered = false;
      if (typeof targetDevice.makeCapabilityInstance === 'function') {
        try {
          targetDevice.makeCapabilityInstance(capability, listenerFn);
          registered = true;
        } catch (e) {}
      }
      
      if (!registered && typeof targetDevice.on === 'function') {
        try {
          targetDevice.on(`capability.${capability}`, listenerFn);
          registered = true;
        } catch (e) {}
      }
      
      this.deviceListeners.set(`${input}-${deviceId}-${capability}`, {
        deviceId, capability, input, device: targetDevice, listener: listenerFn, registered
      });
    } catch (e) {}
  }

  convertToBoolean(value, capability) {
    if (typeof value === 'boolean') return value;
    if (capability.startsWith('alarm_') || capability === 'onoff') return !!value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'on' || lowerValue === 'yes';
    }
    return !!value;
  }

  async setInputForFormula(formulaId, inputId, value) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) return null;
    if (formula.firstImpression && formula.lockedInputs[inputId]) return formula.result;
    
    formula.inputStates[inputId] = value;
    formula.timedOut = false;
    
    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
    }
    
    if (value !== 'undefined') {
      formula.lastInputTime = Date.now();
    }
    
    return await this.evaluateFormula(formulaId);
  }

  async evaluateFormula(formulaId, resetLocks = false) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula || !formula.enabled) return null;

    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach(id => formula.lockedInputs[id] = false);
    }

    const expression = formula.expression;
    if (!expression) return null;

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allInputsDefined = requiredInputs.every(id => 
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );
    if (!allInputsDefined) return null;

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
        evalExpression = evalExpression.replace(new RegExp(`\\b${key}\\b`, 'gi'), values[key]);
      }
    }

    try {
      const result = !!new Function(`return ${evalExpression}`)();
      const previousResult = formula.result;
      formula.result = result;
      formula.timedOut = false;
      
      try {
        await this.setCapabilityValue('onoff', result);
        await this.setCapabilityValue('alarm_generic', result);
      } catch (e) {
        if (e.statusCode === 404) return null;
        throw e;
      }
      
      if (previousResult !== null && previousResult !== result) {
        const triggerData = { formula: { id: formulaId, name: formula.name } };
        const state = { formulaId };
        
        try {
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
          if (e.statusCode === 404) return null;
        }
      }

      return result;
    } catch (e) {
      this.error(`Failed to evaluate formula '${formula.name}': ${e.message}`);
      return null;
    }
  }

  async evaluateAllFormulasInitial() {
    let anyEvaluated = false;
    for (const formula of this.formulas) {
      if (!formula.enabled || !formula.expression) continue;
      const requiredInputs = this.parseExpression(formula.expression);
      if (requiredInputs.length === 0) continue;
      const allInputsDefined = requiredInputs.every(id => 
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );
      if (allInputsDefined) {
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      }
    }
    if (!anyEvaluated) {
      await this.setCapabilityValue('onoff', false).catch(this.error);
      await this.setCapabilityValue('alarm_generic', false).catch(this.error);
    }
  }

  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase();
    const matches = expression.match(new RegExp(`\\b(${inputs.join('|')})\\b`, 'gi'));
    return matches ? [...new Set(matches.map(char => char.toUpperCase()))] : [];
  }

  validateExpression(expression) {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression cannot be empty' };
    }

    const inputs = this.getAvailableInputsUppercase();
    const validPattern = new RegExp(`^[${inputs.join('|')}\\s\\(\\)&|\\*\\+\\^!=ANDORXOTandorxot]+$`);
    if (!validPattern.test(expression)) {
      return { valid: false, error: `Invalid characters or inputs outside range (${inputs.join(', ')})` };
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
        testExpr = testExpr.replace(new RegExp(`\\b${key}\\b`, 'gi'), 'true');
      }
      new Function(`return ${testExpr}`)();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Invalid expression syntax: ${e.message}` };
    }
  }

  getFormulas() {
    return this.formulas.filter(f => f.enabled).map(f => ({
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
    return formula ? formula.result : null;
  }

  hasFormulaTimedOut(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    return formula ? formula.timedOut : false;
  }

  async evaluateAllFormulas() {
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => formula.lockedInputs[id] = false);
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    return results;
  }

  startTimeoutChecks() {
    this.timeoutInterval = setInterval(() => this.checkTimeouts(), 1000);
  }

  checkTimeouts() {
    const now = Date.now();
    this.formulas.forEach(formula => {
      if (!formula.timeout || formula.timeout <= 0 || formula.timedOut || !formula.enabled || !formula.lastInputTime) return;
      
      const hasAnyInput = this.availableInputs.some(id => formula.inputStates[id] !== 'undefined');
      if (!hasAnyInput) return;
      
      const requiredInputs = this.parseExpression(formula.expression);
      const allInputsDefined = requiredInputs.every(id => formula.inputStates[id.toLowerCase()] !== 'undefined');
      if (allInputsDefined) return;
      
      if (now - formula.lastInputTime >= formula.timeout * 1000) {
        formula.timedOut = true;
        this.homey.flow.getDeviceTriggerCard('formula_timeout')
          .trigger(this, { formula: { id: formula.id, name: formula.name } }, { formulaId: formula.id })
          .catch(() => {});
      }
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    if (this.timeoutInterval) clearInterval(this.timeoutInterval);

    if (changedKeys.includes('formulas') || changedKeys.includes('input_links')) {
      const detectedInputs = this.detectRequiredInputs(newSettings);
      const newNumInputs = Math.max(detectedInputs, this.getData().numInputs || 2);
      if (newNumInputs !== this.numInputs) {
        this.numInputs = newNumInputs;
        this.availableInputs = this.getAvailableInputIds();
      }
    }

    const formatSettings = {};
    let needsFormat = false;
    
    if (changedKeys.includes('formulas')) {
      try {
        let formulas = typeof newSettings.formulas === 'string' ? JSON.parse(newSettings.formulas) : newSettings.formulas;
        const formatted = JSON.stringify(formulas, null, 2);
        const original = typeof newSettings.formulas === 'string' ? newSettings.formulas : JSON.stringify(newSettings.formulas);
        if (formatted !== original) {
          formatSettings.formulas = formatted;
          needsFormat = true;
        }
      } catch (e) {}
    }
    
    if (changedKeys.includes('input_links')) {
      try {
        let links = typeof newSettings.input_links === 'string' ? JSON.parse(newSettings.input_links) : newSettings.input_links;
        const formatted = JSON.stringify(links, null, 2);
        const original = typeof newSettings.input_links === 'string' ? newSettings.input_links : JSON.stringify(newSettings.input_links);
        if (formatted !== original) {
          formatSettings.input_links = formatted;
          needsFormat = true;
        }
      } catch (e) {}
    }
        
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
      await this.evaluateAllFormulasInitial();
    }
    
    this.startTimeoutChecks();
    
    if (needsFormat) {
      setTimeout(async () => {
        try {
          await this.setSettings(formatSettings);
        } catch (e) {}
      }, 500);
    }
  }

  async onDeleted() {
    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) await listener.unregister();
      } catch (e) {}
    }
    this.deviceListeners.clear();
    if (this.timeoutInterval) clearInterval(this.timeoutInterval);
  }
};