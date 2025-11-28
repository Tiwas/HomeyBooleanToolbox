'use strict';

const Homey = require('homey');

class StateDriver extends Homey.Driver {

    async onInit() {
        this.debug('StateDriver has been initialized');
        this.registerFlowCards();
    }

    debug(...args) {
        if (this.homey.settings.get('debug_mode')) {
            this.log('[DEBUG]', ...args);
        }
    }

    registerFlowCards() {
        this.homey.flow.getActionCard('apply_state_sd')
            .registerRunListener(async (args, state) => {
                return args.device.onFlowActionApplyState(args);
            });
    }

    async onPair(session) {
        this.debug('StateDriver pairing started');

        let generatedConfig = null;
        let candidateItems = []; // Intermediate storage

        // Handler: Get Zones
        session.setHandler('get_zones', async () => {
            try {
                if (!this.homey.app || typeof this.homey.app.getAvailableZones !== 'function') {
                    return [];
                }

                const result = await this.homey.app.getAvailableZones();
                
                if (!result || !Array.isArray(result)) {
                    return [];
                }

                return result;
            } catch (e) {
                this.error('Error getting zones:', e);
                throw new Error(this.homey.__('errors.connection_failed') + ': ' + e.message);
            }
        });

        // Handler: Generate Snapshot Candidates
        session.setHandler('generate_snapshot', async (data) => {
            this.debug('Generating snapshot candidates...', data);
            
            try {
                const api = this.homey.app.api;
                if (!api) {
                    throw new Error('Homey API not ready. Please try again in a few seconds.');
                }

                const allDevices = await api.devices.getDevices();
                const allZones = await api.zones.getZones(); // Get zones for name resolution
                
                const selectedZones = new Set(data.zones || []);
                const wholeHouse = data.wholeHouse === true;

                candidateItems = [];

                for (const deviceId in allDevices) {
                    const device = allDevices[deviceId];

                    // Filter by Zone
                    if (!wholeHouse && !selectedZones.has(device.zone)) {
                        continue;
                    }
                    
                    // Skip our own State Devices to avoid recursion loops
                    if (device.driverUri && device.driverUri.includes('state-device')) {
                        continue;
                    }

                    // Analyze Capabilities
                    const deviceCapabilities = {};
                    let hasSetableCapabilities = false;

                    if (device.capabilitiesObj) {
                        for (const capId in device.capabilitiesObj) {
                            const capDef = device.capabilitiesObj[capId];
                            
                            // Only include SETABLE capabilities
                            if (capDef.setable) {
                                // Some capabilities might have null value if never set
                                if (capDef.value !== undefined && capDef.value !== null) {
                                    deviceCapabilities[capId] = capDef.value;
                                    hasSetableCapabilities = true;
                                }
                            }
                        }
                    }

                    // Add to list if it has useful capabilities
                    if (hasSetableCapabilities) {
                        const zoneName = allZones[device.zone] ? allZones[device.zone].name : 'Unknown';
                        candidateItems.push({
                            name: device.name,
                            id: device.id,
                            zoneName: zoneName,
                            capabilities: deviceCapabilities
                        });
                    }
                }

                // Sort by name for readability
                candidateItems.sort((a, b) => a.name.localeCompare(b.name));

                this.debug(`Found ${candidateItems.length} candidate devices.`);
                return { success: true, count: candidateItems.length };

            } catch (e) {
                this.error('Error generating snapshot:', e);
                throw e;
            }
        });

        // Handler: Get Candidates for Selection View
        session.setHandler('get_snapshot_candidates', async () => {
            this.debug('get_snapshot_candidates called. Items:', candidateItems.length);
            try {
                // Return simplified objects for UI
                const mapped = candidateItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    zoneName: item.zoneName
                }));
                this.debug('Returning mapped items:', mapped.length);
                return mapped;
            } catch (e) {
                this.error('Error mapping candidates:', e);
                throw e;
            }
        });

        // Handler: Save Selection and Generate Final JSON
        session.setHandler('save_selection', async (data) => {
            const selectedIds = new Set(data.selectedIds || []);
            
            const finalItems = candidateItems.filter(item => selectedIds.has(item.id));
            
            // Remove zoneName property from final JSON as it's not needed for logic
            const cleanItems = finalItems.map(item => ({
                name: item.name,
                id: item.id,
                capabilities: item.capabilities
                // delay: 0 // optional
            }));

            generatedConfig = {
                config: {
                    default_delay: 200,
                    ignore_errors: true
                },
                items: cleanItems
            };

            this.debug(`Final configuration generated with ${cleanItems.length} devices.`);
            return { success: true };
        });

        // Handler: Get Generated JSON (for the edit view)
        session.setHandler('get_generated_json', async () => {
            return generatedConfig || { config: {}, items: [] };
        });

        // Handler: Create Device
        session.setHandler('create_device', async (data) => {
            const name = data.name;
            const jsonData = data.json_data; // String

            this.debug('Creating device:', name);

            return {
                name: name,
                data: {
                    id: `state-device-${Date.now()}`
                },
                settings: {
                    json_data: jsonData,
                    log_errors: true
                }
            };
        });
    }

}

module.exports = StateDriver;