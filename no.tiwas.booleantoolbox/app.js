'use strict';

const Homey = require('homey');

module.exports = class BooleanToolboxApp extends Homey.App {

  async onInit() {
    this.log('Boolean Toolbox has been initialized');
    this.registerFlowCards();
  }

  registerFlowCards() {
    // Helper function to get all Logic Units
    const getLogicUnits = async (query) => {
      const driver = this.homey.drivers.getDriver('logic-unit');
      const devices = driver.getDevices();
      
      return devices
        .filter(device => {
          if (!query) return true;
          return device.getName().toLowerCase().includes(query.toLowerCase());
        })
        .map(device => ({
          id: device.getData().id,
          name: device.getName(),
          description: device.getSettings().expression || '(no expression)',
          device: device
        }));
    };

    // Register TRIGGER cards
    const outputTrueCard = this.homey.flow.getDeviceTriggerCard('output_changed_to_true');
    outputTrueCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getLogicUnits(query);
    });

    const outputFalseCard = this.homey.flow.getDeviceTriggerCard('output_changed_to_false');
    outputFalseCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getLogicUnits(query);
    });

    // Register EVALUATE action
    const evaluateCard = this.homey.flow.getActionCard('evaluate_logic');
    evaluateCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getLogicUnits(query);
    });
    evaluateCard.registerRunListener(async (args) => {
      const driver = this.homey.drivers.getDriver('logic-unit');
      const device = driver.getDevice({ id: args.device.id });
      await device.evaluateLogicAndReturn();
      return true;
    });

    // Register all SET INPUT actions (A-E, true/false)
    ['a', 'b', 'c', 'd', 'e'].forEach(inputId => {
      [true, false].forEach(value => {
        const cardId = `set_input_${inputId}_${value ? 'true' : 'false'}`;
        const card = this.homey.flow.getActionCard(cardId);
        
        card.registerArgumentAutocompleteListener('device', async (query) => {
          return await getLogicUnits(query);
        });
        
        card.registerRunListener(async (args) => {
          const driver = this.homey.drivers.getDriver('logic-unit');
          const device = driver.getDevice({ id: args.device.id });
          await device.setInputStateAndEvaluate(inputId, value);
          return true;
        });
      });
    });

    // Register CONDITION card (output_is)
    const conditionCard = this.homey.flow.getConditionCard('output_is');
    
    conditionCard.registerArgumentAutocompleteListener('device', async (query) => {
      return await getLogicUnits(query);
    });
    
    conditionCard.registerRunListener(async (args) => {
      const driver = this.homey.drivers.getDriver('logic-unit');
      const device = driver.getDevice({ id: args.device.id });
      const result = device.getCapabilityValue('onoff');
      return result.toString() === args.what_is;
    });
  }
};