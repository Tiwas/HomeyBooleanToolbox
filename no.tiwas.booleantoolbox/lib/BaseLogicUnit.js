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
        this.logger.debug(`(safe) Skipping ${cap} – device no longer exists.`);
        return;
      }
      this.logger.error(`Capability update failed for ${cap}:`, msg);
    }
  }

  async onInit() {
    const driverName = this.constructor.name || 'LogicDriver';
    this.logger = new Logger(this, driverName);

    this.logger.device(`Logic Unit '${this.getName()}' initializing.`);
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
      this.logger.error('Failed to parse formulas:', e);
      this.formulas = [];
    }

    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: 'formula_1',
        name: 'Formula 1',
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
        description: f.expression ?? '(no expression)'
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
      return { valid: false, error: 'Expression cannot be empty' };
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
      if (depth < 0) return { valid: false, error: 'Unbalanced parentheses' };
    }
    if (depth !== 0) return { valid: false, error: 'Unbalanced parentheses' };

    try {
      const fn = new Function(`return ${testExpr}`);
      void fn();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Invalid expression syntax: ${e.message}` };
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
      this.logger.warn(`Formula '${formulaId}' not found.`);
      return null;
    }

    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.logger.debug(
        `Input '${inputId.toUpperCase()}' is locked for '${formula.name}' (first impression) – ignoring update`
      );
      return formula.result;
    }

    const oldValue = formula.inputStates[inputId];
    this.logger.input(`Setting input '${inputId.toUpperCase()}' to ${value} for '${formula.name}' (was: ${oldValue})`);

    formula.inputStates[inputId] = value;
    formula.timedOut = false;

    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
      this.logger.debug(`🔒 Input '${inputId.toUpperCase()}' locked at value ${value} (first impression)`);
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
      this.availableInputs.forEach(id => { formula.lockedInputs[id] = false; });
      this.logger.debug(`🔓 Unlocked all inputs for formula '${formula.name}'`);
    }

    const expression = formula.expression;
    if (!expression) {
      this.logger.debug('No expression set, cannot evaluate.');
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allDefined = requiredInputs.every(id =>
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );
    if (!allDefined) {
      this.logger.debug(`Formula '${formula.name}': Waiting for inputs. Required: [${requiredInputs.join(', ')}]`);
      return null;
    }

    const values = {};
    this.availableInputs.forEach(id => { values[id.toUpperCase()] = formula.inputStates[id]; });

    this.logger.debug(`Formula '${formula.name}': Evaluating with inputs:`, values);

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

    this.logger.formula(`Evaluating: "${expression}" → "${evalExpression}"`);
    try {
      const fn = new Function(`return ${evalExpression}`);
      const result = !!fn();

      this.logger.debug(`Formula '${formula.name}' result: ${result}`);

      const previous = formula.result;
      formula.result = result;
      formula.timedOut = false;

      await this.safeSetCapabilityValue('onoff', result);

      return result;
    } catch (e) {
      this.logger.error(`Failed to evaluate formula '${formula.name}': ${e.message}`);
      return null;
    }
  }

  async evaluateAllFormulas() {
    this.logger.info('Re-evaluating all formulas (resetting locks)...');
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => { formula.lockedInputs[id] = false; });
        this.logger.debug(`🔓 Unlocked all inputs for formula '${formula.name}'`);
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    this.logger.debug(`Evaluated ${results.length} formulas`);
    return results;
  }

  getFormulaResult(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      this.logger.warn(`getFormulaResult: Formula '${formulaId}' not found`);
      return null;
    }
    this.logger.debug(
      `getFormulaResult: Formula '${formula.name}' (${formulaId}) result = ${formula.result} (type: ${typeof formula.result})`
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
    this.logger.info('Settings changed. Reinitializing formulas.');
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    this.initializeFormulas();
    await this.evaluateAllFormulasInitial();

    if (changedKeys.includes('formulas')) {
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(`Formula '${formula.name}': ${validation.error}`);
        }
      }
    }
    this.startTimeoutChecks();
  }

  async onDeleted() {
    this._isDeleting = true;
    this.logger.device('Logic Unit deleted — cleaning up timers');
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }
    this.logger.info('Cleanup complete');
  }

  async evaluateAllFormulasInitial() {
    this.logger.debug('Initial evaluation of all formulas...');
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
        this.logger.debug(`Formula '${formula.name}': All inputs defined, evaluating...`);
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        required.forEach(id => { states[id] = formula.inputStates[id.toLowerCase()]; });
        this.logger.debug(`Formula '${formula.name}': Missing inputs:`, states);
      }
    }

    if (!anyEvaluated) {
      this.logger.warn('No formulas could be evaluated - waiting for input values');
      await this.safeSetCapabilityValue('onoff', false);
    }
  }
};
