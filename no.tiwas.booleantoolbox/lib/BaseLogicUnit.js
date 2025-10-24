'use strict';
const Homey = require('homey');
const Logger = require('./Logger');

module.exports = class BaseLogicUnit extends Homey.Device {
  // Safe capability update (ignores 404, stops on deletion)
  async safeSetCapabilityValue(cap, value) {
    if (this._isDeleting) return;
    try {
      if (!this.hasCapability(cap)) return;
      await this.setCapabilityValue(cap, value);
    } catch (e) {
      const msg = e?.message || '';
      if (e?.statusCode === 404 || /not\s*found/i.test(msg)) {
        // FIKS: Send nøkkel og data-objekt
        this.logger.debug('device.capability_skip_deleted', { capability: cap });
        return;
      }
      // FIKS: Send nøkkel og data-objekt (msg er ikke et Error-objekt)
      this.logger.error('device.capability_update_failed', { capability: cap, message: msg });
    }
  }

  async onInit() {
    const driverName = `Device: ${this.driver.id}`;
    this.logger = new Logger(this, driverName);

    // FIKS: Send nøkkel og data-objekt
    this.logger.device('device.ready', { name: this.getName() });
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }

    this.numInputs = this.getData().numInputs ?? 5;
    this.availableInputs = this.getAvailableInputIds();

    this.initializeFormulas();
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

  initializeFormulas() {
    const settings = this.getSettings();
    try {
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];
      this.formulas = formulasData.map(f => ({
        id: f.id,
        name: f.name,
        expression: f.expression,
        enabled: f.enabled !== false,
        timeout: f.timeout ?? 0,
        firstImpression: f.firstImpression !== false && f.firstImpression !== 0,
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
      // FIKS: Send nøkkel og error-objekt
      this.logger.error('errors.invalid_formula', e);
      this.formulas = [];
    }

    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: 'formula_1',
        name: this.homey.__('formula.default_name_alt'),
        expression: this.getDefaultExpression(),
        enabled: true,
        timeout: 0,
        firstImpression: true,
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
    const inputs = this.getAvailableInputsUppercase();
    return inputs.join(' AND ');
  }

  getFormulas() {
    return this.formulas
      .filter(f => f.enabled)
      .map(f => ({
        id: f.id,
        name: f.name,
        description: f.expression ?? this.homey.__('formula.no_expression')
      }));
  }

  getInputOptions() {
    return this.getAvailableInputsUppercase().map(input => ({
      id: input.toLowerCase(),
      name: input
    }));
  }

  validateExpression(expression) {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: this.homey.__('formula.invalid') };
    }

    const inputs = this.getAvailableInputsUppercase();

    let testExpr = expression
      .toUpperCase()
      .replace(/\bAND\b|&&|\*/g, '&&')
      .replace(/\bOR\b|\|\||\+/g, '||')
      .replace(/\bXOR\b|\^|!=/g, '!=')
      .replace(/\bNOT\b|!/g, '!');

    for (const key of inputs) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      testExpr = testExpr.replace(regex, 'true');
    }

    let depth = 0;
    for (const ch of testExpr) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth < 0) return { valid: false, error: this.homey.__('formula.syntax_error') };
    }
    if (depth !== 0) return { valid: false, error: this.homey.__('formula.syntax_error') };

    try {
      const fn = new Function(`return ${testExpr}`);
      void fn();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: this.homey.__('formula.syntax_error') };
    }
  }

  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase();
    const pattern = new RegExp(`\\b(${inputs.join('|')})\\b`, 'gi');
    const matches = expression.match(pattern);
    return matches ? [...new Set(matches.map(char => char.toUpperCase()))] : [];
  }

  async setInputForFormula(formulaId, inputId, value) {
    if (this._isDeleting) return null;

    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      // FIKS: Send nøkkel
      this.logger.warn('errors.invalid_formula');
      return null;
    }

    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      // FIKS: Send nøkkel
      this.logger.debug('inputs.locked');
      return formula.result;
    }

    const oldValue = formula.inputStates[inputId];
    // FIKS: Send nøkkel
    this.logger.input('notifications.input_received');

    formula.inputStates[inputId] = value;
    formula.timedOut = false;

    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
      // FIKS: Send nøkkel
      this.logger.debug('inputs.locked');
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
      // FIKS: Send nøkkel
      this.logger.debug('errors.invalid_formula');
      return null;
    }

    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach(id => { formula.lockedInputs[id] = false; });
      // FIKS: Send nøkkel
      this.logger.debug('inputs.unlocked');
    }

    const expression = formula.expression;
    if (!expression) {
      // FIKS: Send nøkkel
      this.logger.debug('formula.invalid');
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allDefined = requiredInputs.every(id =>
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );
    if (!allDefined) {
      // FIKS: Send nøkkel
      this.logger.debug('inputs.waiting');
      return null;
    }

    const values = {};
    this.availableInputs.forEach(id => { values[id.toUpperCase()] = formula.inputStates[id]; });

    // FIKS: Send nøkkel
    this.logger.debug('formula.evaluating');

    let evalExpression = expression
      .replace(/\bAND\b|&&|\*/gi, '&&')
      .replace(/\bOR\b|\|\||\+/gi, '||')
      .replace(/\bXOR\b|\^|!=/gi, '!=')
      .replace(/\bNOT\b|!/gi, '!');

    for (const key in values) {
      if (values[key] !== 'undefined') {
        const re = new RegExp(`\\b${key}\\b`, 'gi');
        evalExpression = evalExpression.replace(re, values[key]);
      }
    }

    // FIKS: Send ren tekst, følger mønster fra device.js
    this.logger.formula(`Evaluating: "${expression}" → "${evalExpression}"`);
    try {
      const fn = new Function(`return ${evalExpression}`);
      const result = !!fn();

      // FIKS: Send nøkkel
      this.logger.debug('formula.evaluated');

      const previous = formula.result;
      formula.result = result;
      formula.timedOut = false;

      await this.safeSetCapabilityValue('onoff', result);

      return result;
    } catch (e) {
      // FIKS: Send nøkkel og error-objekt
      this.logger.error('errors.evaluation_failed', e);
      return null;
    }
  }

  async evaluateAllFormulas() {
    // FIKS: Send nøkkel
    this.logger.info('notifications.reevaluating');
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => { formula.lockedInputs[id] = false; });
        // FIKS: Send nøkkel
        this.logger.debug('inputs.unlocked');
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    // FIKS: Send nøkkel og data-objekt
    this.logger.debug('formula.evaluated_count', { count: results.length });
    return results;
  }

  getFormulaResult(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      // FIKS: Send nøkkel
      this.logger.warn('errors.invalid_formula');
      return null;
    }
    // FIKS: Send nøkkel og data-objekt
    this.logger.debug(
      'formula.result_debug', {
        name: formula.name,
        id: formulaId,
        result: formula.result,
        type: typeof formula.result
      }
    );
    return formula ? formula.result : null;
  }

  hasFormulaTimedOut(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) return false;
    return formula.timedOut;
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
        // FIKS: Send nøkkel og data-objekt
        this.logger.info('formula.timed_out', { name: formula.name, timeout: formula.timeout });
        formula.timedOut = true;

        const triggerData = { formula: { id: formula.id, name: formula.name } };
        const state = { formulaId: formula.id };
        this.homey.flow.getDeviceTriggerCard('formula_timeout')
          .trigger(this, triggerData, state)
          // FIKS: Send nøkkel og error-objekt
          .catch(err => this.logger.error('formula.error', err));
      }
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    // FIKS: Send nøkkel
    this.logger.info('notifications.formula_updated');
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    this.initializeFormulas();
    await this.evaluateAllFormulasInitial();

    if (changedKeys.includes('formulas')) {
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(this.homey.__('formula.error_validation', { name: formula.name, error: validation.error }));
        }
      }
    }
    this.startTimeoutChecks();
  }

  async onDeleted() {
    this._isDeleting = true;
    // FIKS: Send nøkkel
    this.logger.device('device.inactive');
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }
    // FIKS: Send nøkkel
    this.logger.info('device.cleanup_complete');
  }

  async evaluateAllFormulasInitial() {
    // FIKS: Send nøkkel
    this.logger.debug('evaluation.initial_complete');
    let anyEvaluated = false;

    for (const formula of this.formulas) {
      if (!formula.enabled) continue;
      const expr = formula.expression;
      if (!expr) continue;

      const required = this.parseExpression(expr);
      if (!required.length) continue;

      const allDefined = required.every(id =>
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );

      if (allDefined) {
        // FIKS: Send nøkkel
        this.logger.debug('formula.evaluating');
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        required.forEach(id => { states[id] = formula.inputStates[id.toLowerCase()]; });
        // FIKS: Send nøkkel
        this.logger.debug('inputs.waiting');
      }
    }

    if (!anyEvaluated) {
      // FIKS: Send nøkkel
      this.logger.warn('inputs.waiting');
      await this.safeSetCapabilityValue('onoff', false);
    }
  }
};
