'use strict';

const Homey = require('homey');

module.exports = class BaseLogicDriver extends Homey.Driver {

  async onInit() {
    const driverId = this.id;
    const numInputs = parseInt(driverId.split('-').pop());
    this.numInputs = numInputs;
    
    this.log(`Logic Unit Driver (${this.numInputs} inputs) has been initialized`);
  }

  async onPair(session) {
    session.setHandler('list_devices', async () => {
      return [{
        name: `Logic Unit (${this.numInputs} inputs)`,
        data: {
          id: `logic-unit-${this.numInputs}-${Date.now()}`,
          numInputs: this.numInputs
        }
      }];
    });
  }
};