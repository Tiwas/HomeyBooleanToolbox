'use strict';

const Homey = require('homey');

module.exports = class BooleanToolboxApp extends Homey.App {

  async onInit() {
    this.log('Boolean Toolbox has been initialized');
    this.registerFlowCards();
  }

  registerFlowCards() {
    // Helper function to get all Logic Units across all drivers
    const getAllLogicUnits = async (query) => {
      const allDevices = [];
      
      // Get devices from all logic-unit drivers (2-10 inputs)
      for (let i = 2; i <= 10; i++) {
        try {
          const driver = this.homey.drivers.getDriver(`logic-unit-${i}`);
          const devices = driver.getDevices();
          allDevices.push(...devices);
        } catch (e) {
          // Driver might not exist, skip
        }
      }
      
      return allDevices
        .filter(device => {
          if (!query) return true;
          return device.getName().toLowerCase().includes(query.toLowerCase());
        })
        .map(device => ({
          id: device.getData().id,
          name: device.getName(),
          description: `${device.getData().numInputs} inputs`,
          device: device
        }));
    };

    // Helper function to get all formulas from all devices (for unfiltered search)
    const getAllFormulas = async (query) => {
      const allFormulas = [];
      
      for (let i = 2; i <= 10; i++) {
        try {
          const driver = this.homey.drivers.getDriver(`logic-unit-${i}`);
          const devices = driver.getDevices();
          
          devices.forEach(device => {
            const formulas = device.getFormulas();
            formulas.forEach(formula => {
              allFormulas.push({
                id: formula.id,
                name: `${formula.name} (${device.getName()})`,
                description: formula.description,
                formulaId: formula.id,
                deviceId: device.getData().id,
                device: device
              });
            });
          });
        } catch (e) {
          // Driver might not exist, skip
        }
      }
      
      if (!query) return allFormulas;
      
      return allFormulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    };

    // Helper function to find device by ID
    const findDeviceById = (deviceId) => {
      for (let i = 2; i <= 10; i++) {
        try {
          const driver = this.homey.drivers.getDriver(`logic-unit-${i}`);
          const devices = driver.getDevices();
          const found = devices.find(d => d.getData().id === deviceId || d.id === deviceId);
          if (found) return found;
        } catch (e) {
          // Driver not found, continue
        }
      }
      return null;
    };

    // Helper function to get device from args (handles both autocomplete and direct device)
    const getDeviceFromArgs = (args) => {
      if (!args.device) return null;
      
      // If device has getFormulas, it's the actual device object
      if (typeof args.device.getFormulas === 'function') {
        return args.device;
      }
      
      // If device.device exists and has getFormulas
      if (args.device.device && typeof args.device.device.getFormulas === 'function') {
        return args.device.device;
      }
      
      // If device.device is metadata, get ID and find actual device
      if (args.device.device) {
        const deviceId = args.device.device.data?.id || args.device.device.id;
        return findDeviceById(deviceId);
      }
      
      // Try to find by ID directly
      const deviceId = args.device.id || args.device.data?.id;
      if (deviceId) {
        return findDeviceById(deviceId);
      }
      
      return null;
    };

    // Register TRIGGER cards
    const formulaTrueCard = this.homey.flow.getDeviceTriggerCard('formula_changed_to_true');
    
    formulaTrueCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      return await getAllFormulas(query);
    });
    
    formulaTrueCard.registerRunListener(async (args, state) => {
      return !state || !args.formula || args.formula.id === state.formulaId || args.formula.formulaId === state.formulaId;
    });

    const formulaFalseCard = this.homey.flow.getDeviceTriggerCard('formula_changed_to_false');
    
    formulaFalseCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      return await getAllFormulas(query);
    });
    
    formulaFalseCard.registerRunListener(async (args, state) => {
      return !state || !args.formula || args.formula.id === state.formulaId || args.formula.formulaId === state.formulaId;
    });

    // Register SET INPUT action
    const setInputCard = this.homey.flow.getActionCard('set_input_value');
    
    setInputCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getAllLogicUnits(query);
    });
    
    setInputCard.registerArgumentAutocompleteListener('input', async (query, args) => {
      const device = getDeviceFromArgs(args);
      if (!device) return [];
      
      const inputs = device.getInputOptions();
      
      if (!query) return inputs;
      
      return inputs.filter(i => 
        i.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    setInputCard.registerRunListener(async (args) => {
      const device = getDeviceFromArgs(args) || args.device.device;
      await device.setInputStateAndEvaluate(args.input.id, args.value === 'true');
      return true;
    });

    // Register SET INPUT AND EVALUATE FORMULA action
    const setInputFormulaCard = this.homey.flow.getActionCard('set_input_and_evaluate_formula');
    
    setInputFormulaCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getAllLogicUnits(query);
    });
    
    setInputFormulaCard.registerArgumentAutocompleteListener('input', async (query, args) => {
      const device = getDeviceFromArgs(args);
      if (!device) return [];
      
      const inputs = device.getInputOptions();
      
      if (!query) return inputs;
      
      return inputs.filter(i => 
        i.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    setInputFormulaCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = getDeviceFromArgs(args);
      
      if (!device) {
        return await getAllFormulas(query);
      }
      
      const formulas = device.getFormulas();
      
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    setInputFormulaCard.registerRunListener(async (args) => {
      const device = getDeviceFromArgs(args) || args.formula.device;
      const formulaId = args.formula.formulaId || args.formula.id;
      
      await device.setInputAndEvaluateFormula(
        args.input.id, 
        args.value === 'true',
        formulaId
      );
      return true;
    });

    // Register EVALUATE FORMULA action
    const evaluateFormulaCard = this.homey.flow.getActionCard('evaluate_formula');
    
    evaluateFormulaCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getAllLogicUnits(query);
    });
    
    evaluateFormulaCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = getDeviceFromArgs(args);
      
      if (!device) {
        return await getAllFormulas(query);
      }
      
      const formulas = device.getFormulas();
      
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    evaluateFormulaCard.registerRunListener(async (args) => {
      const device = getDeviceFromArgs(args) || args.formula.device;
      const formulaId = args.formula.formulaId || args.formula.id;
      
      await device.evaluateFormula(formulaId);
      return true;
    });

    // Register EVALUATE ALL FORMULAS action
    const evaluateAllCard = this.homey.flow.getActionCard('evaluate_all_formulas');
    
    evaluateAllCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getAllLogicUnits(query);
    });
    
    evaluateAllCard.registerRunListener(async (args) => {
      const device = getDeviceFromArgs(args) || args.device.device;
      await device.evaluateAllFormulas();
      return true;
    });

    // Register CONDITION card (formula_result_is)
    const conditionCard = this.homey.flow.getConditionCard('formula_result_is');
    
    conditionCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getAllLogicUnits(query);
    });
    
    conditionCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = getDeviceFromArgs(args);
      
      if (!device) {
        return await getAllFormulas(query);
      }
      
      const formulas = device.getFormulas();
      
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    conditionCard.registerRunListener(async (args) => {
      const device = getDeviceFromArgs(args) || args.formula.device;
      const formulaId = args.formula.formulaId || args.formula.id;
      
      const result = device.getFormulaResult(formulaId);
      if (result === null || result === undefined) {
        return false;
      }
      return result.toString() === args.what_is;
    });
  }
};