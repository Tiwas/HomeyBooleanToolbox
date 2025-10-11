'use strict';

const Homey = require('homey');

module.exports = class LogicUnitDevice extends Homey.Device {

  async onInit() {
    this.log(`Logic Unit '${this.getName()}' initializing.`);
    
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    
    this.initializeState();
  }

  // Reset all inputs to 'undefined'
  initializeState() {
    this.inputStates = {};
    this.lastOutputState = null;
    ['a', 'b', 'c', 'd', 'e'].forEach(id => {
      this.inputStates[id] = 'undefined';
    });
    this.log('All input states reset to undefined.');
  }

  // Parse expression to find required inputs (A-E)
  parseExpression(expression) {
    const matches = expression.match(/\b[A-E]\b/gi);
    return matches ? [...new Set(matches.map(char => char.toUpperCase()))] : [];
  }

  // Main function: set input value and evaluate
  async setInputStateAndEvaluate(inputId, value) {
    this.log(`Input '${inputId.toUpperCase()}' set to: ${value}.`);
    this.inputStates[inputId] = value;
  }

  // Evaluate and return result (for use with "Evaluate logic" action card)
  async evaluateLogicAndReturn() {
    await this.evaluateLogic();
    return this.getCapabilityValue('onoff');
  }

  async evaluateLogic() {
    const settings = this.getSettings();
    const expression = settings.expression;
    
    if (!expression) {
      this.log('No expression set, cannot evaluate.');
      return;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return;

    // Check if all REQUIRED inputs have a value
    const allInputsDefined = requiredInputs.every(id => 
      this.inputStates[id.toLowerCase()] !== 'undefined'
    );
    
    if (!allInputsDefined) {
      this.log(`Waiting for more inputs. Required: [${requiredInputs.join(', ')}]. Current:`, this.inputStates);
      return;
    }

    const values = {
      A: this.inputStates.a,
      B: this.inputStates.b,
      C: this.inputStates.c,
      D: this.inputStates.d,
      E: this.inputStates.e
    };

    this.log(`Input values: A=${values.A}, B=${values.B}, C=${values.C}, D=${values.D}, E=${values.E}`);

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

    this.log(`Evaluating expression: "${expression}" → "${evalExpression}"`);

    try {
      const evaluate = new Function(`return ${evalExpression}`);
      let finalResult = !!evaluate();

      if (settings.invert_final) {
        this.log(`Before inversion: ${finalResult}`);
        finalResult = !finalResult;
      }

      this.log(`✅ Evaluation complete. Final result: ${finalResult}`);
      this.lastOutputState = finalResult;
      await this.setCapabilityValue('onoff', finalResult);

      // Trigger flow cards
      if (finalResult) {
        await this.homey.flow.getDeviceTriggerCard('output_changed_to_true').trigger(this);
      } else {
        await this.homey.flow.getDeviceTriggerCard('output_changed_to_false').trigger(this);
      }

      this.log('Resetting input states for next cycle.');
      this.initializeState();

    } catch (e) {
      this.error(`❌ Failed to evaluate expression: "${evalExpression}". Error: ${e.message}`);
    }
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed. Resetting.');
    this.initializeState();
  }

  async onDeleted() {
    this.log('Logic Unit has been deleted');
  }
};