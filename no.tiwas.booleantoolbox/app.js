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
    this.logger.banner('BOOLEAN TOOLBOX v1.2.2');

    // Initialize API for accessing all devices
    try {
      const athomApi = require('athom-api');
      this.logger.debug('athom-api loaded successfully');

      const { HomeyAPI } = athomApi;
      this.logger.debug('HomeyAPI extracted, type:', typeof HomeyAPI);

      if (typeof HomeyAPI.forCurrentHomey === 'function') {
        this.logger.debug('Initializing HomeyAPI.forCurrentHomey...');
        this.api = await HomeyAPI.forCurrentHomey(this.homey);
        this.logger.info('Homey API initialized successfully');
      } else {
        this.logger.error('HomeyAPI.forCurrentHomey is not a function');
        this.logger.debug('HomeyAPI methods:', Object.keys(HomeyAPI));
      }
    } catch (e) {
      this.logger.error('Failed to initialize Homey API:', e.message);
      this.logger.debug('Error stack:', e.stack);
    }

    await this.registerFlowCards();
  }

  async getAvailableZones() {
    this.logger.debug('Getting available zones...');
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
      this.logger.debug(`Found ${zoneList.length} zones`);
      return zoneList;
    } catch (e) {
      this.logger.error('Error getting zones:', e.message);
      return [];
    }
  }

  async getDevicesInZone(zoneId) {
    this.logger.debug(`Getting devices for zone ID: ${zoneId}`);
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
      this.logger.debug(`Found ${deviceList.length} devices in zone ${zoneId}`);
    } catch (e) {
      this.logger.error(`Error getting devices for zone ${zoneId}:`, e.message);
    }
    return deviceList;
  }

  async registerFlowCards() {
    this.logger.debug('Registering flow cards...');

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
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
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
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
      }

      await device.evaluateFormula(formulaId, true);
      return true;
    });

    // Register EVALUATE ALL FORMULAS action
    const evaluateAllCard = this.homey.flow.getActionCard('evaluate_all_formulas');

    evaluateAllCard.registerRunListener(async (args) => {
      const device = args.device;

      if (!device) {
        throw new Error('Could not find device. Please reconfigure this flow card.');
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
        this.logger.warn('Condition: Could not find device', args);
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        this.logger.warn(`Condition: Formula '${formulaId}' not found`);
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
      }

      const result = device.getFormulaResult(formulaId);

      this.logger.flow(`Condition check: Formula '${formula.name}' result = ${result}, checking if it is '${args.what_is}'`);

      if (result === null || result === undefined) {
        this.logger.debug(`Condition: Formula '${formula.name}' has not been evaluated yet (result is ${result})`);
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
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }

      const formulaId = args.formula.id;

      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
      }

      return device.hasFormulaTimedOut(formulaId);
    });

    // --- Register action card ---
    const evaluateActionCard = this.homey.flow.getActionCard('evaluate_expression');

    evaluateActionCard.registerRunListener(async (args, state) => {
        const { input, rules, op1, op2, logical_op } = args;

        await evaluateActionCard.setTokenValue('outputValue', 0);
        await evaluateActionCard.setTokenValue('errorMessage', '');

        try {
            this.logger.flow(`Running evaluation. Input: ${input}, Rules: '${rules}'`);
            let output = null;

            if (!rules || rules.trim() === '') {
              throw new Error("Rule string cannot be empty.");
            }

            const ruleSets = rules.split(';').map(set => set.trim()).filter(set => set.length > 0);

            for (const ruleSet of ruleSets) {
                const parts = ruleSet.split(',');
                if (parts.length !== 3) {
                  throw new Error(`Invalid format in rule '${ruleSet}'. Expected 'min,max,output'.`);
                }

                const min = parseFloat(parts[0]);
                const max = parseFloat(parts[1]);
                const resultValue = parseInt(parts[2], 10);

                if (isNaN(min) || isNaN(max) || isNaN(resultValue)) {
                  throw new Error(`Invalid numeric value in rule '${ruleSet}'.`);
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
                this.logger.debug(`Evaluation finished. Output: ${output}`);
                await evaluateActionCard.setTokenValue('outputValue', output);
            } else {
                const logicalErrorMsg = `Value ${input} is outside the defined logic.`;
                this.logger.debug(logicalErrorMsg);
                await evaluateActionCard.setTokenValue('errorMessage', logicalErrorMsg);
            }

        } catch (e) {
            this.logger.error(`Configuration error caught: ${e.message}`);
            await evaluateActionCard.setTokenValue('errorMessage', `Configuration error: ${e.message}`);
        }

        return true;
    });

    // --- Register condition card ---
    const hasErrorConditionCard = this.homey.flow.getConditionCard('has_error');
    hasErrorConditionCard.registerRunListener(async (args, state) => {
      const textInput = args.text_input;
      const hasError = !!textInput && textInput.length > 0;
      this.logger.flow(`Checking for error. Input: '${textInput}', Has error: ${hasError}`);
      return hasError;
    });

    this.logger.info('Flow cards registered');
  }
};
