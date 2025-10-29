"use strict";

const FormulaEvaluator = require("../../lib/FormulaEvaluator");
const Homey = require("homey");
const Logger = require("../../lib/Logger");

module.exports = class LogicDeviceDevice extends Homey.Device {
  async onInit() {
    const driverName = `Device: ${this.driver.id}`;
    this.logger = new Logger(this, driverName);

    // Initialize AST-based formula evaluator for secure evaluation
    this.formulaEvaluator = new FormulaEvaluator();
    this.logger.info("🔐 AST-based secure formula evaluation enabled");

    this.logger.device("device.initializing", {
      name: this.getName(),
    });

    // ✅ STEP 1: Add capabilities FIRST, before anything else
    if (!this.hasCapability("onoff")) {
      await this.addCapability("onoff");
    }

    if (!this.hasCapability("alarm_generic")) {
      await this.addCapability("alarm_generic");
    }

    // ✅ STEP 2: Initialize device enabled state from onoff capability
    // onoff = user control (ON/OFF), NOT formula output
    // alarm_generic = formula output (TRUE/FALSE)
    let onoffValue = this.getCapabilityValue("onoff");
    
    // Only handle null/undefined (safety check)
    if (onoffValue === null || onoffValue === undefined) {
      // Default to enabled for new devices (also set via capabilityValues in driver.js)
      this.logger.info("⚠️  onoff value is null/undefined, defaulting to enabled (true)");
      await this.setCapabilityValue("onoff", true);
      onoffValue = true;
    }
    
    this.deviceEnabled = onoffValue === true;
    this.logger.info(`📊 Logic Device state: ${this.deviceEnabled ? 'ENABLED' : 'DISABLED'} (user can toggle, state is remembered)`);

    // ✅ STEP 3: Set capability options
    try {
      await this.setCapabilityOptions("onoff", {
        setable: true, // ENDRET: Bruker kan nå slå device av/på
        getable: true,
      });

      this.logger.debug("device.capability_readonly");
    } catch (e) {
      this.logger.warn("device.capability_options_failed", {
        message: e.message,
      });
    }

    // ✅ STEP 4: NOW we can safely run the rest of initialization
    const settings = this.getSettings();
    const detectedInputs = this.detectRequiredInputs(settings);

    const originalNumInputs = this.getData().numInputs || 2;
    this.numInputs = Math.max(detectedInputs, originalNumInputs);

    if (detectedInputs > originalNumInputs) {
      this.logger.info("device.capacity_expanded", {
        detected: detectedInputs,
        original: originalNumInputs,
      });
    }

    this.availableInputs = this.getAvailableInputIds();
    this.deviceListeners = new Map();
    this.pollingIntervals = new Map();

    // Register on/off capability listener to enable/disable device
    this.registerCapabilityListener("onoff", async (value) => {
      this.deviceEnabled = value;
      this.logger.info(`🔌 Device ${value ? "enabled" : "disabled"}`, {});

      if (value) {
        // Device enabled - re-evaluate formula
        await this.evaluateAllFormulasInitial();
        this.startTimeoutChecks();
        this.logger.info("✅ Device enabled - evaluations resumed");
      } else {
        // Device disabled - stop timeout checks and clear alarm
        if (this.timeoutInterval) {
          clearInterval(this.timeoutInterval);
          this.timeoutInterval = null;
        }
        await this.setCapabilityValue("alarm_generic", false).catch(() => {});
        this.logger.info("⏸️  Device disabled - evaluations stopped");
      }

      return true;
    });

    await this.initializeFormulas();
    await this.setupDeviceLinks();

    this.logger.info("evaluation.running_initial");
    await this.evaluateAllFormulasInitial();

    this.startTimeoutChecks();

    this.logger.info("device.initialized", {
      name: this.getName(),
      count: this.numInputs,
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    try {
      // Valider formler
      if (changedKeys.includes("formulas")) {
        let formulas;
        try {
          formulas = JSON.parse(newSettings.formulas);
        } catch (e) {
          throw new Error(
            this.homey.__("settings.invalid_json", {
              field: "formulas",
              error: e.message,
            }),
          );
        }

        // VIKTIG: Begrens til én formel for Logic Device
        if (formulas.length > 1) {
          throw new Error(
            "Logic Device kan kun ha én formel. " +
              "For flere formler, bruk Logic Unit (Dynamic) i stedet.",
          );
        }

        // Valider hver formel
        for (const formula of formulas) {
          // Sjekk at ID er gyldig
          if (!formula.id || !/^[a-zA-Z0-9_-]+$/.test(formula.id)) {
            throw new Error(
              `Ugyldig formel-ID: "${formula.id}". ` +
                "ID må bare inneholde bokstaver, tall, bindestrek og understrek.",
            );
          }

          // Valider expression
          if (formula.expression) {
            const validation = this.validateExpression(formula.expression);
            if (!validation.valid) {
              throw new Error(
                `Ugyldig formel "${formula.name}": ${validation.error}`,
              );
            }
          }
        }

        // Sjekk for duplikate ID-er
        const ids = formulas.map((f) => f.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          throw new Error(
            "Duplikate formel-ID-er funnet. Hver formel må ha unik ID.",
          );
        }
      }

      // Valider input_links
      if (changedKeys.includes("input_links")) {
        let inputLinks;
        try {
          inputLinks = JSON.parse(newSettings.input_links);
        } catch (e) {
          throw new Error(
            this.homey.__("settings.invalid_json", {
              field: "input_links",
              error: e.message,
            }),
          );
        }

        // Valider at hver input bare er linket én gang
        const inputCounts = {};
        for (const link of inputLinks) {
          const input = link.input?.toLowerCase();
          if (input) {
            inputCounts[input] = (inputCounts[input] || 0) + 1;
            if (inputCounts[input] > 1) {
              throw new Error(
                `Input "${input.toUpperCase()}" er linket flere ganger. ` +
                  "Hver input kan bare linkes til én enhet/capability.",
              );
            }
          }
        }
      }

      // Hvis alt er OK, fortsett med å oppdatere innstillinger
      this.logger.info("settings.validated_successfully");

      // Re-initialiser enheten med nye innstillinger
      await this.initializeFormulas();
      await this.setupDeviceLinks();
      await this.refetchAndEvaluate("settings_changed");

      return true;
    } catch (error) {
      this.logger.error("settings.validation_failed", {
        message: error.message,
      });
      throw error;
    }
  }

  getAvailableInputIds() {
    const allInputs = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    return allInputs.slice(0, this.numInputs);
  }

  getAvailableInputsUppercase() {
    return this.availableInputs.map((i) => i.toUpperCase());
  }

  detectRequiredInputs(settings) {
    let maxInput = 2; // Default minimum

    try {
      const formulasData = settings.formulas
        ? JSON.parse(settings.formulas)
        : [];

      formulasData.forEach((formula) => {
        if (!formula.expression) return;

        const pattern = /\b([A-J])\b/gi;
        const matches = formula.expression.match(pattern);

        if (matches) {
          matches.forEach((letter) => {
            const inputNumber = letter.toUpperCase().charCodeAt(0) - 64; // A=1, B=2
            maxInput = Math.max(maxInput, inputNumber);
          });
        }
      });

      const inputLinks = settings.input_links
        ? JSON.parse(settings.input_links)
        : [];

      inputLinks.forEach((link) => {
        if (link.input) {
          const inputNumber = link.input.toLowerCase().charCodeAt(0) - 96; // a=1, b=2
          maxInput = Math.max(maxInput, inputNumber);
        }
      });

      this.logger.debug("device.max_input_detected", {
        input: String.fromCharCode(64 + maxInput),
        count: maxInput,
      });
    } catch (e) {
      this.logger.error("parse.error_detecting_inputs", {
        message: e.message,
      });
    }

    return maxInput;
  }

  async initializeFormulas() {
    const settings = this.getSettings();
    try {
      const formulasData = settings.formulas
        ? JSON.parse(settings.formulas)
        : [];

      // VIKTIG: Logic Device kan KUN ha én formel
      if (formulasData.length > 1) {
        this.logger.warn(
          "⚠️  Logic Device can only have one formula. Using only the first one.",
          {
            found: formulasData.length,
          },
        );
        // Behold kun den første formelen
        formulasData.splice(1);
      }

      this.formulas = formulasData.map((f) => ({
        id: f.id,
        name: f.name,
        expression: f.expression,
        enabled: f.enabled !== false,
        timeout: f.timeout || 0,
        firstImpression: f.firstImpression === true,
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false,
      }));

      this.formulas.forEach((formula) => {
        // Fjern 'async'
        this.availableInputs.forEach((id) => {
          formula.inputStates[id] = "undefined";
          formula.lockedInputs[id] = false;
        });
      });
    } catch (e) {
      this.logger.error("parse.error_formulas", {
        message: e.message,
      });
      this.formulas = [];
    }

    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: "formula_1",
        name: this.homey.__("formula.default_name"),
        expression: this.getDefaultExpression(),
        enabled: true,
        timeout: 0,
        firstImpression: false,
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false,
      };

      this.availableInputs.forEach((id) => {
        defaultFormula.inputStates[id] = "undefined";
        defaultFormula.lockedInputs[id] = false;
      });

      this.formulas = [defaultFormula];
    }

    this.logger.info("formula.initialized", {
      count: this.formulas.length,
    });
    this.formulas.forEach((f) => {
      this.logger.debug("formula.details", {
        name: f.name,
        expression: f.expression,
        enabled: f.enabled,
      });
    });
  }

  getDefaultExpression() {
    const inputs = this.getAvailableInputsUppercase();
    return inputs.join(" AND ");
  }

  async setupDeviceLinks() {
    // Clean up old listeners first
    for (const [key, entry] of this.deviceListeners.entries()) {
      try {
        if (typeof entry?.unregister === "function") {
          await entry.unregister();
          this.logger.debug("devicelinks.unregistered", { key });
        }
      } catch (e) {
        this.logger.error("devicelinks.error_cleanup", { message: e.message });
      }
    }
    this.deviceListeners.clear();

    // Then setup new ones
    const settings = this.getSettings();
    let inputLinks = [];
    try {
      inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.logger.error("parse.error_input_links", {
        message: e.message,
      });
      return;
    }

    this.inputLinks = inputLinks;

    this.logger.debug("devicelinks.count", {
      count: inputLinks.length,
    });
    for (const link of inputLinks) {
      try {
        await this.setupDeviceListener(link);
      } catch (e) {
        this.logger.error("devicelinks.setup_failed", {
          input: link.input,
          message: e.message,
        });
      }
    }

    this.logger.debug("initial.fetching_all");
    await this.fetchInitialValues(inputLinks);

    this.logger.info("devicelinks.complete");
  }

  async fetchInitialValues(inputLinks) {
    if (!this.homey.app.api) {
      this.logger.error("initial.api_unavailable");
      return;
    }

    for (const link of inputLinks) {
      const { input, deviceId, capability } = link;
      if (!input || !deviceId || !capability) continue;

      try {
        this.logger.debug("initial.fetching_input", {
          input: input.toUpperCase(),
        });
        const device = await this.homey.app.api.devices.getDevice({
          id: deviceId,
        });
        if (!device) {
          this.logger.warn("initial.device_not_found", {
            input: input.toUpperCase(),
          });
          continue;
        }

        let initialValue = null;

        if (device.capabilitiesObj && device.capabilitiesObj[capability]) {
          initialValue = device.capabilitiesObj[capability].value;
        } else if (
          device.capabilityValues &&
          device.capabilityValues[capability] !== undefined
        ) {
          initialValue = device.capabilityValues[capability];
        } else if (device.state && device.state[capability] !== undefined) {
          initialValue = device.state[capability];
        }

        this.logger.input("initial.received_value", {
          input: input.toUpperCase(),
          value: initialValue,
        });

        if (initialValue !== null && initialValue !== undefined) {
          const boolValue = this.convertToBoolean(initialValue, capability);

          this.logger.debug("initial.value_received", {
            input: input.toUpperCase(),
            value: initialValue,
            boolean: boolValue,
          });

          for (const formula of this.formulas) {
            formula.inputStates[input] = boolValue;
          }
        } else {
          this.logger.warn("initial.no_value_waiting", {
            input: input.toUpperCase(),
          });
        }
      } catch (e) {
        this.logger.error("initial.error", {
          input: input.toUpperCase(),
          message: e.message,
        });
      }
    }
  }

  async refetchInputsAndEvaluate(source = "unknown") {
    this.logger.info("refetch.invoked", {
      source: source,
    });
    let links = [];
    try {
      const settings = this.getSettings();
      links = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.logger.error("refetch.parse_failed", {
        message: e.message,
      });
    }

    if (!Array.isArray(links) || links.length === 0) {
      this.logger.warn("refetch.no_links");
      await this.evaluateAllFormulasInitial();
      return;
    }

    this.inputLinks = links;

    this.logger.debug("refetch.fetching_values");
    await this.fetchInitialValues(links);
    await this.evaluateAllFormulasInitial();
  }

  async setupDeviceListener(link) {
    const { input, deviceId, capability, deviceName } = link;

    this.logger.debug("listener.setting_up", {
      input: input.toUpperCase(),
      deviceName,
      deviceId,
      capability,
    });

    if (!input || !deviceId || !capability) {
      this.logger.error("listener.invalid_config", {
        input: input?.toUpperCase(),
      });
      return;
    }

    try {
      if (!this.homey.app.api) {
        this.logger.error("listener.api_unavailable");
        return;
      }

      const targetDevice = await this.homey.app.api.devices.getDevice({
        id: deviceId,
      });

      if (!targetDevice) {
        this.logger.error("listener.device_not_found", {
          input: input.toUpperCase(),
          device: deviceId,
        });
        return;
      }
      this.logger.debug("listener.device_found", {
        device: targetDevice.name,
      });

      if (
        !targetDevice.capabilities ||
        !targetDevice.capabilities.includes(capability)
      ) {
        this.logger.error("listener.capability_not_exist", {
          input: input.toUpperCase(),
          capability,
          device: deviceId,
          available: targetDevice.capabilities,
        });
        return;
      }
      this.logger.debug("listener.capability_found", {
        capability: capability,
      });

      const listenerFn = async (value) => {
        if (this._isDeleting) return;

        this.logger.input("listener.event_received", {
          input: input.toUpperCase(),
          device: targetDevice.name,
          capability,
          value,
        });

        const boolValue = this.convertToBoolean(value, capability);

        this.logger.debug("listener.capability_changed", {
          input: input.toUpperCase(),
          capability,
          value,
          boolean: boolValue,
        });

        for (const formula of this.formulas) {
          try {
            await this.setInputForFormula(formula.id, input, boolValue);
          } catch (err) {
            if (!this._isDeleting)
              this.logger.error("formula.set_input_error", {
                message: err.message,
              });
          }
        }
      };

      this.logger.debug("listener.registering", {
        capability: capability,
      });
      const capabilityInstance = targetDevice.makeCapabilityInstance(
        capability,
        listenerFn,
      );

      const listenerKey = `${input}-${deviceId}-${capability}`;
      this.deviceListeners.set(listenerKey, {
        unregister: () => capabilityInstance.destroy(),
      });

      this.logger.debug("listener.registered", {
        input: input.toUpperCase(),
        device: targetDevice.name,
        capability,
      });
    } catch (e) {
      this.logger.error("listener.error_setup", {
        input: input.toUpperCase(),
        message: e.message,
      });
      this.logger.debug(e.stack);
    }
  }

  convertToBoolean(value, capability) {
    if (typeof value === "boolean") return value;
    if (capability.startsWith("alarm_")) return !!value;
    if (capability === "onoff") return !!value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
      const lowerValue = value.toLowerCase();
      return (
        lowerValue === "true" ||
        lowerValue === "1" ||
        lowerValue === "on" ||
        lowerValue === "yes"
      );
    }
    return !!value;
  }

  async safeSetCapabilityValue(cap, value) {
    if (this._isDeleting) return;
    try {
      if (!this.hasCapability(cap)) return;
      await this.setCapabilityValue(cap, value);
    } catch (e) {
      const msg = e?.message || "";
      if (e?.statusCode === 404 || /not\s*found/i.test(msg)) {
        this.logger.debug("device.capability_skip_deleted", {
          capability: cap,
        });
        return;
      }

      this.logger.error("device.capability_update_failed", {
        capability: cap,
        message: msg,
      });
    }
  }

  async setInputForFormula(formulaId, inputId, value) {
    if (this._isDeleting) return null;
    const formula = this.formulas.find((f) => f.id === formulaId);
    if (!formula) {
      return null;
    }

    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.logger.warn("inputs.locked_first_impression", {
        device: this.getName(), // <-- Legg til device navn
        deviceId: this.getData().id, // <-- Legg til device ID
        input: inputId.toUpperCase(),
        formula: formula.name,
      });
      return formula.result;
    }

    const oldValue = formula.inputStates[inputId];
    this.logger.debug("inputs.setting_value", {
      device: this.getName(), // <-- Legg til device navn
      deviceId: this.getData().id, // <-- Legg til device ID
      input: inputId.toUpperCase(),
      value,
      formula: formula.name,
      oldValue,
    });

    formula.inputStates[inputId] = value;
    formula.timedOut = false;

    if (
      formula.firstImpression &&
      value !== "undefined" &&
      !formula.lockedInputs[inputId]
    ) {
      formula.lockedInputs[inputId] = true;
      this.logger.debug("inputs.locked_at_value", {
        input: inputId.toUpperCase(),
        value,
      });
    }

    if (value !== "undefined") {
      formula.lastInputTime = Date.now();
    }

    return await this.evaluateFormula(formulaId);
  }

  async evaluateFormula(formulaId, resetLocks = false) {
    if (this._isDeleting) return null;

    // Check if device is enabled
    if (this.deviceEnabled === false) {
      this.logger.debug("⏸️  Device disabled - skipping evaluation", {
        formulaId,
      });
      return null;
    }

    const formula = this.formulas.find((f) => f.id === formulaId);
    if (!formula || !formula.enabled) {
      this.logger.debug("formula.not_found_or_disabled", {
        id: formulaId,
      });
      return null;
    }

    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach((id) => {
        formula.lockedInputs[id] = false;
      });
      this.logger.debug("formula.unlocked_inputs", {
        name: formula.name,
      });
    }

    const expression = formula.expression;
    if (!expression) {
      this.logger.debug("formula.no_expression");
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allInputsDefined = requiredInputs.every(
      (id) => formula.inputStates[id.toLowerCase()] !== "undefined",
    );

    if (!allInputsDefined) {
      this.logger.debug("formula.waiting_for_inputs", {
        name: formula.name,
        required: requiredInputs.join(", "),
      });
      return null;
    }

    try {
      // Normalize expression to standard keywords for AST evaluation
      const normalizedExpr = expression
        .toUpperCase()
        .replace(/&|\*/g, " AND ")
        .replace(/\||\+/g, " OR ")
        .replace(/\^|!=/g, " XOR ")
        .replace(/!/g, " NOT ")
        .replace(/\s+/g, " ")
        .trim();

      // Build variables object from formula inputs
      const variables = {};
      requiredInputs.forEach((inputKey) => {
        const inputId = inputKey.toLowerCase();
        const value = formula.inputStates[inputId];
        if (value !== "undefined") {
          variables[inputKey] = value === true;
        }
      });

      // Evaluate using AST (secure - no eval or new Function!)
      const result = this.formulaEvaluator.evaluate(normalizedExpr, variables);

      this.logger.debug("🔐 Formula evaluated (AST)", {
        name: formula.name,
        result,
      });

      const previousResult = formula.result;
      formula.result = result;
      formula.timedOut = false;

      // ✅ CRITICAL: Only set alarm_generic (formula output), NOT onoff!
      // onoff is user control (enable/disable), alarm_generic is formula result
      await this.safeSetCapabilityValue("alarm_generic", result);

      // Trigger flows hvis resultatet endret seg
      if (previousResult !== null && previousResult !== result) {
        // ... (samme trigger-kode som før)
      }

      return result;
    } catch (e) {
      this.logger.error("formula.evaluation_failed", {
        name: formula.name,
        message: e.message,
      });
      return null;
    }
  }

  evaluateBooleanExpression(expression, inputStates) {
    // Parse expression til AST (Abstract Syntax Tree)
    const tokens = this.tokenize(expression);
    const ast = this.parse(tokens);

    // Evaluer AST med input-verdier
    return this.evaluateAST(ast, inputStates);
  }

  tokenize(expression) {
    const tokens = [];
    let i = 0;
    const expr = expression.toUpperCase().trim();

    while (i < expr.length) {
      // Skip whitespace
      if (/\s/.test(expr[i])) {
        i++;
        continue;
      }

      // Operators
      if (expr[i] === "(") {
        tokens.push({ type: "LPAREN", value: "(" });
        i++;
      } else if (expr[i] === ")") {
        tokens.push({ type: "RPAREN", value: ")" });
        i++;
      } else if (expr[i] === "!") {
        if (expr[i + 1] === "=") {
          tokens.push({ type: "XOR", value: "!=" });
          i += 2;
        } else {
          tokens.push({ type: "NOT", value: "!" });
          i++;
        }
      } else if (expr[i] === "&") {
        if (expr[i + 1] === "&") {
          i += 2;
        } else {
          i++;
        }
        tokens.push({ type: "AND", value: "&&" });
      } else if (expr[i] === "|") {
        if (expr[i + 1] === "|") {
          i += 2;
        } else {
          i++;
        }
        tokens.push({ type: "OR", value: "||" });
      } else if (expr[i] === "*") {
        tokens.push({ type: "AND", value: "*" });
        i++;
      } else if (expr[i] === "+") {
        tokens.push({ type: "OR", value: "+" });
        i++;
      } else if (expr[i] === "^") {
        tokens.push({ type: "XOR", value: "^" });
        i++;
      }
      // Keywords
      else if (expr.substr(i, 3) === "AND") {
        tokens.push({ type: "AND", value: "AND" });
        i += 3;
      } else if (expr.substr(i, 2) === "OR") {
        tokens.push({ type: "OR", value: "OR" });
        i += 2;
      } else if (expr.substr(i, 3) === "XOR") {
        tokens.push({ type: "XOR", value: "XOR" });
        i += 3;
      } else if (expr.substr(i, 3) === "NOT") {
        tokens.push({ type: "NOT", value: "NOT" });
        i += 3;
      }
      // Variables (A-J)
      else if (/[A-J]/.test(expr[i])) {
        tokens.push({ type: "VAR", value: expr[i] });
        i++;
      } else {
        throw new Error(`Uventet tegn: "${expr[i]}" på posisjon ${i}`);
      }
    }

    return tokens;
  }

  // Parser (konverterer tokens til AST)
  parse(tokens) {
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    // OR har lavest presedens
    const parseOr = () => {
      let left = parseXor();

      while (peek() && peek().type === "OR") {
        consume();
        const right = parseXor();
        left = { type: "OR", left, right };
      }

      return left;
    };

    // XOR har medium presedens
    const parseXor = () => {
      let left = parseAnd();

      while (peek() && peek().type === "XOR") {
        consume();
        const right = parseAnd();
        left = { type: "XOR", left, right };
      }

      return left;
    };

    // AND har høy presedens
    const parseAnd = () => {
      let left = parseNot();

      while (peek() && peek().type === "AND") {
        consume();
        const right = parseNot();
        left = { type: "AND", left, right };
      }

      return left;
    };

    // NOT har høyest presedens (unær operator)
    const parseNot = () => {
      if (peek() && peek().type === "NOT") {
        consume();
        const operand = parseNot(); // Støtter multiple NOT
        return { type: "NOT", operand };
      }

      return parsePrimary();
    };

    // Primary: variabler eller parenteser
    const parsePrimary = () => {
      const token = peek();

      if (!token) {
        throw new Error("Uventet slutt på uttrykk");
      }

      if (token.type === "VAR") {
        consume();
        return { type: "VAR", value: token.value };
      }

      if (token.type === "LPAREN") {
        consume(); // (
        const expr = parseOr();

        if (!peek() || peek().type !== "RPAREN") {
          throw new Error("Manglende avsluttende parentes");
        }
        consume(); // )

        return expr;
      }

      throw new Error(`Uventet token: ${token.type}`);
    };

    const ast = parseOr();

    if (pos < tokens.length) {
      throw new Error(`Uventet token etter slutten: ${tokens[pos].type}`);
    }

    return ast;
  }

  // Evaluerer AST med gitte input-verdier
  evaluateAST(node, inputStates) {
    if (!node) {
      throw new Error("Tomt AST-node");
    }

    switch (node.type) {
      case "VAR": {
        const value = inputStates[node.value.toLowerCase()];
        if (value === "undefined") {
          throw new Error(`Variabel ${node.value} er ikke definert`);
        }
        return value === true || value === "true";
      }

      case "NOT": {
        return !this.evaluateAST(node.operand, inputStates);
      }

      case "AND": {
        const left = this.evaluateAST(node.left, inputStates);
        const right = this.evaluateAST(node.right, inputStates);
        return left && right;
      }

      case "OR": {
        const left = this.evaluateAST(node.left, inputStates);
        const right = this.evaluateAST(node.right, inputStates);
        return left || right;
      }

      case "XOR": {
        const left = this.evaluateAST(node.left, inputStates);
        const right = this.evaluateAST(node.right, inputStates);
        return left !== right;
      }

      default:
        throw new Error(`Ukjent node-type: ${node.type}`);
    }
  }

  async evaluateAllFormulasInitial() {
    this.logger.info("evaluation.initial_complete");

    let anyEvaluated = false;

    for (const formula of this.formulas) {
      if (!formula.enabled) continue;

      const expression = formula.expression;
      if (!expression) continue;

      const requiredInputs = this.parseExpression(expression);
      if (requiredInputs.length === 0) continue;

      const allInputsDefined = requiredInputs.every(
        (id) => formula.inputStates[id.toLowerCase()] !== "undefined",
      );

      if (allInputsDefined) {
        this.logger.debug("formula.all_inputs_defined", {
          name: formula.name,
        });
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        requiredInputs.forEach((id) => {
          states[id] = formula.inputStates[id.toLowerCase()];
        });
        this.logger.debug("formula.missing_inputs", {
          name: formula.name,
        });
      }
    }

    if (!anyEvaluated) {
      this.logger.warn("evaluation.no_formulas_ready");
      // ✅ CRITICAL: Only set alarm_generic, NOT onoff!
      // onoff is user control, alarm_generic is formula result
      await this.safeSetCapabilityValue("alarm_generic", false);
    }
  }

  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase();
    if (!inputs.length) return [];
    const varRe = new RegExp(`\\b(${inputs.join("|")})\\b`, "gi");
    const matches = expression.match(varRe);
    return matches ? [...new Set(matches.map((c) => c.toUpperCase()))] : [];
  }

  validateExpression(expression) {
    if (!expression || expression.trim() === "") {
      return {
        valid: false,
        error: this.homey.__("formula.expression_empty"),
      };
    }

    const upper = expression.toUpperCase();
    const inputs = this.getAvailableInputsUppercase();
    if (!inputs.length)
      return {
        valid: false,
        error: this.homey.__("formula.error_no_inputs"),
      };

    const tokenRe = new RegExp(
      `\\b(?:AND|OR|XOR|NOT)\\b|&&|\\|\\||&|\\||\\^|!=|\\*|\\+|!|\\(|\\)|\\b(?:${inputs.join("|")})\\b`,
      "gi",
    );

    const stripped = upper.replace(tokenRe, "").replace(/\s+/g, "");
    if (stripped.length > 0) {
      return {
        valid: false,
        error: this.homey.__("formula.invalid_tokens", {
          tokens: stripped,
        }),
      };
    }

    let depth = 0;
    for (const ch of upper) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth < 0)
        return {
          valid: false,
          error: this.homey.__("formula.error_unbalanced_parentheses"),
        };
    }
    if (depth !== 0)
      return {
        valid: false,
        error: this.homey.__("formula.error_unbalanced_parentheses"),
      };

    // Normalize alternative syntax to standard keywords for AST evaluation
    let normalizedExpr = upper
      .replace(/&|\*/g, " AND ")
      .replace(/\||\+/g, " OR ")
      .replace(/\^|!=/g, " XOR ")
      .replace(/!/g, " NOT ")
      .replace(/\s+/g, " ")
      .trim();

    try {
      // Create test variables (all set to true for validation)
      const testVars = {};
      inputs.forEach((input) => {
        testVars[input] = true;
      });

      // Try to evaluate with test values using AST (secure!)
      this.formulaEvaluator.evaluate(normalizedExpr, testVars);

      return {
        valid: true,
      };
    } catch (e) {
      return {
        valid: false,
        error: this.homey.__("formula.invalid_syntax", {
          message: e.message,
        }),
      };
    }
  }

  getFormulas() {
    return this.formulas
      .filter((f) => f.enabled)
      .map((f) => ({
        id: f.id,
        name: f.name,
        description: f.expression || this.homey.__("formula.no_expression"),
      }));
  }

  getInputOptions() {
    return this.getAvailableInputsUppercase().map((input) => ({
      id: input.toLowerCase(),
      name: input,
    }));
  }

  getFormulaResult(formulaId) {
    const formula = this.formulas.find((f) => f.id === formulaId);
    if (!formula) {
      this.logger.warn("formula.get_result_not_found", {
        id: formulaId,
      });
      return null;
    }
    return formula.result;
  }

  hasFormulaTimedOut(formulaId) {
    const formula = this.formulas.find((f) => f.id === formulaId);
    if (!formula) return false;
    return formula.timedOut;
  }

  async evaluateAllFormulas() {
    this.logger.info("evaluation.reevaluating_all");
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach((id) => {
          formula.lockedInputs[id] = false;
        });
        this.logger.debug("formula.unlocked_inputs", {
          name: formula.name,
        });
        const result = await this.evaluateFormula(formula.id);
        results.push({
          id: formula.id,
          name: formula.name,
          result,
        });
      }
    }

    this.logger.debug("formula.evaluated_count", {
      count: results.length,
    });
    return results;
  }

  startTimeoutChecks() {
    // Clear existing interval hvis det finnes
    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }

    // Start nytt interval
    this.timeoutInterval = setInterval(() => {
      // Sjekk at enheten ikke er i ferd med å bli slettet
      if (this._isDeleting) {
        clearInterval(this.timeoutInterval);
        this.timeoutInterval = null;
        return;
      }

      this.checkTimeouts();
    }, 1000);
  }

  checkTimeouts() {
    const now = Date.now();
    this.formulas.forEach((formula) => {
      if (!formula.timeout || formula.timeout <= 0) return;
      if (formula.timedOut || !formula.enabled) return;
      if (!formula.lastInputTime) return;

      const hasAnyInput = this.availableInputs.some(
        (id) => formula.inputStates[id] !== "undefined",
      );
      if (!hasAnyInput) return;

      const requiredInputs = this.parseExpression(formula.expression);
      const allInputsDefined = requiredInputs.every(
        (id) => formula.inputStates[id.toLowerCase()] !== "undefined",
      );
      if (allInputsDefined) return;

      const timeoutMs = formula.timeout * 1000;
      const elapsed = now - formula.lastInputTime;

      if (elapsed >= timeoutMs) {
        this.logger.info("formula.timed_out", {
          name: formula.name,
          timeout: formula.timeout,
        });
        formula.timedOut = true;

        const triggerData = {
          formula: {
            id: formula.id,
            name: formula.name,
          },
        };
        const state = {
          formulaId: formula.id,
        };
        this.homey.flow
          .getDeviceTriggerCard("formula_timeout")
          .trigger(this, triggerData, state)

          .catch((err) =>
            this.logger.error("timeout.error", {
              message: err.message,
            }),
          );
      }
    });
  }

  async onSettings({ newSettings, changedKeys }) {
    this.logger.info("settings.changed", {
      keys: changedKeys.join(", "),
    });

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    if (
      changedKeys.includes("formulas") ||
      changedKeys.includes("input_links")
    ) {
      const detectedInputs = this.detectRequiredInputs(newSettings);
      const originalNumInputs = this.getData().numInputs ?? 2;
      const newNumInputs = Math.max(detectedInputs, originalNumInputs);
      if (newNumInputs !== this.numInputs) {
        this.logger.info("device.capacity_updated", {
          old: this.numInputs,
          new: newNumInputs,
        });
        this.numInputs = newNumInputs;
        this.availableInputs = this.getAvailableInputIds();
      }
    }

    const formatSettings = {};
    let needsFormat = false;

    let parsedFormulas = [];
    if (changedKeys.includes("formulas")) {
      try {
        let rawFormulas = newSettings.formulas;

        this.logger.debug("debug.raw_formulas", {
          formulas: rawFormulas,
        });
        parsedFormulas =
          typeof rawFormulas === "string"
            ? JSON.parse(rawFormulas)
            : rawFormulas;

        const formatted = JSON.stringify(parsedFormulas, null, 2);
        const original =
          typeof newSettings.formulas === "string"
            ? newSettings.formulas
            : JSON.stringify(newSettings.formulas);
        if (formatted !== original) {
          formatSettings.formulas = formatted;
          needsFormat = true;

          this.logger.debug("settings.formatting", {
            type: "formulas",
          });
        }
      } catch (e) {
        this.logger.error("parse.error_formulas_json", {
          message: e.message,
        });
        throw new Error(
          this.homey.__("parse.error_formulas_invalid", {
            message: e.message,
          }),
        );
      }
    }

    let parsedLinks = [];
    if (changedKeys.includes("input_links")) {
      try {
        let rawLinks = newSettings.input_links;

        this.logger.debug("debug.raw_input_links", {
          links: rawLinks,
        });
        parsedLinks =
          typeof rawLinks === "string" ? JSON.parse(rawLinks) : rawLinks;

        const formatted = JSON.stringify(parsedLinks, null, 2);
        const original =
          typeof newSettings.input_links === "string"
            ? newSettings.input_links
            : JSON.stringify(newSettings.input_links);
        if (formatted !== original) {
          formatSettings.input_links = formatted;
          needsFormat = true;

          this.logger.debug("settings.formatting", {
            type: "input_links",
          });
        }
      } catch (e) {
        this.logger.error("parse.error_input_links", {
          message: e.message,
        });
        throw new Error(
          this.homey.__("parse.error_input_links_invalid", {
            message: e.message,
          }),
        );
      }
    }

    if (changedKeys.includes("formulas")) {
      this.formulas = parsedFormulas.map((f) => ({
        id: f.id,
        name: f.name,
        expression: f.expression,
        enabled: f.enabled !== false,
        timeout: f.timeout ?? 0,
        firstImpression: f.firstImpression === true,
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false,
      }));
      this.availableInputs.forEach((id) => {
        this.formulas.forEach((f) => {
          f.inputStates[id] = "undefined";
          f.lockedInputs[id] = false;
        });
      });

      this.logger.debug("formula.reinitialized", {
        count: this.formulas.length,
      });
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        if (!validation.valid) {
          throw new Error(
            this.homey.__("formula.error_validation", {
              name: formula.name,
              error: validation.error,
            }),
          );
        }
      }
    }

    if (changedKeys.includes("input_links")) {
      await this.setupDeviceLinks();
      await this.evaluateAllFormulasInitial();
    }

    if (
      changedKeys.includes("formulas") &&
      !changedKeys.includes("input_links")
    ) {
      await this.refetchInputsAndEvaluate("formulas-change");
    }

    this.startTimeoutChecks();

    this.logger.info("settings.applied");

    if (needsFormat) {
      // Bruk setImmediate for å la Homey fullføre nåværende settings-oppdatering først
      setImmediate(async () => {
        try {
          this.logger.debug("settings.applying_formatted");

          // Sjekk at enheten fortsatt eksisterer
          if (this._isDeleting) {
            this.logger.debug("Device being deleted, skipping auto-format");
            return;
          }

          await this.setSettings(formatSettings);
          this.logger.info("settings.auto_formatted");
        } catch (e) {
          // Ignorer feil hvis enheten er slettet
          if (e?.statusCode === 404 || this._isDeleting) {
            this.logger.debug(
              "Device deleted during auto-format, ignoring error",
            );
            return;
          }

          this.logger.error("settings.format_failed", {
            message: e.message,
          });
        }
      });
    }
  }

  async pollDeviceInputs() {
    this.logger.debug("polling.all_inputs");

    const links = this.inputLinks || [];
    if (!links.length) {
      this.logger.warn("polling.no_links");
      return;
    }
    if (!this.homey.app.api) {
      this.logger.error("polling.api_unavailable");
      return;
    }

    for (const link of links) {
      this.logger.debug("polling.input", {
        input: link.input,
        device: link.deviceId,
        capability: link.capability,
      });
      try {
        const dev = await this.homey.app.api.devices.getDevice({
          id: link.deviceId,
        });
        if (!dev) {
          this.logger.warn("polling.device_not_found", {
            device: link.deviceId,
          });
          continue;
        }

        let raw = null;
        if (dev.capabilitiesObj && dev.capabilitiesObj[link.capability]) {
          raw = dev.capabilitiesObj[link.capability].value;
        } else if (
          dev.capabilityValues &&
          dev.capabilityValues[link.capability] !== undefined
        ) {
          raw = dev.capabilityValues[link.capability];
        } else if (dev.state && dev.state[link.capability] !== undefined) {
          raw = dev.state[link.capability];
        }

        if (raw === null || raw === undefined) {
          this.logger.warn("polling.no_value", {
            input: link.input.toUpperCase(),
            capability: link.capability,
          }); // FIKSET: Fjernet ekstra parentes her
          continue;
        }

        const boolValue = this.convertToBoolean(raw, link.capability);

        this.logger.input("polling.value_received", {
          input: link.input.toUpperCase(),
          value: raw,
          boolean: boolValue,
        });

        for (const formula of this.formulas) {
          formula.inputStates[link.input] = boolValue;
          if (boolValue !== "undefined") {
            formula.lastInputTime = Date.now();
          }
        }
      } catch (e) {
        this.logger.error("polling.failed", {
          input: link.input,
          message: e.message,
        });
      }
    }
  }

  async onDeleted() {
    this._isDeleting = true;

    this.logger.device("device.deleted_cleanup");

    for (const [key, entry] of this.deviceListeners.entries()) {
      try {
        if (typeof entry?.unregister === "function") {
          await entry.unregister();

          this.logger.debug("devicelinks.unregistered", {
            key,
          });
        }
      } catch (e) {
        this.logger.error("devicelinks.error_cleanup", {
          message: e.message,
        });
      }
    }
    this.deviceListeners.clear();

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }

    if (
      this.pollingIntervals &&
      typeof this.pollingIntervals.clear === "function"
    ) {
      try {
        this.pollingIntervals.clear();
      } catch (_) {}
    }

    this.logger.info("device.cleanup_complete");
  }
};