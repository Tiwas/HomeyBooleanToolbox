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
      // FIKS: Send nøkkel og error-objekt
      this.logger.error('driver.ensure_unique_failed', e);
      return name;
    }
  }

  async onInit() {
    const driverName = `Driver: ${this.id}`;
    this.logger = new Logger(this, driverName);

    // FIKS: Send nøkkel
    this.logger.info('driver.ready');
  }

  async onPair(session) {
    // FIKS: Send nøkkel
    this.logger.info('pair.session_started');

    let numInputs = 2;
    let inputLinks = [];
    let deviceName = this.homey.__('pair.name_placeholder');

    session.setHandler('get_num_inputs', async () => {
      // FIKS: Send nøkkel
      this.logger.debug('pair.get_num_inputs');
      return { numInputs };
    });

    session.setHandler('set_num_inputs', async (data) => {
      // FIKS: Send nøkkel og data-objekt
      this.logger.debug('pair.set_num_inputs', data);
      numInputs = parseInt(data.numInputs);
      return { success: true };
    });

    session.setHandler('get_zones', async () => {
      // FIKS: Send nøkkel
      this.logger.debug('pair.get_zones');
      try {
        return await this.homey.app.getAvailableZones();
      } catch (e) {
        // FIKS: Send nøkkel og error-objekt
        this.logger.error('pair.get_zones_error', e);
        throw new Error(this.homey.__('errors.connection_failed'));
      }
    });

    session.setHandler('get_devices_in_zone', async (data) => {
      // FIKS: Send nøkkel og data-objekt
      this.logger.debug('pair.get_devices_in_zone', { zone: data.zoneId });
      if (!data.zoneId) return [];
      try {
        return await this.homey.app.getDevicesInZone(data.zoneId);
      } catch (e) {
        // FIKS: Send nøkkel og error-objekt
        this.logger.error('pair.get_devices_error', e);
        throw new Error(this.homey.__('errors.connection_failed'));
      }
    });

    session.setHandler('set_input_links', async (data) => {
      // FIKS: Send nøkkel
      this.logger.debug('pair.set_input_links');
      inputLinks = data.inputLinks;
      return { success: true };
    });

    session.setHandler('set_device_name', async (data) => {
      // FIKS: Send nøkkel og data-objekt
      this.logger.debug('pair.set_device_name', { name: data.name });
      deviceName = data.name;
      return { success: true };
    });

    session.setHandler('create_device', async () => {
      // FIKS: Send nøkkel
      this.logger.info('pair.create_device');

      if (!inputLinks || inputLinks.length === 0) {
        throw new Error(this.homey.__('errors.invalid_input'));
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
            name: this.homey.__('formula.default_name'),
            expression: this.getDefaultExpression(numInputs),
            enabled: true,
            timeout: 0,
            firstImpression: false
          }])
        }
      };

      // FIKS: Send nøkkel og data-objekt + bruk dump for detaljer
      this.logger.info('pair.creating_device', { name: uniqueName });
      this.logger.dump('Device data', device);
      return device;
    });

    // FIKS: Send nøkkel
    this.logger.debug('pair.handlers_registered');
  }

  getDefaultExpression(numInputs) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    return letters.slice(0, numInputs).join(' AND ');
  }
};
