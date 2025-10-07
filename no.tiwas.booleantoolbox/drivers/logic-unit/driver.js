'use strict';

const Homey = require('homey');

// =================================================================================================
//  DEVICE KLASSE
//  Representerer én enkelt "Logisk Enhet".
// =================================================================================================
class LogicUnitDevice extends Homey.Device {

  // Kjører når enheten initialiseres
  async onInit() {
    this.log(`Device '${this.getName()}' initializing.`);
    this.initializeState();
    this.registerDeviceTriggers();
  }

  // Setter opp den interne tilstanden for inngangene
  initializeState() {
    this.inputStates = {};
    this.lastOutputState = null; // Lagrer siste resultat (true/false)
    ['a', 'b', 'c', 'd', 'e'].forEach(id => {
      this.inputStates[id] = { value: false, isSet: false };
    });
  }

  // Registrerer de NÅR-kortene som er spesifikke for denne enheten
  registerDeviceTriggers() {
    this.triggerOutputTrue = this.homey.flow.getDeviceTriggerCard('output_true');
    this.triggerOutputFalse = this.homey.flow.getDeviceTriggerCard('output_false');
  }

  // Kalles av et Action-kort (via driveren) for å sette verdien til en inngang
  setInputState(inputId, value) {
    this.log(`Input '${inputId.toUpperCase()}' received signal: ${value}`);
    this.inputStates[inputId].value = value;
    this.inputStates[inputId].isSet = true;
    this.evaluateLogic();
  }

  // KJERNEFUNKSJON: Evaluerer all logikken
  evaluateLogic() {
    const settings = this.getSettings();
    const activeInputs = ['a', 'b', 'c', 'd', 'e'].filter(id => settings[`input_${id}_enabled`]);

    if (activeInputs.length === 0) {
        this.log('No inputs enabled, evaluation skipped.');
        return;
    }

    const allInputsSet = activeInputs.every(id => this.inputStates[id].isSet);
    if (!allInputsSet) {
      this.log('Waiting for more inputs before evaluation...');
      return;
    }

    this.log('All active inputs received. Evaluating logic...');
    const groups = { and: [], or: [], xor: [] };

    activeInputs.forEach(id => {
      const operator = settings[`input_${id}_operator`];
      let value = this.inputStates[id].value;
      if (settings[`input_${id}_not`]) {
        value = !value;
      }
      if (groups[operator]) {
        groups[operator].push(value);
      }
    });

    const andResult = groups.and.length > 0 ? groups.and.every(v => v === true) : null;
    const orResult = groups.or.length > 0 ? groups.or.some(v => v === true) : null;
    const xorResult = groups.xor.length > 0 ? (groups.xor.filter(v => v === true).length % 2 !== 0) : null;
    
    const finalResult = [andResult, orResult, xorResult]
        .filter(res => res !== null)
        .every(res => res === true);

    this.log(`Evaluation complete. Final result: ${finalResult}`);
    this.lastOutputState = finalResult;

    if (finalResult) {
      this.triggerOutputTrue.trigger(this, {}, {}).catch(this.error);
    } else {
      this.triggerOutputFalse.trigger(this, {}, {}).catch(this.error);
    }

    this.resetInputStates();
  }

  // Nullstiller 'isSet' for alle innganger
  resetInputStates() {
    this.log('Resetting all inputs for next evaluation round.');
    for (const id in this.inputStates) {
      this.inputStates[id].isSet = false;
    }
  }

  // Kjører når brukeren endrer innstillingene
  onSettings() {
    this.log('Settings changed. Resetting inputs.');
    this.resetInputStates();
  }
}

// =================================================================================================
//  DRIVER KLASSE
//  Håndterer alle enheter og registrerer de globale OG- og DA-kortene.
// =================================================================================================
class LogicUnitDriver extends Homey.Driver {

  // Denne metoden forteller Homey nøyaktig hvilken Device-klasse som skal brukes.
  onMapDeviceClass(device) {
    return LogicUnitDevice;
  }

  // Kjører når driveren initialiseres
  async onInit() {
    this.log('Boolean Toolbox Driver initializing...');
    this.registerFlowCards();
  }

  // Registrerer alle globale Flow-kort
  registerFlowCards() {
    this.log('Registering global Condition and Action cards...');

    // --- OG (Condition) ---
    this.homey.flow.getConditionCard('output_is_true')
      .registerRunListener(async (args, state) => {
        if (!args.device) return false;
        this.log(`Condition check on '${args.device.getName()}': Last state was ${args.device.lastOutputState}`);
        return args.device.lastOutputState === true;
      });

    // --- DA (Actions) ---
    const registerInputAction = (inputId) => {
      this.homey.flow.getActionCard(`set_input_${inputId}_true`)
        .registerRunListener(async (args, state) => {
          if (!args.device) return false;
          args.device.setInputState(inputId, true);
          return true;
        });

      this.homey.flow.getActionCard(`set_input_${inputId}_false`)
        .registerRunListener(async (args, state) => {
          if (!args.device) return false;
          args.device.setInputState(inputId, false);
          return true;
        });
    };

    ['a', 'b', 'c', 'd', 'e'].forEach(registerInputAction);
  }
}

// Eksporter KUN Driver-klassen.
module.exports = LogicUnitDriver;

