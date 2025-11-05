"use strict";

const Homey = require("homey");
const Logger = require("./lib/Logger");

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

        // Register ALL Flow Cards here using generic methods
        await this.registerAllFlowCards();

        this.logger.info("App initialization complete.", {});
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

        this.logger.info("app.flow_cards_registered", {});
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