'use strict';

const Homey = require('homey');

module.exports = class LogicUnitDriver extends Homey.Driver {

  async onInit() {
    this.log('Logic Unit Driver has been initialized');
  }

  async onPair(session) {
    session.setHandler('list_devices', async () => {
      return [{
        name: 'New Logic Unit',
        data: {
          id: `logic-unit-${Date.now()}`
        }
      }];
    });
  }
};