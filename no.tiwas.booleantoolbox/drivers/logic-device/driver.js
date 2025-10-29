"use strict";

const Homey = require("homey");
const Logger = require("../../lib/Logger");

module.exports = class LogicDeviceDriver extends Homey.Driver {
  async onInit() {
    const driverName = `Driver: ${this.id}`;
    this.logger = new Logger(this, driverName);

    this.logger.info("driver.ready");

    await this.registerFlowCards();
  }

  // --- Helper for Autocomplete Registration ---
  registerAutocomplete(card, argName, helperFn) {
    try {
      if (typeof helperFn !== "function") {
        throw new Error(`Helper function for '${argName}' is not a function.`);
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
            if (argName === "formula") requiredMethod = "getFormulas";
            if (argName === "input") requiredMethod = "getInputOptions";

            if (typeof device[requiredMethod] !== "function") {
              this.logger.warn(
                `Autocomplete for device arg '${argName}' on card '${card.id}': Device ${device.getName()} missing method ${requiredMethod}.`,
              );
              return [];
            }
          }

          try {
            return await helperFn(query, args); // Send hele args videre, hjelperen må hente ut device
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

  async registerFlowCards() {
    this.logger.debug("driver.registering_flow_cards");

    // --- Trigger 1 ---
    const stateChangedCard = this.homey.flow.getTriggerCard("state_changed_ld");
    stateChangedCard.registerRunListener(async (args, state) => {
      return args?.device?.driver?.id === "logic-device";
    });
    this.logger.debug(` -> OK: TRIGGER card registered: 'state_changed_ld'`);

    // Trigger 2: State changed to specific value (true/false)
    const stateChangedToCard = this.homey.flow.getTriggerCard(
      "device_state_changed_ld",
    );
    stateChangedToCard.registerRunListener(async (args, state) => {
      // args.state = "true" or "false" (string from dropdown)
      // state.state = boolean value from device trigger
      const expectedState = args.state === "true";
      return (
        args?.device?.driver?.id === "logic-device" &&
        state?.state === expectedState
      );
    });
    this.logger.debug(
      ` -> OK: TRIGGER card registered: 'device_state_changed_ld'`,
    );

    // --- Actions ---
    const actionCards = [
      {
        id: "evaluate_formula_ld",
        handler: "onFlowActionEvaluateFormula",
      },
      {
        id: "clear_error_ld",
        handler: "onFlowActionClearError",
      },
    ];
    actionCards.forEach((cardInfo) => {
      try {
        const card = this.homey.flow.getActionCard(cardInfo.id);
        card.registerRunListener(async (args, state) => {
          const device = args.device;
          if (!device)
            throw new Error(this.homey.__("errors.invalid_device_instance"));
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
        this.logger.debug(` -> OK: ACTION card registered: '${cardInfo.id}'`);
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
        id: "formula_has_timed_out_ld",
        checkType: "timeout",
      },
      {
        id: "formula_result_is_ld",
        checkTypeFromArg: "result",
      },
      {
        id: "has_any_error_ld",
        checkType: "has_error",
      },
    ];
    conditionCards.forEach((cardInfo) => {
      try {
        const card = this.homey.flow.getConditionCard(cardInfo.id);
        card.registerRunListener(async (args, state) => {
          const device = args.device;
          if (!device) return false;
          if (typeof device.onFlowCondition !== "function") return false;

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

  async ensureUniqueDeviceName(name) {
    try {
      if (
        !this.homey.app ||
        !this.homey.app.api ||
        typeof this.homey.app.api.devices?.getDevices !== "function"
      ) {
        this.logger.warn(
          "ensureUniqueDeviceName: Homey API (via app) not ready, returning original name.",
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
      const existingNames = new Set(
        Object.values(all)
          .map((d) => (d?.name || "").trim())
          .filter(Boolean),
      );

      const nameStr = String(name || "");
      if (!existingNames.has(nameStr)) return nameStr;

      const base = nameStr.replace(/\s+\d+$/, "").trim();
      const m = nameStr.match(/\s+(\d+)$/);
      let n = m ? parseInt(m[1], 10) + 1 : 2;
      if (isNaN(n)) n = 2; // Fallback

      let candidate = `${base} ${n}`;
      let safetyCounter = 0;
      while (existingNames.has(candidate) && safetyCounter < 100) {
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
    this.logger.info("pair.session_started");

    let numInputs = 2;
    let inputLinks = [];
    let deviceName = this.homey.__("pair.name_placeholder");
    let deviceFormula = "";

    session.setHandler("get_num_inputs", async () => {
      this.logger.debug("pair.get_num_inputs");
      return {
        numInputs,
      };
    });

    session.setHandler("set_num_inputs", async (data) => {
      this.logger.debug("pair.set_num_inputs", data);
      numInputs = parseInt(data.numInputs);
      if (isNaN(numInputs) || numInputs < 2 || numInputs > 10) numInputs = 2;
      return {
        success: true,
      };
    });

    session.setHandler("get_zones", async () => {
      this.logger.debug("pair.get_zones");
      try {
        return await this.homey.app.getAvailableZones();
      } catch (e) {
        this.logger.error("pair.get_zones_error", e);
        throw new Error(this.homey.__("errors.connection_failed"));
      }
    });

    session.setHandler("get_devices_in_zone", async (data) => {
      this.logger.debug("pair.get_devices_in_zone", {
        zone: data.zoneId,
      });
      if (!data.zoneId) return [];
      try {
        return await this.homey.app.getDevicesInZone(data.zoneId);
      } catch (e) {
        this.logger.error("pair.get_devices_error", e);
        throw new Error(this.homey.__("errors.connection_failed"));
      }
    });

    session.setHandler("set_input_links", async (data) => {
      this.logger.debug("pair.set_input_links");
      inputLinks = Array.isArray(data.inputLinks) ? data.inputLinks : [];
      return {
        success: true,
      };
    });

    session.setHandler("set_device_name", async (data) => {
      this.logger.debug("pair.set_device_name", {
        name: data.name,
      });
      deviceName = String(data.name || this.homey.__("pair.name_placeholder"));
      return {
        success: true,
      };
    });

    session.setHandler("set_device_formula", async (data) => {
      this.logger.debug("pair.set_device_formula", {
        formula: data.formula || "N/A",
      });
      deviceFormula = String(data.formula || "");
      return {
        success: true,
      };
    });

    session.setHandler("create_device", async () => {
      this.logger.info("pair.create_device");

      if (!inputLinks || inputLinks.length === 0) {
        throw new Error(this.homey.__("errors.invalid_input"));
      }

      const uniqueName = await this.ensureUniqueDeviceName(deviceName);

      const device = {
        name: uniqueName,
        data: {
          id: `logic-device-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          numInputs,
        },
        settings: {
          input_links: JSON.stringify(inputLinks, null, 2),
          formulas: JSON.stringify(
            [
              {
                id: "formula_1",
                name:
                  this.homey.__("formula.default_name_ld") || "Main Formula",
                expression:
                  deviceFormula || this.getDefaultExpression(numInputs),
                enabled: true,
                timeout: 0,
                firstImpression: false,
              },
            ],
            null,
            2,
          ),
        },
        capabilities: ["onoff", "alarm_generic"],
        capabilitiesOptions: {
          onoff: {
            setable: true,
          },
          alarm_generic: {
            setable: false,
          },
        },
        capabilityValues: {
          onoff: true,
          alarm_generic: false
        }
      };

      this.logger.info("pair.creating_device", {
        name: uniqueName,
      });
      this.logger.dump("Device data to be created", device);
      return device;
    });

    this.logger.debug("pair.handlers_registered");
  }

  getDefaultExpression(numInputs) {
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const inputsToUse = Math.min(numInputs, letters.length);
    if (inputsToUse <= 0) return "true";
    return letters.slice(0, inputsToUse).join(" AND ");
  }
};