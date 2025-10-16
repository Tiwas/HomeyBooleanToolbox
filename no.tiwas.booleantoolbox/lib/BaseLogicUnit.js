'use strict';

const Homey = require('homey');

module.exports = class BaseLogicUnit extends Homey.Device {

  async onInit() {
    this.log(`Logic Unit '${this.getName()}' initializing.`);
    
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    
    // Get number of inputs from device data
    this.numInputs = this.getData().numInputs || 5;
    this.availableInputs = this.getAvailableInputIds();
    
    this.initializeFormulas();
    this.startTimeoutChecks();
  }

  getAvailableInputIds() {
    const allInputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    return allInputs.slice(0, this.numInputs);
  }

  getAvailableInputsUppercase() {
    return this.availableInputs.map(i => i.toUpperCase());
  }

  // Initialize formulas from settings
  initializeFormulas() {
    const settings = this.getSettings();
    try {
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];
      
      // Initialize each formula with its own input state and timeout
      this.formulas = formulasData.map(f => ({
        id: f.id,
        name: f.name,
        expression: f.expression,
        enabled: f.enabled !== false,
        timeout: f.timeout || 0,
        firstImpression: f.firstImpression !== false && f.firstImpression !== 0,
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false
      }));
      
      // Initialize input states for each formula
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
    
    // Ensure we have at least one default formula
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

  // Get all enabled formulas for autocomplete
  getFormulas() {
    return this.formulas
      .filter(f => f.enabled)
      .map(f => ({
        id: f.id,
        name: f.name,
        description: f.expression || '(no expression)'
      }));
  }

  // Get available inputs for dropdown
  getInputOptions() {
    return this.getAvailableInputsUppercase().map(input => ({
      id: input.toLowerCase(),
      name: input
    }));
  }

  // Validate boolean expression
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

  // Parse expression to find required inputs
  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase();
    const pattern = new RegExp(`\\b(${inputs.join('|')})\\b`, 'gi');
    const matches = expression.match(pattern);
    return matches ? [...new Set(matches.map(char => char.toUpperCase()))] : [];
  }

  // Set input value for a specific formula
  async setInputForFormula(formulaId, inputId, value) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      this.log(`Formula '${formulaId}' not found.`);
      return null;
    }
    
    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.log(`Input '${inputId.toUpperCase()}' is locked for formula '${formula.name}' (first impression mode) - ignoring update`);
      return formula.result;
    }
    
    this.log(`Setting input '${inputId.toUpperCase()}' to ${value} for formula '${formula.name}'${formula.firstImpression ? ' (first impression - locking)' : ''}`);
    
    formula.inputStates[inputId] = value;
    formula.timedOut = false;
    
    if (formula.firstImpression && value !== 'undefined') {
      formula.lockedInputs[inputId] = true;
      this.log(`🔒 Input '${inputId.toUpperCase()}' locked at value ${value}`);
    }
    
    if (value !== 'undefined') {
      formula.lastInputTime = Date.now();
    }
    
    return await this.evaluateFormula(formulaId);
  }

  // Evaluate specific formula by ID
  async evaluateFormula(formulaId, resetLocks = false) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula || !formula.enabled) {
      this.log(`Formula '${formulaId}' not found or disabled.`);
      return null;
    }

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

    this.log(`Evaluating: "${expression}" → "${evalExpression}"`);

    try {
      const evaluate = new Function(`return ${evalExpression}`);
      const result = !!evaluate();

      this.log(`✅ Formula '${formula.name}' result: ${result}`);
      formula.result = result;
      formula.timedOut = false;
      
      const triggerData = {
        formula: {
          id: formulaId,
          name: formula.name
        }
      };
      
      const state = {
        formulaId: formulaId
      };
      
      if (result) {
        await this.homey.flow.getDeviceTriggerCard('formula_changed_to_true')
          .trigger(this, triggerData, state);
      } else {
        await this.homey.flow.getDeviceTriggerCard('formula_changed_to_false')
          .trigger(this, triggerData, state);
      }

      return result;

    } catch (e) {
      this.error(`❌ Failed to evaluate formula '${formula.name}': ${e.message}`);
      return null;
    }
  }

  // Evaluate all enabled formulas
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

  // Get formula result
  getFormulaResult(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      this.log(`getFormulaResult: Formula '${formulaId}' not found`);
      return null;
    }
    
    this.log(`getFormulaResult: Formula '${formula.name}' (${formulaId}) result = ${formula.result} (type: ${typeof formula.result})`);
    return formula ? formula.result : null;
  }
  
  // Check if formula has timed out
  hasFormulaTimedOut(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) return false;
    return formula.timedOut;
  }
  
  // Start timeout checks
  startTimeoutChecks() {
    this.timeoutInterval = setInterval(() => {
      this.checkTimeouts();
    }, 1000);
  }
  
  // Check all formulas for timeouts
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
    this.log('Settings changed. Reinitializing formulas.');
    
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }
    
    this.initializeFormulas();
    
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
    this.log('Logic Unit has been deleted');
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }
  }
};