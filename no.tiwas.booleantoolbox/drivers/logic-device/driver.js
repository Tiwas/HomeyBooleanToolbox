'use strict';

const Homey = require('homey');
const Logger = require('../../lib/Logger');

module.exports = class LogicDeviceDriver extends Homey.Driver {
  async ensureUniqueDeviceName(name) {
    try {
      if (!this.homey.app.api) return name;
      const all = await this.homey.app.api.devices.getDevices();
      const existingNames = new Set(
        Object.values(all).map(d => (d?.name || '').trim()).filter(Boolean)
      );

      if (!existingNames.has(name)) return name;

      const base = name.replace(/\s+\d+$/, '').trim();
      const m = name.match(/\s+(\d+)$/);
      let n = m ? (parseInt(m[1], 10) + 1) : 2;

      let candidate = `${base} ${n}`;
      while (existingNames.has(candidate)) {
        n++;
        candidate = `${base} ${n}`;
      }
      return candidate;
    } catch (e) {
      this.logger.error('ensureUniqueDeviceName failed:', e.message);
      return name;
    }
  }

  async onInit() {
    const driverName = this.constructor.name || 'LogicDriver';
    this.logger = new Logger(this, driverName);

    this.logger.info('Logic Device Driver has been initialized');
  }

  async onPair(session) {
    this.logger.info('Pairing session started');

    let numInputs = 2;
    let inputLinks = [];
    let deviceName = 'Logic Device';

    session.setHandler('get_num_inputs', async () => {
      this.logger.debug('[PAIR] get_num_inputs called');
      return { numInputs };
    });

    session.setHandler('set_num_inputs', async (data) => {
      this.logger.debug('[PAIR] set_num_inputs called with data:', data);
      numInputs = parseInt(data.numInputs);
      return { success: true };
    });

    session.setHandler('get_zones', async () => {
      this.logger.debug('[PAIR] get_zones called');
      try {
        return await this.homey.app.getAvailableZones();
      } catch (e) {
        this.logger.error('[PAIR] ERROR in get_zones:', e.message);
        throw new Error(`Failed to get zones: ${e.message}`);
      }
    });

    session.setHandler('get_devices_in_zone', async (data) => {
      this.logger.debug(`[PAIR] get_devices_in_zone called for zone: ${data.zoneId}`);
      if (!data.zoneId) return [];
      try {
        return await this.homey.app.getDevicesInZone(data.zoneId);
      } catch (e) {
        this.logger.error('[PAIR] ERROR in get_devices_in_zone:', e.message);
        throw new Error(`Failed to get devices: ${e.message}`);
      }
    });

    session.setHandler('set_input_links', async (data) => {
      this.logger.debug('[PAIR] set_input_links called');
      inputLinks = data.inputLinks;
      return { success: true };
    });

    session.setHandler('set_device_name', async (data) => {
      this.logger.debug('[PAIR] set_device_name called with:', data.name);
      deviceName = data.name;
      return { success: true };
    });

    session.setHandler('create_device', async () => {
      this.logger.info('[PAIR] create_device called');

      if (!inputLinks || inputLinks.length === 0) {
        throw new Error('No input links configured!');
      }

      const uniqueName = await this.ensureUniqueDeviceName(deviceName);

      const device = {
        name: uniqueName,
        data: {
          id: `logic-device-${Date.now()}`,
          numInputs
        },
        settings: {
          input_links: JSON.stringify(inputLinks),
          formulas: JSON.stringify([{
            id: 'formula_1',
            name: 'Main Formula',
            expression: this.getDefaultExpression(numInputs),
            enabled: true,
            timeout: 0,
            firstImpression: false
          }])
        }
      };

      this.logger.info('[PAIR] Creating device:', JSON.stringify(device, null, 2));
      return device;
    });

    this.logger.debug('Pairing handlers registered');
  }

  getDefaultExpression(numInputs) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    return letters.slice(0, numInputs).join(' AND ');
  }
};
