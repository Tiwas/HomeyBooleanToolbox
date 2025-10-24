'use strict';

const Homey = require('homey');
const Logger = require('../../lib/Logger');

module.exports = class LogicDeviceDevice extends Homey.Device {

  async onInit() {
    const driverName = `Device: ${this.driver.id}`;
    this.logger = new Logger(this, driverName);

    // Kall med nøkkel og data separat
    this.logger.device('device.initializing', { name: this.getName() });

    const settings = this.getSettings();
    const detectedInputs = this.detectRequiredInputs(settings);

    const originalNumInputs = this.getData().numInputs || 2;
    this.numInputs = Math.max(detectedInputs, originalNumInputs);

    if (detectedInputs > originalNumInputs) {
      // Kall med nøkkel og data separat
      this.logger.info('device.capacity_expanded', {
        detected: detectedInputs,
        original: originalNumInputs
      });
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
      // Kall med nøkkel
      this.logger.debug('device.capability_readonly');
    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.warn('device.capability_options_failed', { message: e.message });
    }

    await this.initializeFormulas();
    await this.setupDeviceLinks();

    // Kall med nøkkel
    this.logger.info('evaluation.running_initial');
    await this.evaluateAllFormulasInitial();

    this.startTimeoutChecks();

    // Kall med nøkkel og data separat
    this.logger.info('device.initialized', {
      name: this.getName(),
      count: this.numInputs
    });
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

      // Kall med nøkkel og data separat
      this.logger.debug('device.max_input_detected', {
        input: String.fromCharCode(64 + maxInput),
        count: maxInput
      });

    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.error('parse.error_detecting_inputs', { message: e.message });
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
      // Kall med nøkkel og data separat
      this.logger.error('parse.error_formulas', { message: e.message });
      this.formulas = [];
    }

    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: 'formula_1',
        name: this.homey.__('formula.default_name'),
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

    // Kall med nøkkel og data separat
    this.logger.info('formula.initialized', { count: this.formulas.length });
    this.formulas.forEach(f => {
      // Kall med nøkkel og data separat
      this.logger.debug('formula.details', {
        name: f.name,
        expression: f.expression,
        enabled: f.enabled
      });
    });
  }

  getDefaultExpression() {
    const inputs = this.getAvailableInputsUppercase();
    return inputs.join(' AND ');
  }

  async setupDeviceLinks() {
    // Kall med nøkkel
    this.logger.info('devicelinks.setting_up');

    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) {
          await listener.unregister();
          // Kall med nøkkel og data separat
          this.logger.debug('devicelinks.unregistered', { key });
        }
      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('devicelinks.error_unregister', { message: e.message });
      }
    }
    this.deviceListeners.clear();

    const settings = this.getSettings();
    let inputLinks = [];
    try {
      inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.error('parse.error_input_links', { message: e.message });
      return;
    }

    this.inputLinks = inputLinks;

    // Kall med nøkkel og data separat
    this.logger.debug('devicelinks.count', { count: inputLinks.length });
    for (const link of inputLinks) {
      try {
        await this.setupDeviceListener(link);
      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('devicelinks.setup_failed', { input: link.input, message: e.message });
      }
    }

    // Kall med nøkkel
    this.logger.debug('initial.fetching_all');
    await this.fetchInitialValues(inputLinks);

    // Kall med nøkkel
    this.logger.info('devicelinks.complete');
  }


  async fetchInitialValues(inputLinks) {
    if (!this.homey.app.api) {
      // Kall med nøkkel
      this.logger.error('initial.api_unavailable');
      return;
    }

    for (const link of inputLinks) {
      const { input, deviceId, capability } = link;
      if (!input || !deviceId || !capability) continue;

      try {
        // Kall med nøkkel og data separat
        this.logger.debug('initial.fetching_input', { input: input.toUpperCase() });
        const device = await this.homey.app.api.devices.getDevice({ id: deviceId });
        if (!device) {
          // Kall med nøkkel og data separat
          this.logger.warn('initial.device_not_found', { input: input.toUpperCase() });
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

        this.logger.input('initial.received_value', { input: input.toUpperCase(), value: initialValue });

        if (initialValue !== null && initialValue !== undefined) {
          const boolValue = this.convertToBoolean(initialValue, capability);
          // Kall med nøkkel og data separat
          this.logger.debug('initial.value_received', {
            input: input.toUpperCase(),
            value: initialValue,
            boolean: boolValue
          });

          for (const formula of this.formulas) {
            formula.inputStates[input] = boolValue;
          }
        } else {
          this.logger.warn('initial.no_value_waiting', { input: input.toUpperCase() });
        }

      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('initial.error', { input: input.toUpperCase(), message: e.message });
      }
    }
  }

  async refetchInputsAndEvaluate(source = 'unknown') {
    this.logger.info('refetch.invoked', { source: source });
    let links = [];
    try {
      const settings = this.getSettings();
      links = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.logger.error('refetch.parse_failed', { message: e.message });
    }

    if (!Array.isArray(links) || links.length === 0) {
      this.logger.warn('refetch.no_links');
      await this.evaluateAllFormulasInitial();
      return;
    }

    this.inputLinks = links;

    this.logger.debug('refetch.fetching_values');
    await this.fetchInitialValues(links);
    await this.evaluateAllFormulasInitial();
  }

  async setupDeviceListener(link) {
    const { input, deviceId, capability, deviceName } = link;

    this.logger.debug('listener.setting_up', { input: input.toUpperCase(), deviceName, deviceId, capability });

    if (!input || !deviceId || !capability) {
      this.logger.error('listener.invalid_config', { input: input?.toUpperCase() });
      return;
    }

    try {
      if (!this.homey.app.api) {
        this.logger.error('listener.api_unavailable');
        return;
      }

      const targetDevice = await this.homey.app.api.devices.getDevice({ id: deviceId });

      if (!targetDevice) {
        // Kall med nøkkel og data separat
        this.logger.error('listener.device_not_found', {
          input: input.toUpperCase(),
          device: deviceId
        });
        return;
      }
      this.logger.debug('listener.device_found', { device: targetDevice.name });

      if (!targetDevice.capabilities || !targetDevice.capabilities.includes(capability)) {
        // Kall med nøkkel og data separat
        this.logger.error('listener.capability_not_exist', {
          input: input.toUpperCase(),
          capability,
          device: deviceId,
          available: targetDevice.capabilities
        });
        return;
      }
      this.logger.debug('listener.capability_found', { capability: capability });

      const listenerFn = async (value) => {
        if (this._isDeleting) return;

        this.logger.input('listener.event_received', { input: input.toUpperCase(), device: targetDevice.name, capability, value });

        const boolValue = this.convertToBoolean(value, capability);
        // Kall med nøkkel og data separat
        this.logger.debug('listener.capability_changed', {
          input: input.toUpperCase(),
          capability,
          value,
          boolean: boolValue
        });

        for (const formula of this.formulas) {
          try {
            await this.setInputForFormula(formula.id, input, boolValue);
          } catch (err) {
            if (!this._isDeleting) this.logger.error('formula.set_input_error', { message: err.message });
          }
        }
      };

      this.logger.debug('listener.registering', { capability: capability });
      const capabilityInstance = targetDevice.makeCapabilityInstance(capability, listenerFn);

      const listenerKey = `${input}-${deviceId}-${capability}`;
      this.deviceListeners.set(listenerKey, {
        unregister: () => capabilityInstance.destroy(),
      });

      // Kall med nøkkel og data separat
      this.logger.debug('listener.registered', {
        input: input.toUpperCase(),
        device: targetDevice.name,
        capability
      });
    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.error('listener.error_setup', { input: input.toUpperCase(), message: e.message });
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
        // Kall med nøkkel og data separat
        this.logger.debug('device.capability_skip_deleted', { capability: cap });
        return;
      }
      // Kall med nøkkel og data separat
      this.logger.error('device.capability_update_failed', { capability: cap, message: msg });
    }
  }

  async setInputForFormula(formulaId, inputId, value) {
    if (this._isDeleting) return null;
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      return null;
    }

    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.logger.warn('inputs.locked_first_impression', { input: inputId.toUpperCase(), formula: formula.name });
      return formula.result;
    }

    const oldValue = formula.inputStates[inputId];
    this.logger.debug('inputs.setting_value', { input: inputId.toUpperCase(), value, formula: formula.name, oldValue });

    formula.inputStates[inputId] = value;
    formula.timedOut = false;

    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
      this.logger.debug('inputs.locked_at_value', { input: inputId.toUpperCase(), value });
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
      this.logger.debug('formula.not_found_or_disabled', { id: formulaId });
      return null;
    }

    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach(id => {
        formula.lockedInputs[id] = false;
      });
      this.logger.debug('formula.unlocked_inputs', { name: formula.name });
    }

    const expression = formula.expression;
    if (!expression) {
      this.logger.debug('formula.no_expression');
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allInputsDefined = requiredInputs.every(id =>
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );

    if (!allInputsDefined) {
      this.logger.debug('formula.waiting_for_inputs', { name: formula.name, required: requiredInputs.join(', ') });
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

    this.logger.formula('formula.evaluating_expression', { expression, evalExpression });

    try {
      const evaluate = new Function(`return ${evalExpression}`);
      const result = !!evaluate();

      this.logger.debug('formula.result', { name: formula.name, result });

      const previousResult = formula.result;
      formula.result = result;
      formula.timedOut = false;

      try {
        await this.safeSetCapabilityValue('onoff', result);
        await this.safeSetCapabilityValue('alarm_generic', result);
      } catch (e) {
        if (e.statusCode === 404) {
          this.logger.debug('device.deleted_skip_update');
          return null;
        }
        throw e;
      }

      if (previousResult !== null && previousResult !== result) {
        const triggerData = { formula: { id: formula.id, name: formula.name } };
        const state = { formulaId };

        try {
          this.logger.flow('flow.triggered', { name: formula.name, result: result });
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
            this.logger.debug('device.deleted_skip_flow');
            return null;
          }
          this.logger.error('flow.trigger_error', { message: e.message });
        }
      }

      return result;

    } catch (e) {
      this.logger.error('formula.evaluation_failed', { name: formula.name, message: e.message });
      return null;
    }
  }

  async evaluateAllFormulasInitial() {
    // Kall med nøkkel
    this.logger.info('evaluation.initial_complete');

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
        this.logger.debug('formula.all_inputs_defined', { name: formula.name });
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        requiredInputs.forEach(id => {
          states[id] = formula.inputStates[id.toLowerCase()];
        });
        this.logger.debug('formula.missing_inputs', { name: formula.name });
      }
    }

    if (!anyEvaluated) {
      this.logger.warn('evaluation.no_formulas_ready');
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
      return { valid: false, error: this.homey.__('formula.expression_empty') };
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
      return { valid: false, error: this.homey.__('formula.invalid_tokens', { tokens: stripped }) };
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
      return { valid: false, error: this.homey.__('formula.invalid_syntax', { message: e.message }) };
    }
  }

  getFormulas() {
    return this.formulas
      .filter(f => f.enabled)
      .map(f => ({
        id: f.id,
        name: f.name,
        description: f.expression || this.homey.__('formula.no_expression')
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
      this.logger.warn('formula.get_result_not_found', { id: formulaId });
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
    this.logger.info('evaluation.reevaluating_all');
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => {
          formula.lockedInputs[id] = false;
        });
        this.logger.debug('formula.unlocked_inputs', { name: formula.name });
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    // Kall med nøkkel og data separat
    this.logger.debug('formula.evaluated_count', { count: results.length });
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
        // Kall med nøkkel og data separat
        this.logger.info('formula.timed_out', {
          name: formula.name,
          timeout: formula.timeout
        });
        formula.timedOut = true;

        const triggerData = { formula: { id: formula.id, name: formula.name } };
        const state = { formulaId: formula.id };
        this.homey.flow.getDeviceTriggerCard('formula_timeout')
          .trigger(this, triggerData, state)
          // Kall med nøkkel og data separat
          .catch(err => this.logger.error('timeout.error', { message: err.message }));
      }
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    // Kall med nøkkel og data separat
    this.logger.info('settings.changed', { keys: changedKeys.join(', ') });

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    if (changedKeys.includes('formulas') || changedKeys.includes('input_links')) {
      const detectedInputs = this.detectRequiredInputs(newSettings);
      const originalNumInputs = this.getData().numInputs ?? 2;
      const newNumInputs = Math.max(detectedInputs, originalNumInputs);
      if (newNumInputs !== this.numInputs) {
        // Kall med nøkkel og data separat
        this.logger.info('device.capacity_updated', {
          old: this.numInputs,
          new: newNumInputs
        });
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
        // Kall med nøkkel og data separat
        this.logger.debug('debug.raw_formulas', { formulas: rawFormulas });
        parsedFormulas = typeof rawFormulas === 'string' ? JSON.parse(rawFormulas) : rawFormulas;

        const formatted = JSON.stringify(parsedFormulas, null, 2);
        const original = typeof newSettings.formulas === 'string' ? newSettings.formulas : JSON.stringify(newSettings.formulas);
        if (formatted !== original) {
          formatSettings.formulas = formatted;
          needsFormat = true;
          // Kall med nøkkel og data separat
          this.logger.debug('settings.formatting', { type: 'formulas' });
        }
      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('parse.error_formulas_json', { message: e.message });
        throw new Error(this.homey.__('parse.error_formulas_invalid', { message: e.message }));
      }
    }

    let parsedLinks = [];
    if (changedKeys.includes('input_links')) {
      try {
        let rawLinks = newSettings.input_links;
        // Kall med nøkkel og data separat
        this.logger.debug('debug.raw_input_links', { links: rawLinks });
        parsedLinks = typeof rawLinks === 'string' ? JSON.parse(rawLinks) : rawLinks;

        const formatted = JSON.stringify(parsedLinks, null, 2);
        const original = typeof newSettings.input_links === 'string' ? newSettings.input_links : JSON.stringify(newSettings.input_links);
        if (formatted !== original) {
          formatSettings.input_links = formatted;
          needsFormat = true;
          // Kall med nøkkel og data separat
          this.logger.debug('settings.formatting', { type: 'input_links' });
        }
      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('parse.error_input_links', { message: e.message });
        throw new Error(this.homey.__('parse.error_input_links_invalid', { message: e.message }));
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
      // Kall med nøkkel og data separat
      this.logger.debug('formula.reinitialized', { count: this.formulas.length });
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(this.homey.__('formula.error_validation', {
            name: formula.name,
            error: validation.error
          }));
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
    // Kall med nøkkel
    this.logger.info('settings.applied');

    if (needsFormat) {
      setTimeout(async () => {
        try {
          // Kall med nøkkel
          this.logger.debug('settings.applying_formatted');
          await this.setSettings(formatSettings);
          // Kall med nøkkel
          this.logger.info('settings.auto_formatted');
        } catch (e) {
          // Kall med nøkkel og data separat
          this.logger.error('settings.format_failed', { message: e.message });
        }
      }, 500);
    }
  }

  async pollDeviceInputs() {
    // Kall med nøkkel
    this.logger.debug('polling.all_inputs');

    const links = this.inputLinks || [];
    if (!links.length) {
      // Kall med nøkkel
      this.logger.warn('polling.no_links');
      return;
    }
    if (!this.homey.app.api) {
      // Kall med nøkkel
      this.logger.error('polling.api_unavailable');
      return;
    }

    for (const link of links) {
      // Kall med nøkkel og data separat
      this.logger.debug('polling.input', {
        input: link.input,
        device: link.deviceId,
        capability: link.capability
      });
      try {
        const dev = await this.homey.app.api.devices.getDevice({ id: link.deviceId });
        if (!dev) {
          // Kall med nøkkel og data separat
          this.logger.warn('polling.device_not_found', { device: link.deviceId });
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
          // Kall med nøkkel og data separat
          this.logger.warn('polling.no_value', {
            input: link.input.toUpperCase(),
            capability: link.capability
          }); // FIKSET: Fjernet ekstra parentes her
          continue;
        }

        const boolValue = this.convertToBoolean(raw, link.capability);
        // Kall med nøkkel og data separat
        this.logger.input('polling.value_received', {
          input: link.input.toUpperCase(),
          value: raw,
          boolean: boolValue
        });

        for (const formula of this.formulas) {
          formula.inputStates[link.input] = boolValue;
          if (boolValue !== 'undefined') {
            formula.lastInputTime = Date.now();
          }
        }
      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('polling.failed', { input: link.input, message: e.message });
      }
    }
  }

  async onDeleted() {
    this._isDeleting = true;
    // Kall med nøkkel
    this.logger.device('device.deleted_cleanup');

    for (const [key, entry] of this.deviceListeners.entries()) {
      try {
        if (typeof entry?.unregister === 'function') {
          await entry.unregister();
          // Kall med nøkkel og data separat
          this.logger.debug('devicelinks.unregistered', { key });
        }
      } catch (e) {
        // Kall med nøkkel og data separat
        this.logger.error('devicelinks.error_cleanup', { message: e.message });
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

    // Kall med nøkkel
    this.logger.info('device.cleanup_complete');
  }
};

