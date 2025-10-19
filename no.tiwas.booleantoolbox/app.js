'use strict';

const Homey = require('homey');

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
    this.log('Boolean Toolbox has been initialized');
    
    // Initialize API for accessing all devices
    try {
      const athomApi = require('athom-api');
      this.log('athom-api loaded successfully');
      
      // Get HomeyAPI from the exported object
      const { HomeyAPI } = athomApi;
      this.log('HomeyAPI extracted, type:', typeof HomeyAPI);
      
      if (typeof HomeyAPI.forCurrentHomey === 'function') {
        this.log('Initializing HomeyAPI.forCurrentHomey...');
        this.api = await HomeyAPI.forCurrentHomey(this.homey);
        this.log('✅ Homey API initialized successfully');
      } else {
        this.error('HomeyAPI.forCurrentHomey is not a function');
        this.error('HomeyAPI methods:', Object.keys(HomeyAPI));
      }
    } catch (e) {
      this.error('Failed to initialize Homey API:', e.message);
      this.error('Error stack:', e.stack);
    }
    
    await this.registerFlowCards();
  }

  async getAvailableZones() {
    this.log('[APP] Getting available zones...');
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
      this.log(`[APP] ✅ Found ${zoneList.length} zones`);
      return zoneList;
    } catch (e) {
      this.error('[APP] ❌ Error getting zones:', e.message);
      return [];
    }
  }

  async getDevicesInZone(zoneId) {
    this.log(`[APP] Getting devices for zone ID: ${zoneId}`);
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
        if (device.zone !== zoneId) continue; // Hopp over enheter som ikke er i den valgte sonen
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
      this.log(`[APP] ✅ Found ${deviceList.length} devices in zone ${zoneId}`);
    } catch (e) {
      this.error(`[APP] ❌ Error getting devices for zone ${zoneId}:`, e.message);
    }
    return deviceList;
  }

  async registerFlowCards() {
    // Register STATE CHANGED trigger (NYTT)
    const stateChangedCard = this.homey.flow.getDeviceTriggerCard('device_state_changed');
    
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
        this.error('Condition: Could not find device', args);
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }
      
      const formulaId = args.formula.id;
      
      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        this.error(`Condition: Formula '${formulaId}' not found`);
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
      }
      
      const result = device.getFormulaResult(formulaId);
      
      this.log(`Condition check: Formula '${formulaId}' result = ${result}, checking if ${args.what_is}`);
      
      if (result === null || result === undefined) {
        this.log(`Condition: Formula '${formulaId}' has not been evaluated yet (result is ${result})`);
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

    // --- Registrer handlingskortet ---
    const evaluateActionCard = this.homey.flow.getActionCard('evaluate_expression');
    
    evaluateActionCard.registerRunListener(async (args, state) => {
        const { input, rules, op1, op2, logical_op } = args;
        
        // Nullstill verdier ved start for en ren kjøring hver gang
        await evaluateActionCard.setTokenValue('outputValue', 0);
        await evaluateActionCard.setTokenValue('errorMessage', '');

        try {
            this.log(`Running evaluation. Input: ${input}, Rules: '${rules}'`);
            let output = null;

            if (!rules || rules.trim() === '') {
              throw new Error("Regel-strengen kan ikke være tom.");
            }
            
            const ruleSets = rules.split(';').map(set => set.trim()).filter(set => set.length > 0);

            for (const ruleSet of ruleSets) {
                const parts = ruleSet.split(',');
                if (parts.length !== 3) {
                  throw new Error(`Ugyldig format i regelen '${ruleSet}'. Forventet 'min,maks,utgang'.`);
                }

                const min = parseFloat(parts[0]);
                const max = parseFloat(parts[1]);
                const resultValue = parseInt(parts[2], 10);

                if (isNaN(min) || isNaN(max) || isNaN(resultValue)) {
                  throw new Error(`Ugyldig tallverdi i regelen '${ruleSet}'.`);
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
                this.log(`Evaluation finished. Output: ${output}`);
                await evaluateActionCard.setTokenValue('outputValue', output);
            } else {
                const logicalErrorMsg = `Verdien ${input} er utenfor definert logikk.`;
                this.log(logicalErrorMsg);
                await evaluateActionCard.setTokenValue('errorMessage', logicalErrorMsg);
            }

        } catch (e) {
            this.log(`Configuration error caught: ${e.message}`);
            await evaluateActionCard.setTokenValue('errorMessage', `Feil i konfigurasjon: ${e.message}`);
        }
        
        return true;
    });

    // --- Registrer betingelseskortet ---
    const hasErrorConditionCard = this.homey.flow.getConditionCard('has_error');
    hasErrorConditionCard.registerRunListener(async (args, state) => {
      const textInput = args.text_input;
      const hasError = !!textInput && textInput.length > 0;
      this.log(`Checking for error. Input: '${textInput}', Has error: ${hasError}`);
      return hasError;
    });
  }
};

