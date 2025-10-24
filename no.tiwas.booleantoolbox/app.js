'use strict';

const Homey = require('homey');
const Logger = require('./lib/Logger');

function evaluateCondition(inputValue, operator, ruleValue) {
  switch (operator) {
    case 'gt': return inputValue > ruleValue;
    case 'gte': return inputValue >= ruleValue;
    case 'lt': return inputValue < ruleValue;
    case 'lte': return inputValue <= ruleValue;
    default: return false;
  }
}

module.exports = class BooleanToolboxApp extends Homey.App {

  async onInit() {
    this.logger = new Logger(this, 'App');
    const version = require('./package.json').version;
    this.logger.banner(`BOOLEAN TOOLBOX v${version}`);

    // Initialize API for accessing all devices
    try {
      const athomApi = require('athom-api');
      // Kall med nøkkel
      this.logger.debug('app.athom_api_loaded');

      const { HomeyAPI } = athomApi;
      // Kall med nøkkel og data separat
      this.logger.debug('app.homey_api_extracted', { type: typeof HomeyAPI });

      if (typeof HomeyAPI.forCurrentHomey === 'function') {
        // Kall med nøkkel
        this.logger.debug('app.initializing_homey_api');
        this.api = await HomeyAPI.forCurrentHomey(this.homey);
        // Fjernet logger.info('device.ready') - hører ikke hjemme her
      } else {
        // Kall med nøkkel
        this.logger.error('app.homey_api_not_function');
        // Kall med nøkkel og data separat
        this.logger.debug('app.homey_api_methods', { keys: Object.keys(HomeyAPI) });
      }
    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.error('errors.connection_failed', { message: e.message });
      // Kall med nøkkel og data separat
      this.logger.debug('app.error_stack', { stack: e.stack });
    }

    await this.registerFlowCards();
  }

  async getAvailableZones() {
    // Kall med nøkkel
    this.logger.debug('app.getting_zones');
    try {
      if (!this.api) {
        const athomApi = require('athom-api');
        const { HomeyAPI } = athomApi;
        this.api = await HomeyAPI.forCurrentHomey(this.homey);
      }
      const zones = await this.api.zones.getZones();
      const zoneList = Object.values(zones).map(zone => ({
        id: zone.id,
        name: zone.name,
      }));
      zoneList.sort((a, b) => a.name.localeCompare(b.name));
      // Kall med nøkkel og data separat
      this.logger.debug('app.found_zones', { count: zoneList.length });
      return zoneList;
    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.error('app.error_getting_zones', { message: e.message });
      return [];
    }
  }

  async getDevicesInZone(zoneId) {
    // Kall med nøkkel og data separat
    this.logger.debug('app.getting_devices_for_zone', { zoneId });
    const deviceList = [];
    try {
      if (!this.api) {
        const athomApi = require('athom-api');
        const { HomeyAPI } = athomApi;
        this.api = await HomeyAPI.forCurrentHomey(this.homey);
      }

      const allDevices = await this.api.devices.getDevices();
      for (const deviceId in allDevices) {
        const device = allDevices[deviceId];
        if (device.zone !== zoneId) continue;
        if (device.driverUri?.includes('logic-device')) continue;

        const capabilities = device.capabilities || [];
        if (capabilities.length === 0) continue;

        const capabilityList = capabilities.map(cap => {
          const capObj = device.capabilitiesObj?.[cap];
          return {
            id: cap,
            name: capObj?.title || cap.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: capObj?.type || 'unknown'
          };
        });

        deviceList.push({
          id: deviceId,
          name: device.name,
          driverName: device.driverUri?.split(':').pop() || 'Unknown',
          capabilities: capabilityList
        });
      }

      deviceList.sort((a, b) => a.name.localeCompare(b.name));
      // Kall med nøkkel og data separat
      this.logger.debug('app.found_devices_in_zone', { count: deviceList.length, zoneId });
    } catch (e) {
      // Kall med nøkkel og data separat
      this.logger.error('app.error_getting_devices', { zoneId, message: e.message });
    }
    return deviceList;
  }

  async registerFlowCards() {
    // Kall med nøkkel
    this.logger.debug('app.registering_flow_cards');

    // Register TRIGGER cards
    const formulaTrueCard = this.homey.flow.getDeviceTriggerCard('formula_changed_to_true');

    formulaTrueCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();
      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    formulaTrueCard.registerRunListener(async (args, state) => {
      return !state || !args.formula || args.formula.id === state.formulaId;
    });

    const formulaFalseCard = this.homey.flow.getDeviceTriggerCard('formula_changed_to_false');

    formulaFalseCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();
      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    formulaFalseCard.registerRunListener(async (args, state) => {
      return !state || !args.formula || args.formula.id === state.formulaId;
    });

    const formulaTimeoutCard = this.homey.flow.getDeviceTriggerCard('formula_timeout');

    formulaTimeoutCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();
      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    formulaTimeoutCard.registerRunListener(async (args, state) => {
      return !state || !args.formula || args.formula.id === state.formulaId;
    });

    // Register SET INPUT action (sets input for specific formula)
    const setInputCard = this.homey.flow.getActionCard('set_input_value');

    setInputCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();
      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    setInputCard.registerArgumentAutocompleteListener('input', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const inputs = device.getInputOptions();

      if (!query) return inputs;

      return inputs.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    setInputCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        throw new Error(this.homey.__('errors.device_not_found'));
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(this.homey.__('errors.invalid_formula'));
      }

      await device.setInputForFormula(formulaId, args.input.id, args.value === 'true');
      return true;
    });

    // Register EVALUATE FORMULA action
    const evaluateFormulaCard = this.homey.flow.getActionCard('evaluate_formula');

    evaluateFormulaCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();

      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    evaluateFormulaCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        throw new Error(this.homey.__('errors.device_not_found'));
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(this.homey.__('errors.invalid_formula'));
      }

      await device.evaluateFormula(formulaId, true);
      return true;
    });

    // Register EVALUATE ALL FORMULAS action
    const evaluateAllCard = this.homey.flow.getActionCard('evaluate_all_formulas');

    evaluateAllCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        throw new Error(this.homey.__('errors.device_not_found'));
      }

      await device.evaluateAllFormulas();
      return true;
    });

    // Register CONDITION card (formula_result_is)
    const conditionCard = this.homey.flow.getConditionCard('formula_result_is');

    conditionCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();

      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    conditionCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        this.logger.warn('errors.device_not_found', args); // Send key + data
        throw new Error(this.homey.__('errors.device_not_found'));
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        this.logger.warn('errors.invalid_formula'); // Send key
        throw new Error(this.homey.__('errors.invalid_formula'));
      }

      const result = device.getFormulaResult(formulaId);

      // Kall med nøkkel og data separat
      this.logger.flow('app.condition_check', {
        formulaName: formula.name,
        result,
        expected: args.what_is
      });
      if (result === null || result === undefined) {
        // Kall med nøkkel og data separat
        this.logger.debug('app.formula_not_evaluated', {
          formulaName: formula.name,
          result
        });
        return false;
      }

      return result.toString() === args.what_is;
    });

    // Register CONDITION card (formula_has_timed_out)
    const timeoutConditionCard = this.homey.flow.getConditionCard('formula_has_timed_out');

    timeoutConditionCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();

      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    timeoutConditionCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        throw new Error(this.homey.__('errors.device_not_found'));
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(this.homey.__('errors.invalid_formula'));
      }

      return device.hasFormulaTimedOut(formulaId);
    });

    // Register CLEAR ERROR STATE action
    const clearErrorCard = this.homey.flow.getActionCard('clear_error_state');

    clearErrorCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device;
      if (!device) return [];

      const formulas = device.getFormulas();

      if (!query) return formulas;

      return formulas.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });

    clearErrorCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        throw new Error(this.homey.__('errors.device_not_found'));
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(this.homey.__('errors.invalid_formula'));
      }

      // Clear timeout state
      formula.timedOut = false;
      // Kall med nøkkel
      this.logger.info('notifications.error_cleared');

      return true;
    });

    // --- Register action card ---
    const evaluateActionCard = this.homey.flow.getActionCard('evaluate_expression');

    evaluateActionCard.registerRunListener(async (args, state) => {
        const { input, rules, op1, op2, logical_op } = args;

        await evaluateActionCard.setTokenValue('outputValue', 0);
        await evaluateActionCard.setTokenValue('errorMessage', '');

        try {
            // Kall med nøkkel og data separat
            this.logger.flow('app.running_evaluation', { input, rules });
            let output = null;

            if (!rules || rules.trim() === '') {
              throw new Error(this.homey.__('errors.invalid_input'));
            }

            const ruleSets = rules.split(';').map(set => set.trim()).filter(set => set.length > 0);

            for (const ruleSet of ruleSets) {
                const parts = ruleSet.split(',');
                if (parts.length !== 3) {
                  throw new Error(this.homey.__('errors.invalid_formula'));
                }

                const min = parseFloat(parts[0]);
                const max = parseFloat(parts[1]);
                const resultValue = parseInt(parts[2], 10);

                if (isNaN(min) || isNaN(max) || isNaN(resultValue)) {
                  throw new Error(this.homey.__('errors.invalid_input'));
                }

                const condition1 = evaluateCondition(input, op1, min);
                const condition2 = evaluateCondition(input, op2, max);

                let ruleMatched = (logical_op === 'AND')
                    ? (condition1 && condition2)
                    : (condition1 || condition2);

                if (ruleMatched) {
                    output = resultValue;
                    break;
                }
            }

            if (output !== null) {
                // Kall med nøkkel og data separat
                this.logger.debug('app.evaluation_finished', { output });
                await evaluateActionCard.setTokenValue('outputValue', output);
            } else {
                const logicalErrorMsg = this.homey.__('app.value_outside_logic', { input });
                this.logger.debug(logicalErrorMsg); // Kan ikke oversettes direkte via logger
                await evaluateActionCard.setTokenValue('errorMessage', logicalErrorMsg);
            }

        } catch (e) {
            // Kall med nøkkel og data separat
            this.logger.error('errors.evaluation_failed', { message: e.message });
            await evaluateActionCard.setTokenValue('errorMessage', this.homey.__('errors.evaluation_failed'));
        }

        return true;
    });

    // --- Register condition card ---
    const hasErrorConditionCard = this.homey.flow.getConditionCard('has_error');
    hasErrorConditionCard.registerRunListener(async (args, state) => {
      const textInput = args.text_input;
      const hasError = !!textInput && textInput.length > 0;
      // Kall med nøkkel og data separat
      this.logger.flow('app.checking_for_error', { textInput, hasError });
      return hasError;
    });

    // Kall med nøkkel
    this.logger.info('app.flow_cards_registered');
  }
};

