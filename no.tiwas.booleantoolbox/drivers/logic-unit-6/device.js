'use strict';

const Homey = require('homey');

module.exports = class LogicUnitDevice extends Homey.Device {

  async onInit() {
    this.log(`Logic Unit '${this.getName()}' initializing.`);
    
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    
    // Get number of inputs from device data
    this.numInputs = this.getData().numInputs || 5;
    this.availableInputs = this.getAvailableInputIds();
    
    this.initializeState();
    this.initializeFormulas();
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
      this.formulas = settings.formulas ? JSON.parse(settings.formulas) : [];
    } catch (e) {
      this.error('Failed to parse formulas:', e);
      this.formulas = [];
    }
    
    // Ensure we have at least one default formula
    if (this.formulas.length === 0) {
      this.formulas = [{
        id: 'formula_1',
        name: 'Formula 1',
        expression: this.getDefaultExpression(),
        enabled: true
      }];
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

  // Reset all inputs to 'undefined'
  initializeState() {
    this.inputStates = {};
    this.formulaResults = {}; // Store results per formula
    this.availableInputs.forEach(id => {
      this.inputStates[id] = 'undefined';
    });
    this.log(`All ${this.numInputs} input states reset to undefined.`);
  }

  // Validate boolean expression
  validateExpression(expression) {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression cannot be empty' };
    }

    const inputs = this.getAvailableInputsUppercase();
    const inputPattern = inputs.join('|');
    
    // Check for invalid characters or inputs outside range
    const validPattern = new RegExp(`^[${inputPattern}\\s\\(\\)&|\\*\\+\\^!=ANDORXOTandorxot]+$`);
    if (!validPattern.test(expression)) {
      return { 
        valid: false, 
        error: `Expression contains invalid characters or inputs outside range (${inputs.join(', ')})` 
      };
    }

    // Check for balanced parentheses
    let depth = 0;
    for (const char of expression) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) return { valid: false, error: 'Unbalanced parentheses' };
    }
    if (depth !== 0) return { valid: false, error: 'Unbalanced parentheses' };

    // Test evaluation with dummy values
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

  // Set input value and evaluate specific formula
  async setInputAndEvaluateFormula(inputId, value, formulaId) {
    this.log(`Input '${inputId.toUpperCase()}' set to: ${value} for formula '${formulaId}'.`);
    this.inputStates[inputId] = value;
    
    const result = await this.evaluateFormula(formulaId);
    return result;
  }

  // Set input value and evaluate all formulas
  async setInputStateAndEvaluate(inputId, value) {
    this.log(`Input '${inputId.toUpperCase()}' set to: ${value}.`);
    this.inputStates[inputId] = value;
    
    // Evaluate all enabled formulas
    await this.evaluateAllFormulas();
  }

  // Evaluate specific formula by ID
  async evaluateFormula(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula || !formula.enabled) {
      this.log(`Formula '${formulaId}' not found or disabled.`);
      return null;
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
      this.inputStates[id.toLowerCase()] !== 'undefined'
    );
    
    if (!allInputsDefined) {
      this.log(`Formula '${formula.name}': Waiting for more inputs. Required: [${requiredInputs.join(', ')}]`);
      return null;
    }

    const values = {};
    this.availableInputs.forEach(id => {
      values[id.toUpperCase()] = this.inputStates[id];
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
      this.formulaResults[formulaId] = result;
      
      // Trigger flow cards for this formula
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
    for (const formula of this.formulas) {
      if (formula.enabled) {
        await this.evaluateFormula(formula.id);
      }
    }
  }

  // Get formula result
  getFormulaResult(formulaId) {
    return this.formulaResults[formulaId];
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed. Reinitializing formulas.');
    this.initializeFormulas();
    
    // Validate all formulas if they changed
    if (changedKeys.includes('formulas')) {
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(`Formula '${formula.name}': ${validation.error}`);
        }
      }
    }
  }

  async onDeleted() {
    this.log('Logic Unit has been deleted');
  }
};