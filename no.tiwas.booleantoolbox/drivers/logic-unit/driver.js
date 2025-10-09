'use strict';

const Homey = require('homey');

// =================================================================================================
//  DEVICE KLASSE
// =================================================================================================
class LogicUnitDevice extends Homey.Device {

  async onInit() {
    this.log(`Device '${this.getName()}' initializing.`);
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    this.initializeState();
    this.registerDeviceTriggers();
  }

  initializeState() {
    this.inputStates = {};
    this.lastOutputState = null;
    ['a', 'b', 'c', 'd', 'e'].forEach(id => {
      this.inputStates[id] = 'undefined';
    });
  }

  registerDeviceTriggers() {
    this.triggerOutputTrue = this.homey.flow.getDeviceTriggerCard('output_true');
    this.triggerOutputFalse = this.homey.flow.getDeviceTriggerCard('output_false');
  }

  parseExpression(expression) {
    const matches = expression.match(/\b[A-E]\b/gi);
    return matches ? [...new Set(matches.map(char => char.toUpperCase()))] : [];
  }

  // KORRIGERT HJELPEFUNKSJON
  generateInputStateString() {
    const states = [];
    for (const id in this.inputStates) {
      const state = this.inputStates[id];
      if (state !== 'undefined') {
        states.push(`${id.toUpperCase()}=${state}`);
      }
    }
    // Tving resultatet til å være en streng, uansett hva.
    const result = states.join(', ') || 'No inputs defined';
    return String(result);
  }

  async evaluateLogic() {
    const settings = this.getSettings();
    const expression = settings.expression;
    if (!expression) return;

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return;

    const allInputsDefined = requiredInputs.every(id => this.inputStates[id.toLowerCase()] !== 'undefined');
    
    if (!allInputsDefined) {
        const undefinedInputs = requiredInputs.filter(id => this.inputStates[id.toLowerCase()] === 'undefined');
        this.log(`Waiting for definitive state for inputs: [${undefinedInputs.join(', ')}].`);
        return;
    }

    this.log(`All inputs defined. Evaluating expression: ${expression}`);

    const values = {
      A: this.inputStates.a,
      B: this.inputStates.b,
      C: this.inputStates.c,
      D: this.inputStates.d,
      E: this.inputStates.e,
    };

    let evalExpression = expression;

    // --- START OF MODIFIED LOGIC ---
    // Replace textual and alternative operators with standard JS operators.
    // We use word boundaries (\b) for text operators to avoid replacing parts of other words.
    // The 'gi' flag makes the replacement case-insensitive.
    evalExpression = evalExpression.replace(/\bAND\b|&|\*/gi, '&&');
    evalExpression = evalExpression.replace(/\bOR\b|\||\+/gi, '||');
    evalExpression = evalExpression.replace(/\bXOR\b|\^|!=/gi, '!=');
    evalExpression = evalExpression.replace(/\bNOT\b/gi, '!');

    // Now, replace variables (A-E) with their boolean values.
    for (const key in values) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      evalExpression = evalExpression.replace(regex, values[key]);
    }
    // --- END OF MODIFIED LOGIC ---

    try {
      // Using a function constructor for slightly safer evaluation than direct eval()
      const evaluate = new Function(`return ${evalExpression}`);
      let finalResult = evaluate();

      if (settings.invert_final) {
        finalResult = !finalResult;
      }

      this.log(`Evaluation complete. Expression: "${evalExpression}". Final result: ${finalResult}`);

      const previousState = this.lastOutputState;
      const stateChanged = previousState !== finalResult;
      const isFirstRun = previousState === null;

      this.lastOutputState = finalResult;
      await this.setCapabilityValue('onoff', finalResult);

      if (finalResult) {
        if (stateChanged || isFirstRun) {
          this.log(`*** TRIGGERING 'output_true' ***`);
          const tokens = { inputs: this.generateInputStateString() };
          this.triggerOutputTrue.trigger(this, tokens, {}).catch(this.error);
        }
      } else {
        if (stateChanged || isFirstRun) {
          this.log(`*** TRIGGERING 'output_false' ***`);
          const tokens = { inputs: this.generateInputStateString() };
          this.triggerOutputFalse.trigger(this, tokens, {}).catch(this.error);
        }
      }

    } catch (e) {
      this.error(`Failed to evaluate expression: ${evalExpression}. Error: ${e.message}`);
    }

    this.resetInputStates();
  }

  setInputState(inputId, value) {
    this.log(`Input '${inputId.toUpperCase()}' set to definitive value: ${value}.`);
    this.inputStates[inputId] = value;
    this.evaluateLogic();
  }

  resetInputStates() {
    this.log("Resetting all inputs to 'undefined' for next evaluation round.");
    for (const id in this.inputStates) {
      this.inputStates[id] = 'undefined';
    }
  }

  onSettings() {
    this.log('Settings changed. Resetting input states.');
    this.resetInputStates();
  }
  
  async onCapabilityOnoff( value, opts ) {
    this.log(`'onoff' capability was set to '${value}' from a flow. This action is ignored.`);
  }
}

// =================================================================================================
//  DRIVER KLASSE
// =================================================================================================
class LogicUnitDriver extends Homey.Driver {

  onMapDeviceClass(device) {
    return LogicUnitDevice;
  }

  async onInit() {
    this.log('Boolean Toolbox Driver initializing...');
    this.registerFlowCards();
  }

  async onPair(session) {
    this.log('*** onPair session started! ***');
    session.emit('show_view', 'list_devices');
    session.setHandler('list_devices', async (data) => {
      this.log('*** onPair list_devices handler called! ***');
      const devices = [{ name: 'New Logic Unit', data: { id: `logic-unit-${Date.now()}` } }];
      this.log(`*** Found devices to return: ${JSON.stringify(devices)} ***`);
      return devices;
    });
    session.setHandler('add_device', async (data) => {
      this.log(`*** Adding device: ${data.device.name} ***`);
      return data.device;
    });
  }

  registerFlowCards() {
    this.log('Registering global Condition and Action cards...');
    this.homey.flow.getConditionCard('output_is_true')
      .registerRunListener(async (args, state) => {
        if (!args.device) return false;
        this.log(`Condition check on '${args.device.getName()}': Last state was ${args.device.lastOutputState}`);
        return args.device.lastOutputState === true;
      });

    const registerInputAction = (inputId) => {
      this.homey.flow.getActionCard(`set_input_${inputId}1_true`)
        .registerRunListener(async (args, state) => {
          if (!args.device) return false;
          args.device.setInputState(inputId, true);
          return true;
        });

      this.homey.flow.getActionCard(`set_input_${inputId}2_true`)
        .registerRunListener(async (args, state) => {
          if (!args.device) return false;
          args.device.setInputState(inputId, false);
          return true;
        });
    };

    ['a', 'b', 'c', 'd', 'e'].forEach(registerInputAction);
  }
}

module.exports = LogicUnitDriver;
