"use strict";

const Homey = require("homey");
const Logger = require("./lib/Logger");
const WaiterManager = require("./lib/WaiterManager");

// Import autocomplete helpers from BaseLogicDriver
// NOTE: Requires BaseLogicDriver to export them correctly
const {
    formulaAutocompleteHelper,
    inputAutocompleteHelper,
} = require("./lib/BaseLogicDriver");

// Helper function (only for evaluate_expression)
function evaluateCondition(inputValue, operator, ruleValue) {
    switch (operator) {
        case "gt":
            return inputValue > ruleValue;
        case "gte":
            return inputValue >= ruleValue;
        case "lt":
            return inputValue < ruleValue;
        case "lte":
            return inputValue <= ruleValue;
        default:
            return false;
    }
}

module.exports = class BooleanToolboxApp extends Homey.App {
    async onInit() {
        this.logger = new Logger(this, "App");
        try {
            const version = require("./package.json").version;
            this.logger.banner(`BOOLEAN TOOLBOX v${version}`);
        } catch (e) {
            this.logger.error(
                "Failed to load package.json or display banner",
                e,
            );
            this.logger.banner(`BOOLEAN TOOLBOX vUNKNOWN`); // Fallback banner
        }

        // Initialize API
        try {
            const athomApi = require("athom-api");

            this.logger.debug("app.athom_api_loaded");

            const { HomeyAPI } = athomApi;

            this.logger.debug("app.homey_api_extracted", {
                type: typeof HomeyAPI,
            });

            if (typeof HomeyAPI.forCurrentHomey === "function") {
                this.logger.debug("app.initializing_homey_api");
                this.api = await HomeyAPI.forCurrentHomey(this.homey);
            } else {
                this.logger.error("app.homey_api_not_function");

                this.logger.debug("app.homey_api_methods", {
                    keys: Object.keys(HomeyAPI),
                });
            }
        } catch (e) {
            this.logger.error("errors.connection_failed", {
                message: e.message,
            });

            this.logger.debug("app.error_stack", {
                stack: e.stack,
            });
        }

        // Initialize WaiterManager
        this.waiterManager = new WaiterManager(this.homey, this.logger);

        // Register ALL Flow Cards here using generic methods
        await this.registerAllFlowCards();

        this.logger.info("App initialization complete.", {});
    }

    async onUninit() {
        // Cleanup WaiterManager
        if (this.waiterManager) {
            this.waiterManager.destroy();
        }
        this.logger.info("App uninitialized.", {});
    }

    async getAvailableZones() {
        this.logger.debug("app.getting_zones");
        try {
            if (!this.api) {
                const athomApi = require("athom-api");
                const { HomeyAPI } = athomApi;
                this.api = await HomeyAPI.forCurrentHomey(this.homey);
            }
            const zones = await this.api.zones.getZones();
            const zoneList = Object.values(zones).map((zone) => ({
                id: zone.id,
                name: zone.name,
            }));
            zoneList.sort((a, b) => a.name.localeCompare(b.name));

            this.logger.debug("app.found_zones", {
                count: zoneList.length,
            });
            return zoneList;
        } catch (e) {
            this.logger.error("app.error_getting_zones", {
                message: e.message,
            });
            return [];
        }
    }

    async getDevicesInZone(zoneId) {
        this.logger.debug("app.getting_devices_for_zone", {
            zoneId,
        });
        const deviceList = [];
        try {
            if (!this.api) {
                const athomApi = require("athom-api");
                const { HomeyAPI } = athomApi;
                this.api = await HomeyAPI.forCurrentHomey(this.homey);
            }

            const allDevices = await this.api.devices.getDevices();
            for (const deviceId in allDevices) {
                const device = allDevices[deviceId];
                if (device.zone !== zoneId) continue;
                if (device.driverUri?.includes("logic-device")) continue;

                const capabilities = device.capabilities || [];
                if (capabilities.length === 0) continue;

                const capabilityList = capabilities.map((cap) => {
                    const capObj = device.capabilitiesObj?.[cap];
                    return {
                        id: cap,
                        name:
                            capObj?.title ||
                            cap
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase()),
                        type: capObj?.type || "unknown",
                    };
                });

                deviceList.push({
                    id: deviceId,
                    name: device.name,
                    driverName: device.driverUri?.split(":").pop() || "Unknown",
                    capabilities: capabilityList,
                });
            }

            deviceList.sort((a, b) => a.name.localeCompare(b.name));

            this.logger.debug("app.found_devices_in_zone", {
                count: deviceList.length,
                zoneId,
            });
        } catch (e) {
            this.logger.error("app.error_getting_devices", {
                zoneId,
                message: e.message,
            });
        }
        return deviceList;
    }

    // --- Helper for Autocomplete Registration ---
    registerAutocomplete(card, argName, helperFn) {
        try {
            if (typeof helperFn !== "function") {
                throw new Error(
                    this.homey.__("errors.helper_not_function", { argName }),
                );
            }
            card.registerArgumentAutocompleteListener(
                argName,
                async (query, args) => {
                    const device = args?.device;
                    // For device card arguments, check that we have a device
                    if (argName === "formula" || argName === "input") {
                        if (!device) {
                            this.logger.warn(
                                `Autocomplete for device arg '${argName}' on card '${card.id}' called without device context.`,
                            );
                            return [];
                        }
                        // Check if the device has the required method
                        let requiredMethod = "";
                        if (argName === "formula")
                            requiredMethod = "getFormulas";
                        if (argName === "input")
                            requiredMethod = "getInputOptions";

                        if (typeof device[requiredMethod] !== "function") {
                            this.logger.warn(
                                `Autocomplete for device arg '${argName}' on card '${card.id}': Device ${device.getName()} missing method ${requiredMethod}.`,
                            );
                            return [];
                        }
                    }
                    // Run the helper itself
                    try {
                        return await helperFn(query, args); // Pass the entire args object, the helper must extract the device
                    } catch (autocompleteError) {
                        this.logger.error(
                            `Error during autocomplete for ${argName} on card '${card.id}'`,
                            autocompleteError,
                        );
                        return [];
                    }
                },
            );
            this.logger.debug(
                `Registered ${argName.toUpperCase()} autocomplete for card '${card.id}'`,
            );
        } catch (e) {
            this.logger.error(
                ` -> FAILED to register autocomplete for '${argName}' on card '${card.id}'`,
                e,
            );
        }
    }

    // --- Register ALL Flow Cards Here ---
    async registerAllFlowCards() {
        this.logger.debug("app.registering_flow_cards", {});

        // --- Actions ---
        const actionCards = [
            {
                id: "evaluate_expression",
                type: "app",
            }, // App Action
        ];
        actionCards.forEach((cardInfo) => {
            try {
                const card = this.homey.flow.getActionCard(cardInfo.id);
                card.registerRunListener(async (args, state) => {
                    const device = args.device;
                    if (!device)
                        throw new Error(
                            this.homey.__("errors.invalid_device_instance"),
                        );
                    const methodName = cardInfo.handler;
                    if (typeof device[methodName] !== "function")
                        throw new Error(
                            this.homey.__("errors.method_missing_on_device", {
                                methodName,
                            }),
                        );
                    this.logger.flow(
                        `Executing ACTION '${cardInfo.id}' on device ${device.getName()}`,
                    );
                    return await device[methodName](args, state);
                });

                // --- Autocomplete ---
                if (
                    [
                        "set_input_value_lu",
                        "evaluate_formula_lu",
                        "clear_error_state_lu",
                    ].includes(cardInfo.id)
                ) {
                    this.registerAutocomplete(
                        card,
                        "formula",
                        formulaAutocompleteHelper,
                    );
                }
                if (
                    ["set_input_value_lu", "set_input_lu"].includes(cardInfo.id)
                ) {
                    this.registerAutocomplete(
                        card,
                        "input",
                        inputAutocompleteHelper,
                    );
                }
                this.logger.debug(
                    ` -> OK: ACTION card registered: '${cardInfo.id}'`,
                );
            } catch (e) {
                this.logger.error(
                    ` -> FAILED: Registering ACTION card '${cardInfo.id}'`,
                    e,
                );
            }
        });

        // --- Conditions ---
        const conditionCards = [
            {
                id: "has_error",
                type: "app",
            }, // App Condition
        ];

        conditionCards.forEach((cardInfo) => {
            try {
                const card = this.homey.flow.getConditionCard(cardInfo.id);
                card.registerRunListener(async (args, state) => {
                    const device = args.device;
                    if (!device) return false;
                    if (typeof device.onFlowCondition !== "function")
                        return false;

                    let checkType;
                    if (cardInfo.checkType) {
                        checkType = cardInfo.checkType;
                    } else if (cardInfo.checkTypeFromArg) {
                        checkType = args[cardInfo.checkTypeFromArg] === "true";
                    }

                    this.logger.flow(
                        `Executing CONDITION '${cardInfo.id}' on device ${device.getName()}`,
                    );
                    return await device.onFlowCondition(args, state, checkType);
                });

                if (
                    [
                        "formula_has_timed_out_lu",
                        "formula_result_is_lu",
                    ].includes(cardInfo.id)
                ) {
                    this.registerAutocomplete(
                        card,
                        "formula",
                        formulaAutocompleteHelper,
                    );
                }
                this.logger.debug(
                    ` -> OK: CONDITION card registered: '${cardInfo.id}'`,
                );
            } catch (e) {
                this.logger.error(
                    ` -> FAILED: Registering CONDITION card '${cardInfo.id}'`,
                    e,
                );
            }
        });

        // --- App-level Triggers ---
        try {
            const anyConfigAlarmCard = this.homey.flow.getTriggerCard("any_config_alarm_changed");
            anyConfigAlarmCard.registerRunListener(async (args, state) => {
                const expectedDeviceType = args.device_type;
                const expectedAlarmState = args.alarm_state === "true";

                // Match device type filter
                let deviceTypeMatches = false;
                if (expectedDeviceType === "any") {
                    deviceTypeMatches = true;
                } else if (expectedDeviceType === "logic-unit") {
                    deviceTypeMatches = state?.driver_id?.startsWith("logic-unit");
                } else if (expectedDeviceType === "logic-device") {
                    deviceTypeMatches = state?.driver_id === "logic-device";
                }

                // Match alarm state
                const alarmStateMatches = state?.alarm_state === expectedAlarmState;

                return deviceTypeMatches && alarmStateMatches;
            });
            this.logger.debug(` -> OK: APP TRIGGER registered: 'any_config_alarm_changed'`);
        } catch (e) {
            this.logger.error(` -> FAILED: Registering APP TRIGGER 'any_config_alarm_changed'`, e);
        }

        // Register any_config_alarm_state_changed trigger (no alarm_state filter)
        try {
            const anyConfigAlarmStateChangedCard = this.homey.flow.getTriggerCard("any_config_alarm_state_changed");
            anyConfigAlarmStateChangedCard.registerRunListener(async (args, state) => {
                const expectedDeviceType = args.device_type;

                // Match device type filter
                let deviceTypeMatches = false;
                if (expectedDeviceType === "any") {
                    deviceTypeMatches = true;
                } else if (expectedDeviceType === "logic-unit") {
                    deviceTypeMatches = state?.driver_id?.startsWith("logic-unit");
                } else if (expectedDeviceType === "logic-device") {
                    deviceTypeMatches = state?.driver_id === "logic-device";
                }

                return deviceTypeMatches;
            });
            this.logger.debug(` -> OK: APP TRIGGER registered: 'any_config_alarm_state_changed'`);
        } catch (e) {
            this.logger.error(` -> FAILED: Registering APP TRIGGER 'any_config_alarm_state_changed'`, e);
        }

        // --- Wait Action ---

        // Action: Wait (simple delay)
        try {
            const waitCard = this.homey.flow.getActionCard("wait");
            waitCard.registerRunListener(async (args, state) => {
                const timeoutValue = Number(args.timeout_value) || 0;
                const timeoutUnit = args.timeout_unit || 's';

                // Convert to milliseconds
                const multipliers = {
                    'ms': 1,
                    's': 1000,
                    'm': 60000,
                    'h': 3600000
                };
                const timeoutMs = timeoutValue * (multipliers[timeoutUnit] || 1000);

                this.logger.info(`⏸️  Waiting ${timeoutValue} ${timeoutUnit} (${timeoutMs}ms)...`);

                // Simple promise-based wait
                await new Promise(resolve => setTimeout(resolve, timeoutMs));

                this.logger.info(`✅ Wait complete, continuing flow`);
                return true;
            });

            this.logger.debug(` -> OK: ACTION registered: 'wait'`);
        } catch (e) {
            this.logger.error(` -> FAILED: Registering ACTION 'wait'`, e);
        }

        // --- Waiter Gates ---

        // Condition: Wait until becomes true
        try {
            const waitUntilCard = this.homey.flow.getConditionCard("wait_until_becomes_true");

            // Register autocomplete for capability argument
            waitUntilCard.registerArgumentAutocompleteListener('capability', async (query, args) => {
                try {
                    const device = args.device; // Get selected device
                    if (!device) return [];

                    const capabilities = device.capabilities || [];
                    const results = capabilities.map(capId => {
                        return {
                            name: capId,
                            description: `Capability: ${capId}`,
                            id: capId
                        };
                    });

                    // Filter by query if provided
                    if (query) {
                        return results.filter(r =>
                            r.name.toLowerCase().includes(query.toLowerCase())
                        );
                    }

                    return results;
                } catch (error) {
                    this.logger.error('Capability autocomplete error:', error);
                    return [];
                }
            });

            // Register autocomplete for device argument
            waitUntilCard.registerArgumentAutocompleteListener('device', async (query, args) => {
                try {
                    const devices = Object.values(this.homey.drivers.getDrivers())
                        .flatMap(driver => driver.getDevices())
                        .filter(device => {
                            // Filter devices with capabilities
                            const capabilities = device.capabilities || [];
                            if (capabilities.length === 0) return false;

                            // Filter by query if provided
                            if (query) {
                                return device.getName().toLowerCase().includes(query.toLowerCase());
                            }
                            return true;
                        })
                        .map(device => ({
                            name: device.getName(),
                            description: `${device.capabilities?.length || 0} capabilities`,
                            id: device.getData().id,
                            capabilities: device.capabilities
                        }));

                    return devices;
                } catch (error) {
                    this.logger.error('Device autocomplete error:', error);
                    return [];
                }
            });

            waitUntilCard.registerRunListener(async (args, state) => {
                try {
                    const waiterId = args.waiter_id || '';
                    const timeoutValue = Number(args.timeout_value) || 0;
                    const timeoutUnit = args.timeout_unit || 's';

                    // Extract device config
                    const device = args.device;
                    const capability = args.capability?.id || args.capability;
                    const targetValue = args.target_value;

                    // Validate capability exists on device
                    if (!device.capabilities || !device.capabilities.includes(capability)) {
                        const availableCaps = device.capabilities ? device.capabilities.join(', ') : 'none';
                        throw new Error(`Capability "${capability}" not found on device "${device.name}". Available capabilities: ${availableCaps}`);
                    }

                    this.logger.info(`🔷 Waiter condition triggered: ${waiterId || '(auto-generate)'}`);
                    this.logger.info(`📡 Listening for: ${device.name}.${capability} = ${targetValue}`);

                    // Create a promise that will be resolved when the waiter is triggered
                    return new Promise(async (resolve, reject) => {
                        try {
                            // Create waiter with flow context
                            const flowContext = {
                                flowId: state?.flowId || 'unknown',
                                flowToken: state?.flowToken || null
                            };

                            const config = {
                                timeoutValue,
                                timeoutUnit
                            };

                            // NEW: Device config for capability listening
                            const deviceConfig = {
                                deviceId: device.id,
                                capability,
                                targetValue
                            };

                            const actualWaiterId = await this.waiterManager.createWaiter(
                                waiterId,
                                config,
                                flowContext,
                                deviceConfig  // NEW parameter
                            );

                            // Store resolver in waiter data so it can be called later
                            const waiterData = this.waiterManager.waiters.get(actualWaiterId);
                            if (waiterData) {
                                waiterData.resolver = resolve;
                            }

                            // NEW: Register capability listener
                            await this.waiterManager.registerCapabilityListener(
                                actualWaiterId,
                                this.homey
                            );

                            // Return false immediately to let other flow branches continue
                            // The flow will be continued later when the waiter is triggered
                            this.logger.info(`⏸️  Waiter ${actualWaiterId} waiting for capability change...`);

                        } catch (error) {
                            this.logger.error(`❌ Failed to create waiter:`, error);
                            reject(error);
                        }
                    });
                } catch (error) {
                    this.logger.error(`❌ Waiter condition error:`, error);
                    throw error;
                }
            });
            this.logger.debug(` -> OK: CONDITION registered: 'wait_until_becomes_true'`);
        } catch (e) {
            this.logger.error(` -> FAILED: Registering CONDITION 'wait_until_becomes_true'`, e);
        }

        // Action: Control waiter
        try {
            const controlWaiterCard = this.homey.flow.getActionCard("control_waiter");
            controlWaiterCard.registerRunListener(async (args, state) => {
                try {
                    const waiterId = args.waiter_id;
                    const action = args.action;

                    if (!waiterId) {
                        throw new Error('Waiter ID is required');
                    }

                    this.logger.info(`🎛️  Control waiter: ${waiterId} -> ${action}`);

                    switch (action) {
                        case 'enable':
                            const enabled = this.waiterManager.enableWaiter(waiterId, true);
                            this.logger.info(`✅ Enabled ${enabled} waiter(s)`);
                            return true;

                        case 'disable':
                            const disabled = this.waiterManager.enableWaiter(waiterId, false);
                            this.logger.info(`⏸️  Disabled ${disabled} waiter(s)`);
                            return true;

                        case 'stop':  // NEW ACTION
                            const stopped = this.waiterManager.stopWaiter(waiterId);
                            this.logger.info(`🛑 Stopped ${stopped} waiter(s)`);
                            return true;

                        default:
                            throw new Error(`Unknown action: ${action}`);
                    }
                } catch (error) {
                    this.logger.error(`❌ Control waiter error:`, error);
                    throw error;
                }
            });

            // Register autocomplete for waiter_id argument
            controlWaiterCard.registerArgumentAutocompleteListener('waiter_id', async (query, args) => {
                try {
                    const results = [];
                    const seenIds = new Set();

                    // Get all defined waiter IDs from flows
                    const definedIds = await this.getAllDefinedWaiterIds();

                    // Get active waiters from WaiterManager
                    const activeWaiters = this.waiterManager.getWaitersForAutocomplete(query);

                    // Add active waiters first (with status info)
                    for (const waiter of activeWaiters) {
                        if (!query || waiter.id.toLowerCase().includes(query.toLowerCase())) {
                            results.push(waiter);
                            seenIds.add(waiter.id);
                        }
                    }

                    // Add defined waiters that aren't currently active
                    for (const id of definedIds) {
                        if (!seenIds.has(id)) {
                            if (!query || id.toLowerCase().includes(query.toLowerCase())) {
                                results.push({
                                    name: id,
                                    description: '📋 Defined in flow (not active)',
                                    id: id
                                });
                                seenIds.add(id);
                            }
                        }
                    }

                    return results;
                } catch (error) {
                    this.logger.error(`❌ Waiter autocomplete error:`, error);
                    return [];
                }
            });

            this.logger.debug(` -> OK: ACTION registered: 'control_waiter'`);
        } catch (e) {
            this.logger.error(` -> FAILED: Registering ACTION 'control_waiter'`, e);
        }

        this.logger.info("app.flow_cards_registered", {});
    }

    /**
     * Get all waiter IDs defined in flows (from wait_until_becomes_true cards)
     * @returns {Promise<Array>} Array of waiter IDs found in flows
     */
    async getAllDefinedWaiterIds() {
        try {
            if (!this.api) {
                const athomApi = require("athom-api");
                const { HomeyAPI } = athomApi;
                this.api = await HomeyAPI.forCurrentHomey(this.homey);
            }

            const waiterIds = new Set();

            // Get all flows
            const flows = await this.api.flow.getFlows();

            // Search through all flows for wait_until_becomes_true cards
            for (const flowId in flows) {
                const flow = flows[flowId];

                // Check if flow has cards
                if (!flow.cards) continue;

                // Search through all cards
                for (const card of flow.cards) {
                    // Find wait_until_becomes_true condition cards
                    if (card.type === 'condition' && card.id === 'wait_until_becomes_true') {
                        // Extract waiter_id from card args
                        const waiterId = card.args?.waiter_id;
                        if (waiterId && typeof waiterId === 'string' && waiterId.trim() !== '') {
                            waiterIds.add(waiterId.trim());
                        }
                    }
                }
            }

            return Array.from(waiterIds).sort();
        } catch (error) {
            this.logger.error('Failed to get defined waiter IDs from flows:', error);
            return [];
        }
    }

    /**
     * Get all devices with configuration errors
     * @param {string} driverFilter - 'any', 'logic-unit', or 'logic-device'
     * @returns {Array} Array of devices with errors
     */
    async getDevicesWithConfigErrors(driverFilter = 'any') {
        const devicesWithErrors = [];

        try {
            const drivers = this.homey.drivers.getDrivers();

            for (const driver of Object.values(drivers)) {
                const driverId = driver.id;

                // Apply filter
                let shouldInclude = false;
                if (driverFilter === 'any') {
                    shouldInclude = driverId.startsWith('logic-unit') || driverId === 'logic-device';
                } else if (driverFilter === 'logic-unit') {
                    shouldInclude = driverId.startsWith('logic-unit');
                } else if (driverFilter === 'logic-device') {
                    shouldInclude = driverId === 'logic-device';
                }

                if (!shouldInclude) continue;

                const devices = driver.getDevices();
                for (const device of devices) {
                    if (device.hasCapability && device.hasCapability('alarm_config')) {
                        const alarmConfig = device.getCapabilityValue('alarm_config');
                        if (alarmConfig === true) {
                            devicesWithErrors.push({
                                id: device.getData().id,
                                name: device.getName(),
                                driverId: driverId,
                            });
                        }
                    }
                }
            }
        } catch (e) {
            this.logger.error('Failed to get devices with config errors', e);
        }

        return devicesWithErrors;
    }
};