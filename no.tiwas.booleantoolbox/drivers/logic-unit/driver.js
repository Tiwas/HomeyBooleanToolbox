"use strict";

const BaseLogicDriver = require("../../lib/BaseLogicDriver");
const Logger = require("../../lib/Logger");

module.exports = class LogicUnitDriver extends BaseLogicDriver {
  async onInit() {
    const driverName = `Driver: ${this.id}`;
    this.logger = new Logger(this, driverName);

    this.numInputs = 2;

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

async onPair(session) {
    this.logger.info("pair.session_started", {});

    session.setHandler("list_devices", async () => {
      try {
        this.logger.debug("Pair handler: list_devices called", {});

        let localeString;
        try {
          localeString = this.homey.__("device.logic_unit_dynamic_name");
        } catch (e) {
          this.logger.error(
            "Error getting localization for 'device.logic_unit_dynamic_name'",
            e,
          );
          localeString = this.homey.__(
            "device.logic_unit_dynamic_name_fallback",
          );
        }

        const baseName = String(localeString || "Logic Unit");
        const name = await this.ensureUniqueDeviceName(baseName);

        const defaultFormulaName = this.homey.__("pair.default_formula_name");
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

        this.logger.debug("Pair handler: list_devices returning:", deviceData);
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
};