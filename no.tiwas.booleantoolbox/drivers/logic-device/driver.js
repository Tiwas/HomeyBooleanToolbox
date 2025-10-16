'use strict';

const Homey = require('homey');

module.exports = class LogicDeviceDriver extends Homey.Driver {
  async ensureUniqueDeviceName(name) {
    try {
      // Bruk Athom API som appen allerede initialiserer (app.js)
      if (!this.homey.app.api) return name;
      const all = await this.homey.app.api.devices.getDevices();
      const existingNames = new Set(
        Object.values(all).map(d => (d?.name || '').trim()).filter(Boolean)
      );

      if (!existingNames.has(name)) return name;

      // Fjern ev. trailing tall for å finne base
      const base = name.replace(/\s+\d+$/, '').trim();
      // Hvis det allerede er et tall bakerst, start fra n+1, ellers 2
      const m = name.match(/\s+(\d+)$/);
      let n = m ? (parseInt(m[1], 10) + 1) : 2;

      let candidate = `${base} ${n}`;
      while (existingNames.has(candidate)) {
        n++;
        candidate = `${base} ${n}`;
      }
      return candidate;
    } catch (e) {
      this.error('ensureUniqueDeviceName failed:', e.message);
      // Fall back til opprinnelig navn ved feil
      return name;
    }
  }

  async onInit() {
    this.log('Logic Device Driver has been initialized');
  }

  async onPair(session) {
    this.log('=== PAIRING SESSION STARTED ===');
    
    let numInputs = 2;
    let inputLinks = [];
    let deviceName = 'Logic Device';

    session.setHandler('get_num_inputs', async () => {
      this.log('[HANDLER] get_num_inputs called');
      return { numInputs };
    });

    session.setHandler('set_num_inputs', async (data) => {
      this.log('[HANDLER] set_num_inputs called with data:', data);
      numInputs = parseInt(data.numInputs);
      return { success: true };
    });

    session.setHandler('get_zones', async () => {
      this.log('[HANDLER] get_zones called');
      try {
        return await this.homey.app.getAvailableZones();
      } catch (e) {
        this.error('[HANDLER] ERROR in get_zones:', e.message);
        throw new Error(`Failed to get zones: ${e.message}`);
      }
    });

    session.setHandler('get_devices_in_zone', async (data) => {
      this.log(`[HANDLER] get_devices_in_zone called for zone: ${data.zoneId}`);
      if (!data.zoneId) return [];
      try {
        return await this.homey.app.getDevicesInZone(data.zoneId);
      } catch (e) {
        this.error('[HANDLER] ERROR in get_devices_in_zone:', e.message);
        throw new Error(`Failed to get devices: ${e.message}`);
      }
    });

    session.setHandler('set_input_links', async (data) => {
      this.log('[HANDLER] set_input_links called');
      inputLinks = data.inputLinks;
      return { success: true };
    });

    session.setHandler('set_device_name', async (data) => {
      this.log('[HANDLER] set_device_name called with:', data.name);
      deviceName = data.name;
      return { success: true };
    });

    // Opprett device når bruker klikker Complete

    session.setHandler('create_device', async () => {
      this.log('[HANDLER] create_device called');

      if (!inputLinks || inputLinks.length === 0) {
        throw new Error('No input links configured!');
      }

      // 🔧 Sjekk om navnet finnes – legg på tall/øk ved behov
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
            firstImpression: false // Default FALSE for kontinuerlig evaluering
          }])
        }
      };
      
      this.log('[HANDLER] Creating device:', JSON.stringify(device, null, 2));
      return device;
    });

    this.log('=== PAIRING HANDLERS REGISTERED ===');
  }

  getDefaultExpression(numInputs) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    return letters.slice(0, numInputs).join(' AND ');
  }
};