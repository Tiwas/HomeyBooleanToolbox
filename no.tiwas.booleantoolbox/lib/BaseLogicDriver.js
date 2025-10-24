'use strict';
const Homey = require('homey');
const Logger = require('./Logger');

module.exports = class BaseLogicDriver extends Homey.Driver {
  async onInit() {
    const driverName = `Driver: ${this.id}`;
    this.logger = new Logger(this, driverName);

    const driverId = this.id;
    const numInputs = parseInt(driverId.split('-').pop());
    this.numInputs = numInputs;
    // FIKS: Send nøkkel, ikke oversatt tekst
    this.logger.info('driver.ready');
  }

  // Ensures unique device name: "X 2", "X 3", ...
  async ensureUniqueDeviceName(name) {
    try {
      if (!this.homey.app.api) return name; // fallback if API is not ready
      const all = await this.homey.app.api.devices.getDevices();
      const existing = new Set(
        Object.values(all).map(d => (d?.name || '').trim()).filter(Boolean)
      );

      if (!existing.has(name)) return name;

      const base = name.replace(/\s+\d+$/, '').trim();
      const m = name.match(/\s+(\d+)$/);
      let n = m ? (parseInt(m[1], 10) + 1) : 2;

      let candidate = `${base} ${n}`;
      while (existing.has(candidate)) {
        n++;
        candidate = `${base} ${n}`;
      }
      return candidate;
    } catch (e) {
      // FIKS: Send nøkkel og error-objekt
      this.logger.error('driver.ensure_unique_failed', e);
      return name; // don't crash on error
    }
  }

  async onPair(session) {
    session.setHandler('list_devices', async () => {
      const baseName = this.homey.__('device.logic_unit_name', { count: this.numInputs });
      const name = await this.ensureUniqueDeviceName(baseName);
      return [{
        name,
        data: {
          id: `logic-unit-${this.numInputs}-${Date.now()}`,
          numInputs: this.numInputs
        }
      }];
    });
  }
};
