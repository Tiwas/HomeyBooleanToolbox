'use strict';

const Homey = require('homey');

class StateDevice extends Homey.Device {

  async onInit() {
    this.debug('StateDevice has been initialized');
    
    // Listen for the onoff capability change (UI trigger)
    this.registerCapabilityListener('onoff', async (value) => {
        if (value) {
            // Execute async without awaiting to return quickly to UI
            this.applyState().catch(e => this.error('Error applying state:', e));
            
            // Reset switch to off after a short delay (push button behavior)
            this.resetTimer = setTimeout(() => {
                this.setCapabilityValue('onoff', false).catch(this.error);
            }, 1000);
        }
    });
  }

  debug(...args) {
      if (this.homey.settings.get('debug_mode')) {
          this.log('[DEBUG]', ...args);
      }
  }
  
  async onDeleted() {
      if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  async applyState() {
    this.debug('Applying state configuration...');
    
    const jsonStr = this.getSetting('json_data');
    const logErrors = this.getSetting('log_errors');

    if (!jsonStr) {
        this.error('No configuration data found.');
        return;
    }

    let configObj;
    try {
        configObj = JSON.parse(jsonStr);
    } catch (e) {
        this.error('Invalid JSON configuration:', e);
        if (logErrors) this.homey.flow.getTriggerCard('state_error_occurred_sd').trigger(this, { error: 'Invalid JSON' }).catch(this.error);
        return;
    }

    const items = configObj.items;
    if (!Array.isArray(items) || items.length === 0) {
        this.debug('No items to process.');
        return;
    }

    const globalDelay = configObj.config?.default_delay || 200;
    const ignoreErrors = configObj.config?.ignore_errors !== false; // Default to true

    // Get API client
    const api = this.homey.app.api;
    if (!api) {
        this.error('Homey API not ready.');
        if (logErrors) this.homey.flow.getTriggerCard('state_error_occurred_sd').trigger(this, { error: 'API not ready' }).catch(this.error);
        return;
    }

    this.debug(`Starting sequence for ${items.length} items...`);

    for (const item of items) {
        // Check for cancellation/stop? (Not implemented yet, but good to keep in mind)
        
        const deviceId = item.id;
        const capabilities = item.capabilities;
        const itemDelay = (item.delay !== undefined) ? item.delay : globalDelay;

        if (!deviceId || !capabilities) continue;

        // Wait delay
        if (itemDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, itemDelay));
        }

        try {
            // Fetch device instance to ensure it exists
            // Note: getDevice({id}) is efficient in athom-api (cached)
            const apiDevice = await api.devices.getDevice({ id: deviceId });

            for (const [capId, value] of Object.entries(capabilities)) {
                try {
                    await apiDevice.setCapabilityValue(capId, value);
                    this.debug(`Set ${item.name} (${capId}) -> ${value}`);
                } catch (capError) {
                    this.error(`Failed to set ${item.name} (${capId}):`, capError);
                    if (!ignoreErrors) throw capError;
                }
            }

        } catch (devError) {
            this.error(`Device error for ${item.name} (${deviceId}):`, devError);
            
            if (logErrors) {
                 // We can trigger an error card, or just log to timeline
                 // Let's log to timeline if severe
                 this.homey.notifications.createNotification({
                     excerpt: `State Device Error: Failed to control ${item.name}`
                 }).catch(() => {});
            }

            if (!ignoreErrors) {
                this.debug('Stopping sequence due to error (ignore_errors=false).');
                this.homey.flow.getTriggerCard('state_error_occurred_sd').trigger(this, { error: devError.message }).catch(this.error);
                return; 
            }
        }
    }

    this.debug('Sequence completed.');
    this.homey.flow.getTriggerCard('state_applied_successfully_sd').trigger(this).catch(this.error);
  }

  async onFlowActionApplyState(args) {
      return this.applyState();
  }

}

module.exports = StateDevice;