'use strict';

const Homey = require('homey');

module.exports = class BooleanToolboxApp extends Homey.App {

  async onInit() {
    this.log('Boolean Toolbox has been initialized');
    this.registerFlowCards();
  }

  registerFlowCards() {
    // Register TRIGGER cards
    const formulaTrueCard = this.homey.flow.getDeviceTriggerCard('formula_changed_to_true');
    
    formulaTrueCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device; // Device comes directly from Homey
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
      const device = args.device; // Device comes directly from Homey
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
      const device = args.device; // Device comes directly from Homey
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
      const device = args.device; // Device comes directly from Homey
      if (!device) return [];
      
      const formulas = device.getFormulas();
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    setInputCard.registerArgumentAutocompleteListener('input', async (query, args) => {
      const device = args.device; // Device comes directly from Homey
      if (!device) return [];
      
      const inputs = device.getInputOptions();
      
      if (!query) return inputs;
      
      return inputs.filter(i => 
        i.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    setInputCard.registerRunListener(async (args) => {
      const device = args.device; // Device comes directly from Homey
      
      if (!device) {
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }
      
      const formulaId = args.formula.id;
      
      // Verify formula exists
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
      const device = args.device; // Device comes directly from Homey
      if (!device) return [];
      
      const formulas = device.getFormulas();
      
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    evaluateFormulaCard.registerRunListener(async (args) => {
      const device = args.device; // Device comes directly from Homey
      
      if (!device) {
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }
      
      const formulaId = args.formula.id;
      
      // Verify formula exists
      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
      }
      
      // Reset locks for manual re-evaluation
      await device.evaluateFormula(formulaId, true);
      return true;
    });

    // Register EVALUATE ALL FORMULAS action
    const evaluateAllCard = this.homey.flow.getActionCard('evaluate_all_formulas');
    
    evaluateAllCard.registerRunListener(async (args) => {
      const device = args.device; // Device comes directly from Homey
      
      if (!device) {
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }
      
      await device.evaluateAllFormulas();
      return true;
    });

    // Register CONDITION card (formula_result_is)
    const conditionCard = this.homey.flow.getConditionCard('formula_result_is');
    
    conditionCard.registerArgumentAutocompleteListener('formula', async (query, args) => {
      const device = args.device; // Device comes directly from Homey
      if (!device) return [];
      
      const formulas = device.getFormulas();
      
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    conditionCard.registerRunListener(async (args) => {
      const device = args.device; // Device comes directly from Homey
      
      if (!device) {
        this.error('Condition: Could not find device', args);
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }
      
      const formulaId = args.formula.id;
      
      // Verify formula exists
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
      const device = args.device; // Device comes directly from Homey
      if (!device) return [];
      
      const formulas = device.getFormulas();
      
      if (!query) return formulas;
      
      return formulas.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase())
      );
    });
    
    timeoutConditionCard.registerRunListener(async (args) => {
      const device = args.device; // Device comes directly from Homey
      
      if (!device) {
        throw new Error('Could not find device. Please reconfigure this flow card.');
      }
      
      const formulaId = args.formula.id;
      
      // Verify formula exists
      const formula = device.formulas?.find(f => f.id === formulaId);
      if (!formula) {
        throw new Error(`Formula '${formulaId}' not found. Please reconfigure this flow card with an existing formula.`);
      }
      
      return device.hasFormulaTimedOut(formulaId);
    });
  }
};