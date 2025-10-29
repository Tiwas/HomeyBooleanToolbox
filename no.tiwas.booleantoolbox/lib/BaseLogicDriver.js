"use strict";
const Homey = require("homey");
const Logger = require("./Logger");

async function formulaAutocompleteHelper(query, args) {
    const device = args.device;
    if (!device || typeof device.getFormulas !== "function") {
        console.warn(
            `formulaAutocompleteHelper: Invalid device or missing getFormulas in args for autocomplete.`,
        );
        return [];
    }
    try {
        const formulas = device.getFormulas();
        if (!Array.isArray(formulas)) {
            console.warn(
                `getFormulas didn't return array for ${device.getName()}.`,
            );
            return [];
        }
        const lowerQuery = query ? query.toLowerCase() : "";
        return formulas.filter(
            (f) =>
                f &&
                f.name &&
                (!query || f.name.toLowerCase().includes(lowerQuery)),
        );
    } catch (e) {
        console.error(
            `Error in formulaAutocompleteHelper for ${device.getName()}`,
            e,
        );
        return [];
    }
}

async function inputAutocompleteHelper(query, args) {
    const device = args.device;
    if (!device || typeof device.getInputOptions !== "function") {
        console.warn(
            `inputAutocompleteHelper: Invalid device or missing getInputOptions in args for autocomplete.`,
        );
        return [];
    }
    try {
        const inputs = device.getInputOptions(args);
        if (!Array.isArray(inputs)) {
            console.warn(
                `getInputOptions didn't return array for ${device.getName()}.`,
            );
            return [];
        }
        const lowerQuery = query ? query.toLowerCase() : "";
        return inputs.filter(
            (i) =>
                i &&
                i.name &&
                (!query || i.name.toLowerCase().includes(lowerQuery)),
        );
    } catch (e) {
        console.error(
            `Error in inputAutocompleteHelper for ${device.getName()}`,
            e,
        );
        return [];
    }
}
// --- End Autocomplete Helper Functions ---

class BaseLogicDriver extends Homey.Driver {
    static logicUnitCardsRegistered = false;

    async onInit() {
        const driverName = `Driver: ${this.id}`;
        this.logger = new Logger(this, driverName);

        // Set numInputs based on driver ID
        const driverId = this.id;
        let numInputsParsed = 2;
        try {
            const parts = driverId.split("-");
            const numStr = parts[parts.length - 1];
            const num = parseInt(numStr);
            if (!isNaN(num) && num > 0) {
                numInputsParsed = num;
            } else if (driverId !== "logic-device") {
                this.logger.warn(
                    `Could not parse number of inputs from driver ID '${driverId}'. Using default: ${numInputsParsed}.`,
                    {},
                );
            }
        } catch (e) {
            this.logger.error(
                `Error parsing numInputs from driver ID '${driverId}'. Using default: ${numInputsParsed}.`,
                e,
            );
        }
        this.numInputs = numInputsParsed;

        this.logger.info("driver.ready", {
            driverId: this.id,
            numInputs: this.numInputs,
        });

        if (!BaseLogicDriver.logicUnitCardsRegistered) {
            this.logger.info(
                "First Logic Unit driver initializing. Registering shared flow cards...",
            );
            await this.registerFlowCards();
            BaseLogicDriver.logicUnitCardsRegistered = true;
        } else {
            this.logger.debug(
                "Shared flow cards already registered by another Logic Unit driver.",
            );
        }
    }

    async registerFlowCards() {
        this.logger.debug("driver.registering_flow_cards");

        // --- Triggers ---
        const triggerCards = [
            {
                id: "formula_changed_to_false_lu",
            },
            {
                id: "formula_changed_to_true_lu",
            },
            {
                id: "formula_timeout_lu",
            },
        ];
        triggerCards.forEach((cardInfo) => {
            try {
                const card = this.homey.flow.getTriggerCard(cardInfo.id);
                card.registerRunListener(async (args, state) => {
                    return (
                        args &&
                        args.device &&
                        args.device.driver &&
                        args.device.driver.id &&
                        args.device.driver.id.startsWith("logic-unit-")
                    );
                });
                this.registerAutocomplete(
                    card,
                    "formula",
                    formulaAutocompleteHelper,
                );
                this.logger.debug(
                    ` -> OK: TRIGGER card registered: '${cardInfo.id}'`,
                );
            } catch (e) {
                this.logger.error(
                    ` -> FAILED: Registering TRIGGER card '${cardInfo.id}'`,
                    e,
                );
            }
        });

        // --- Actions ---
        const actionCards = [
            {
                id: "set_input_value_lu",
                handler: "onFlowActionSetInput",
            },
            {
                id: "evaluate_formula_lu",
                handler: "onFlowActionEvaluateFormula",
            },
            {
                id: "evaluate_all_formulas_lu",
                handler: "onFlowActionReEvaluateAll",
            },
            {
                id: "clear_error_state_lu",
                handler: "onFlowActionClearError",
            },
            {
                id: "set_all_inputs_lu",
                handler: "setAllInputsFromFlow",
            },
            {
                id: "set_input_lu",
                handler: "setInputForAllFormulasFromFlow",
            },
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
                id: "formula_has_timed_out_lu",
                checkType: "timeout",
            },
            {
                id: "formula_result_is_lu",
                checkTypeFromArg: "what_is",
            },
            {
                id: "has_any_error_lu",
                checkType: "has_error",
            },
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

                    if (argName === "formula" || argName === "input") {
                        if (!device) {
                            this.logger.warn(
                                `Autocomplete for device arg '${argName}' on card '${card.id}' called without device context.`,
                            );
                            return [];
                        }

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

                    try {
                        return await helperFn(query, args);
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

    async ensureUniqueDeviceName(name) {
        try {
            if (
                !this.homey.app ||
                !this.homey.app.api ||
                !this.homey.app.api.devices ||
                typeof this.homey.app.api.devices.getDevices !== "function"
            ) {
                this.logger.warn(
                    "ensureUniqueDeviceName: Homey API not ready, returning original name.",
                    {},
                );
                return String(name || "");
            }
            const all = await this.homey.app.api.devices.getDevices();
            if (!all || typeof all !== "object") {
                this.logger.error(
                    "ensureUniqueDeviceName: Unexpected response from getDevices:",
                    all,
                );
                return String(name || "");
            }
            const existing = new Set(
                Object.values(all)
                    .map((d) =>
                        d && typeof d === "object"
                            ? String(d.name || "").trim()
                            : "",
                    )
                    .filter(Boolean),
            );
            const nameStr = String(name || "");
            if (!existing.has(nameStr)) return nameStr;
            const base = nameStr.replace(/\s+\d+$/, "").trim();
            const m = nameStr.match(/\s+(\d+)$/);
            let n = m ? parseInt(m[1], 10) + 1 : 2;
            if (isNaN(n)) n = 2;
            let candidate = `${base} ${n}`;
            let safetyCounter = 0;
            while (existing.has(candidate) && safetyCounter < 100) {
                n++;
                candidate = `${base} ${n}`;
                safetyCounter++;
            }
            if (safetyCounter >= 100) {
                this.logger.error(
                    "ensureUniqueDeviceName: Could not find unique name after 100 attempts, returning original + timestamp.",
                    {},
                );
                return `${nameStr}-${Date.now()}`;
            }
            return candidate;
        } catch (e) {
            this.logger.error("driver.ensure_unique_failed", e);
            return String(name || "");
        }
    }

async onPair(session) {
        this.logger.info("pair.session_started", {});
        session.setHandler("list_devices", async () => {
            try {
                this.logger.debug("Pair handler: list_devices called", {});
                let localeString;
                try {
                    localeString = this.homey.__("device.logic_unit_name");
                } catch (e) {
                    this.logger.error(
                        "Error getting localization for 'device.logic_unit_name'",
                        e,
                    );
                    localeString = this.homey.__(
                        "device.logic_unit_name_fallback",
                    );
                }
                const baseName = String(localeString || "").replace(
                    "{count}",
                    this.numInputs,
                );
                const name = await this.ensureUniqueDeviceName(baseName);
                const defaultFormulaName = this.homey.__(
                    "pair.default_formula_name",
                );
                const deviceData = {
                    name: name,
                    data: {
                        id: `${this.id}-${Math.random().toString(16).slice(2)}`,
                        numInputs: this.numInputs,
                    },
                    settings: {
                        formulas: `[{"id":"f1","name":"${defaultFormulaName}","expression":"${this.getDefaultExpression()}","enabled":true,"timeout":0,"firstImpression":false}]`,
                    },
                    capabilityValues: {  // ✅ NY: Initial values for nye devices
                        onoff: true,     // Starter som ON
                        alarm_generic: false
                    }
                };
                this.logger.debug(
                    "Pair handler: list_devices returning:",
                    deviceData,
                );
                return [deviceData];
            } catch (e) {
                this.logger.error("Error in list_devices pair handler", e);
                throw e;
            }
        });
        this.logger.debug("Pair handler: list_devices registered", {});
    }

    getDefaultExpression() {
        const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
        const inputsToUse = Math.min(this.numInputs, letters.length);
        if (inputsToUse <= 0) return "true";
        return letters.slice(0, inputsToUse).join(" AND ");
    }
}

module.exports = BaseLogicDriver;
module.exports.formulaAutocompleteHelper = formulaAutocompleteHelper;
module.exports.inputAutocompleteHelper = inputAutocompleteHelper;