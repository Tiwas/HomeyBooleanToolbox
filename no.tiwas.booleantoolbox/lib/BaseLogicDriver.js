'use strict';
const Homey = require('homey');

module.exports = class BaseLogicDriver extends Homey.Driver {
  async onInit() {
    const driverId = this.id;
    const numInputs = parseInt(driverId.split('-').pop());
    this.numInputs = numInputs;
    this.log(`Logic Unit Driver (${this.numInputs} inputs) has been initialized`);
  }

  // Sikrer unikt navn: "X 2", "X 3", ...
  async ensureUniqueDeviceName(name) {
    try {
      if (!this.homey.app.api) return name; // fallback hvis API ikke er klart
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
      this.error('ensureUniqueDeviceName failed:', e.message);
      return name; // ikke kræsje ved feil
    }
  }

  async onPair(session) {
    session.setHandler('list_devices', async () => {
      const baseName = `Logic Unit (${this.numInputs} inputs)`;
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