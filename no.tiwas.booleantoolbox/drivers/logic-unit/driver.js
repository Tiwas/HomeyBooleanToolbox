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
    
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }

    this.initializeState();
    this.registerDeviceTriggers();
  }

  // Setter opp den interne tilstanden for inngangene
  initializeState() {
    this.inputStates = {};
    this.lastOutputState = null;
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
  async evaluateLogic() {
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

    await this.setCapabilityValue('onoff', finalResult);

    if (finalResult) {
      this.triggerOutputTrue.trigger(this, {}, {}).catch(this.error);
    } else {
      this.triggerOutputFalse.trigger(this, {}, {}).catch(this.error);
    }

    this.resetInputStates();
  }

  // Nullstiller 'isSet' for alle innganger
  resetInputStates() {
    this.log('Resetting inputs for next evaluation round...');
    const settings = this.getSettings();

    for (const id in this.inputStates) {
      // Sjekk om auto-reset er skrudd på for denne inngangen
      if (settings[`input_${id}_auto_reset`]) {
        this.log(`Input '${id.toUpperCase()}' has auto-reset enabled. Resetting.`);
        this.inputStates[id].isSet = false;
      } else {
        this.log(`Input '${id.toUpperCase()}' requires manual reset (set to false).`);
      }
    }
  }

  // Kjører når brukeren endrer innstillingene
  onSettings() {
    this.log('Settings changed. Resetting inputs.');
    this.resetInputStates();
  }

  // NY METODE: Fanger opp forsøk på å endre onoff fra en flow og ignorerer dem.
  async onCapabilityOnoff( value, opts ) {
    this.log(`'onoff' capability was set to '${value}' from a flow. This action is ignored.`);
    // Vi gjør ingenting her. Kapabiliteten skal kun oppdateres av evaluateLogic().
  }
}

// =================================================================================================
//  DRIVER KLASSE
//  Håndterer alle enheter og registrerer de globale OG- og DA-kortene.
// =================================================================================================
class LogicUnitDriver extends Homey.Driver {

  onMapDeviceClass(device) {
    return LogicUnitDevice;
  }

  async onInit() {
    this.log('Boolean Toolbox Driver initializing...');
    this.registerFlowCards();
  }

  // KLASISK PARINGSMETODE: Gir full kontroll over paringen
  async onPair(session) {
    this.log('*** onPair session started! ***');

    session.emit('show_view', 'list_devices');

    session.setHandler('list_devices', async (data) => {
      this.log('*** onPair list_devices handler called! ***');
      
      const devices = [
        {
          name: 'New Logic Unit',
          data: {
            id: `logic-unit-${Date.now()}`
          }
        }
      ];

      this.log(`*** Found devices to return: ${JSON.stringify(devices)} ***`);
      return devices;
    });

    session.setHandler('add_device', async (data) => {
      this.log(`*** Adding device: ${data.device.name} ***`);
      return data.device;
    });
  }

  // Registrerer alle globale Flow-kort
  registerFlowCards() {
    this.log('Registering global Condition and Action cards...');

    this.homey.flow.getConditionCard('output_is_true')
      .registerRunListener(async (args, state) => {
        if (!args.device) return false;
        this.log(`Condition check on '${args.device.getName()}': Last state was ${args.device.lastOutputState}`);
        return args.device.lastOutputState === true;
      });

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

module.exports = LogicUnitDriver;