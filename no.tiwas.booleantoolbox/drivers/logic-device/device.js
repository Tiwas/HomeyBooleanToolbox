'use strict';

const Homey = require('homey');

module.exports = class LogicDeviceDevice extends Homey.Device {

  async onInit() {
    this.log(`Logic Device '${this.getName()}' initializing.`);
    
    // First, read settings to detect how many inputs we actually need
    const settings = this.getSettings();
    const detectedInputs = this.detectRequiredInputs(settings);
    
    // Use the higher of: detected inputs, or original numInputs from device data
    const originalNumInputs = this.getData().numInputs || 2;
    this.numInputs = Math.max(detectedInputs, originalNumInputs);
    
    if (detectedInputs > originalNumInputs) {
      this.log(`📈 Detected ${detectedInputs} inputs needed (originally ${originalNumInputs}). Expanding capacity!`);
    }
    
    this.availableInputs = this.getAvailableInputIds();
    this.deviceListeners = new Map();
    this.pollingIntervals = new Map();
    
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }
    
    if (!this.hasCapability('alarm_generic')) {
      await this.addCapability('alarm_generic');
    }
    
    try {
      await this.setCapabilityOptions('onoff', {
        setable: false,
        getable: true
      });
      this.log('✅ Set onoff as read-only');
    } catch (e) {
      this.log('Could not set capability options:', e.message);
    }
    
    await this.initializeFormulas();
    await this.setupDeviceLinks();
    
    this.log('Running initial formula evaluation...');
    await this.evaluateAllFormulasInitial();
    
    this.startTimeoutChecks();
    
    this.log(`Logic Device '${this.getName()}' initialized with ${this.numInputs} inputs`);
  }

  getAvailableInputIds() {
    const allInputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    return allInputs.slice(0, this.numInputs);
  }

  getAvailableInputsUppercase() {
    return this.availableInputs.map(i => i.toUpperCase());
  }

  detectRequiredInputs(settings) {
    let maxInput = 2; // Default minimum
    
    try {
      // Check formulas for used inputs
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];
      
      formulasData.forEach(formula => {
        if (!formula.expression) return;
        
        // Find all letter inputs (A-J) in the expression
        const pattern = /\b([A-J])\b/gi;
        const matches = formula.expression.match(pattern);
        
        if (matches) {
          matches.forEach(letter => {
            const inputNumber = letter.toUpperCase().charCodeAt(0) - 64; // A=1, B=2, etc.
            maxInput = Math.max(maxInput, inputNumber);
          });
        }
      });
      
      // Also check input_links
      const inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
      
      inputLinks.forEach(link => {
        if (link.input) {
          const inputNumber = link.input.toLowerCase().charCodeAt(0) - 96; // a=1, b=2, etc.
          maxInput = Math.max(maxInput, inputNumber);
        }
      });
      
      this.log(`🔍 Detected max input: ${String.fromCharCode(64 + maxInput)} (${maxInput} inputs needed)`);
      
    } catch (e) {
      this.error('Error detecting required inputs:', e.message);
    }
    
    return maxInput;
  }

  async initializeFormulas() {
    const settings = this.getSettings();
    try {
      const formulasData = settings.formulas ? JSON.parse(settings.formulas) : [];
      
      this.formulas = formulasData.map(f => ({
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
        timedOut: false
      }));
      
      this.formulas.forEach(formula => {
        this.availableInputs.forEach(id => {
          formula.inputStates[id] = 'undefined';
          formula.lockedInputs[id] = false;
        });
      });
      
    } catch (e) {
      this.error('Failed to parse formulas:', e);
      this.formulas = [];
    }
    
    if (this.formulas.length === 0) {
      const defaultFormula = {
        id: 'formula_1',
        name: 'Main Formula',
        expression: this.getDefaultExpression(),
        enabled: true,
        timeout: 0,
        firstImpression: false,
        inputStates: {},
        lockedInputs: {},
        lastInputTime: null,
        result: null,
        timedOut: false
      };
      
      this.availableInputs.forEach(id => {
        defaultFormula.inputStates[id] = 'undefined';
        defaultFormula.lockedInputs[id] = false;
      });
      
      this.formulas = [defaultFormula];
    }
    
    this.log(`Initialized ${this.formulas.length} formulas`);
    this.formulas.forEach(f => {
      this.log(`  - ${f.name}: "${f.expression}" (enabled: ${f.enabled})`);
    });
  }

  getDefaultExpression() {
    const inputs = this.getAvailableInputsUppercase();
    return inputs.join(' AND ');
  }

  async setupDeviceLinks() {
    this.log('Setting up device links...');

    // Rydd opp eventuelle gamle lyttere
    for (const [key, listener] of this.deviceListeners.entries()) {
      try {
        if (listener.unregister) {
          await listener.unregister();
          this.log(`Unregistered listener: ${key}`);
        }
      } catch (e) {
        this.error('Error unregistering listener:', e);
      }
    }
    this.deviceListeners.clear();

    // Les koblinger fra settings
    const settings = this.getSettings();
    let inputLinks = [];
    try {
      inputLinks = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.error('Failed to parse input_links:', e);
      return;
    }

    // 🔧 Viktig: persister på instansen for senere bruk (poll/re-fetch)
    this.inputLinks = inputLinks;

    this.log(`Setting up ${inputLinks.length} device links`);
    for (const link of inputLinks) {
      try {
        this.log(`\n=== Setting up link for input ${link.input?.toUpperCase()} ===`);
        await this.setupDeviceListener(link);
        this.log(`=== Completed setup for input ${link.input?.toUpperCase()} ===\n`);
      } catch (e) {
        this.error(`Failed to setup listener for input ${link.input}:`, e);
      }
    }

    this.log('\n=== Fetching initial values for all inputs ===');
    await this.fetchInitialValues(inputLinks);
    this.log('=== Initial values fetch complete ===\n');

    this.log('Device links setup complete');
  }


  async fetchInitialValues(inputLinks) {
    if (!this.homey.app.api) {
      this.error('App API not available for fetching initial values');
      return;
    }

    for (const link of inputLinks) {
      const { input, deviceId, capability, deviceName } = link;
      
      if (!input || !deviceId || !capability) {
        continue;
      }

      try {
        this.log(`[${input.toUpperCase()}] Fetching initial value...`);
        
        const device = await this.homey.app.api.devices.getDevice({ id: deviceId });
        
        if (!device) {
          this.log(`[${input.toUpperCase()}] ❌ Device not found`);
          continue;
        }

        let initialValue = null;

        if (device.capabilitiesObj && device.capabilitiesObj[capability]) {
          initialValue = device.capabilitiesObj[capability].value;
          this.log(`[${input.toUpperCase()}] ✔ Got value from capabilitiesObj: ${initialValue}`);
        } else if (device.capabilityValues && device.capabilityValues[capability] !== undefined) {
          initialValue = device.capabilityValues[capability];
          this.log(`[${input.toUpperCase()}] ✔ Got value from capabilityValues: ${initialValue}`);
        } else if (device.state && device.state[capability] !== undefined) {
          initialValue = device.state[capability];
          this.log(`[${input.toUpperCase()}] ✔ Got value from state: ${initialValue}`);
        }

        if (initialValue !== null && initialValue !== undefined) {
          const boolValue = this.convertToBoolean(initialValue, capability);
          this.log(`[${input.toUpperCase()}] ✔ Initial value: ${initialValue} → ${boolValue}`);
          
          for (const formula of this.formulas) {
            formula.inputStates[input] = boolValue;
            this.log(`[${input.toUpperCase()}] Set in '${formula.name}' to ${boolValue}`);
          }
        } else {
          this.log(`[${input.toUpperCase()}] ⚠️ No initial value found - waiting for first event`);
        }

      } catch (e) {
        this.error(`[${input.toUpperCase()}] Error fetching initial value:`, e.message);
      }
    }
  }

  async refetchInputsAndEvaluate(source = 'unknown') {
    this.log(`🔁 Refetch+Eval invoked (source=${source})`);
    let links = [];
    try {
      const settings = this.getSettings();
      links = settings.input_links ? JSON.parse(settings.input_links) : [];
    } catch (e) {
      this.error('Failed to parse input_links during refetch:', e.message);
    }

    if (!Array.isArray(links) || links.length === 0) {
      this.warn('⚠️ No input links available during refetch; skipping value fetch.');
      await this.evaluateAllFormulasInitial();
      return;
    }

    // Persistér for senere bruk (polling, re-evaluering, osv.)
    this.inputLinks = links;

    this.log('📥 Refetching initial values before evaluation...');
    await this.fetchInitialValues(links);
    await this.evaluateAllFormulasInitial();
  }

async setupDeviceListener(link) {
  const { input, deviceId, capability, deviceName } = link;

  this.log(`\n[${input.toUpperCase()}] ========== SETUP START ==========`); 
  this.log(`[${input.toUpperCase()}] Device Name: ${deviceName}`);
  this.log(`[${input.toUpperCase()}] Device ID: ${deviceId}`);
  this.log(`[${input.toUpperCase()}] Capability: ${capability}`);

  if (!input || !deviceId || !capability) {
    this.error(`[${input?.toUpperCase?.() ?? '?'}] Invalid link configuration:`, link);
    return;
  }

  try {
    if (!this.homey.app.api) {
      this.error(`[${input.toUpperCase()}] App API not available!`);
      return;
    }

    this.log(`[${input.toUpperCase()}] Getting all devices from API...`);
    const allDevices = await this.homey.app.api.devices.getDevices();
    this.log(
      `[${input.toUpperCase()}] Total devices found: ${Object.keys(allDevices).length}`
    );

    const targetDevice = allDevices[deviceId];
    if (!targetDevice) {
      this.error(`[${input.toUpperCase()}] ❌ Device not found: ${deviceId}`);
      const sampleIds = Object.keys(allDevices).slice(0, 5);
      this.error(`[${input.toUpperCase()}] Sample device IDs:`, sampleIds);
      return;
    }

    this.log(`[${input.toUpperCase()}] ✔ Found device: ${targetDevice.name}`);
    this.log(`[${input.toUpperCase()}] Device capabilities:`, targetDevice.capabilities);

    if (!targetDevice.capabilities || !targetDevice.capabilities.includes(capability)) {
      this.error(`[${input.toUpperCase()}] ❌ Device missing capability: ${capability}`);
      this.error(`[${input.toUpperCase()}] Available:`, targetDevice.capabilities);
      return;
    }
    this.log(`[${input.toUpperCase()}] ✔ Device has capability: ${capability}`);

    // --- Prøv å hente initialverdi (best-effort, vi gjør uansett en egen fetch senere) ---
    let initialValue = null;
    this.log(`[${input.toUpperCase()}] Attempting to get initial value...`);
    if (targetDevice.capabilityValues && targetDevice.capabilityValues[capability] !== undefined) {
      initialValue = targetDevice.capabilityValues[capability];
      this.log(`[${input.toUpperCase()}] ✔ Method 1 (capabilityValues): ${initialValue}`);
    } else if (targetDevice.capabilityInstances && targetDevice.capabilityInstances[capability]) {
      initialValue = targetDevice.capabilityInstances[capability].value;
      this.log(`[${input.toUpperCase()}] ✔ Method 2 (capabilityInstances): ${initialValue}`);
    } else if (targetDevice.state && targetDevice.state[capability] !== undefined) {
      initialValue = targetDevice.state[capability];
      this.log(`[${input.toUpperCase()}] ✔ Method 3 (state): ${initialValue}`);
    } else {
      try {
        this.log(`[${input.toUpperCase()}] Trying to fetch current value...`);
        const deviceState = await this.homey.app.api.devices.getDevice({ id: deviceId });
        if (deviceState && deviceState.capabilityValues) {
          initialValue = deviceState.capabilityValues[capability];
          this.log(`[${input.toUpperCase()}] ✔ Method 4 (fresh fetch): ${initialValue}`);
        }
      } catch (e) {
        this.log(`[${input.toUpperCase()}] Method 4 failed:`, e.message);
      }
    }

    if (initialValue !== null && initialValue !== undefined) {
      const boolValue = this.convertToBoolean(initialValue, capability);
      this.log(
        `[${input.toUpperCase()}] ✔ Initial value: ${initialValue} → ${boolValue}`
      );
      for (const formula of this.formulas) {
        formula.inputStates[input] = boolValue;
        this.log(
          `[${input.toUpperCase()}] Set in '${formula.name}' to ${boolValue}`
        );
      }
    } else {
      this.log(
        `[${input.toUpperCase()}] ⚠️ No initial value - waiting for first event`
      );
    }

    // --- Event-listener ---
    const listenerFn = async (value) => {
      // Kortslutt hvis devicen er i sletting
      if (this._isDeleting) return;

      this.log(`\n*** [${input.toUpperCase()}] EVENT RECEIVED ***`);
      this.log(`Device: ${targetDevice.name}`);
      this.log(`Capability: ${capability}`);
      this.log(`Raw value: ${value}`);

      const boolValue = this.convertToBoolean(value, capability);
      this.log(`Boolean value: ${boolValue}`);

      for (const formula of this.formulas) {
        this.log(
          `Updating '${formula.name}' input ${input.toUpperCase()} → ${boolValue}`
        );
        try {
          await this.setInputForFormula(formula.id, input, boolValue);
        } catch (err) {
          if (!this._isDeleting) this.error('setInputForFormula error:', err);
        }
      }
      this.log(`*** [${input.toUpperCase()}] EVENT COMPLETE ***\n`);
    };

    // Registrering + oppsett av "unregister"
    this.log(`[${input.toUpperCase()}] Registering capability listener...`);
    let registered = false;
    let unregister = null;
    let eventName = `capability.${capability}`;

    // makeCapabilityInstance (SDK)
    if (typeof targetDevice.makeCapabilityInstance === 'function') {
      try {
        this.log(`[${input.toUpperCase()}] Trying makeCapabilityInstance...`);
        const instance = targetDevice.makeCapabilityInstance(capability, listenerFn);
        // I Homey SDK er det vanlig at instance har .destroy()
        unregister = async () => {
          try {
            if (instance && typeof instance.destroy === 'function') {
              instance.destroy();
            }
          } catch (e) {
            this.error(`[${input.toUpperCase()}] Error destroying capability instance:`, e.message);
          }
        };
        this.log(`[${input.toUpperCase()}] ✔ Registered via makeCapabilityInstance`);
        registered = true;
      } catch (e) {
        this.error(`[${input.toUpperCase()}] makeCapabilityInstance failed:`, e.message);
      }
    }

    // device.on fallback (EventEmitter-lignende)
    if (!registered && typeof targetDevice.on === 'function') {
      try {
        this.log(`[${input.toUpperCase()}] Trying device.on('${eventName}')...`);
        targetDevice.on(eventName, listenerFn);
        unregister = async () => {
          try {
            if (typeof targetDevice.removeListener === 'function') {
              targetDevice.removeListener(eventName, listenerFn);
            }
          } catch (e) {
            this.error(`[${input.toUpperCase()}] Error removing listener:`, e.message);
          }
        };
        this.log(`[${input.toUpperCase()}] ✔ Registered via device.on`);
        registered = true;
      } catch (e) {
        this.error(`[${input.toUpperCase()}] device.on failed:`, e.message);
      }
    }

    if (!registered) {
      this.error(
        `[${input.toUpperCase()}] ❌ Could not register listener!`
      );
      this.log(
        `[${input.toUpperCase()}] Available methods:`,
        Object.keys(targetDevice).filter(k => typeof targetDevice[k] === 'function').slice(0, 10)
      );
    }

    const listenerKey = `${input}-${deviceId}-${capability}`;
    this.deviceListeners.set(listenerKey, {
      deviceId,
      capability,
      input,
      device: targetDevice,
      listener: listenerFn,
      registered,
      unregister, // 👈 LAGRER UNREGISTER
      eventName
    });

    this.log(`[${input.toUpperCase()}] ========== SETUP COMPLETE ==========\n`);
  } catch (e) {
    this.error(`[${input.toUpperCase()}] ❌ SETUP FAILED:`, e.message);
    this.error(`[${input.toUpperCase()}] Stack:`, e.stack);
  }
}

  convertToBoolean(value, capability) {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (capability.startsWith('alarm_')) {
      return !!value;
    }
    
    if (capability === 'onoff') {
      return !!value;
    }
    
    if (typeof value === 'number') {
      return value > 0;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'on' || lowerValue === 'yes';
    }
    
    return !!value;
  }

  async safeSetCapabilityValue(cap, value) {
    // Ikke gjør noe hvis enheten er i ferd med å slettes
    if (this._isDeleting) return;
    try {
      // Valgfritt: hopp over hvis capability ikke finnes
      if (!this.hasCapability(cap)) return;

      await this.setCapabilityValue(cap, value);
    } catch (e) {
      // Ignorer 404 / Not Found – typisk etter sletting
      const msg = e?.message || '';
      if (e?.statusCode === 404 || /not\s*found/i.test(msg)) {
        this.log(`(safe) Skipper ${cap} – enheten finnes ikke lenger.`);
        return;
      }
      // Andre feil logges – men knekker ikke flyten
      this.error(`Capability update failed for ${cap}:`, msg);
    }
  }

  async setInputForFormula(formulaId, inputId, value) {
    if (this._isDeleting) return null;
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      return null;
    }
    
    if (formula.firstImpression && formula.lockedInputs[inputId]) {
      this.log(`⚠️ Input '${inputId.toUpperCase()}' locked for formula '${formula.name}' (firstImpression mode)`);
      return formula.result;
    }
    
    const oldValue = formula.inputStates[inputId];
    this.log(`Setting input '${inputId.toUpperCase()}' to ${value} for formula '${formula.name}' (was: ${oldValue})`);
    
    formula.inputStates[inputId] = value;
    formula.timedOut = false;
    
    if (formula.firstImpression && value !== 'undefined' && !formula.lockedInputs[inputId]) {
      formula.lockedInputs[inputId] = true;
      this.log(`🔒 Input '${inputId.toUpperCase()}' locked at value ${value} (firstImpression mode)`);
    }
    
    if (value !== 'undefined') {
      formula.lastInputTime = Date.now();
    }
    
    return await this.evaluateFormula(formulaId);
  }

  async evaluateFormula(formulaId, resetLocks = false) {
    if (this._isDeleting) return null;
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula || !formula.enabled) {
      this.log(`Formula '${formulaId}' not found or disabled.`);
      return null;
    }

    if (resetLocks && formula.firstImpression) {
      this.availableInputs.forEach(id => {
        formula.lockedInputs[id] = false;
      });
      this.log(`🔓 Unlocked all inputs for formula '${formula.name}'`);
    }

    const expression = formula.expression;
    if (!expression) {
      this.log('No expression set, cannot evaluate.');
      return null;
    }

    const requiredInputs = this.parseExpression(expression);
    if (requiredInputs.length === 0) return null;

    const allInputsDefined = requiredInputs.every(id => 
      formula.inputStates[id.toLowerCase()] !== 'undefined'
    );
    
    if (!allInputsDefined) {
      this.log(`Formula '${formula.name}': Waiting for inputs. Required: [${requiredInputs.join(', ')}]`);
      return null;
    }

    const values = {};
    this.availableInputs.forEach(id => {
      values[id.toUpperCase()] = formula.inputStates[id];
    });

    this.log(`Formula '${formula.name}': Evaluating with inputs:`, values);

    let evalExpression = expression
      .replace(/\bAND\b|&|\*/gi, '&&')
      .replace(/\bOR\b|\||\+/gi, '||')
      .replace(/\bXOR\b|\^|!=/gi, '!=')
      .replace(/\bNOT\b/gi, '!');

    for (const key in values) {
      if (values[key] !== 'undefined') {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        evalExpression = evalExpression.replace(regex, values[key]);
      }
    }

    this.log(`Evaluating: "${expression}" → "${evalExpression}"`);

    try {
      const evaluate = new Function(`return ${evalExpression}`);
      const result = !!evaluate();

      this.log(`✅ Formula '${formula.name}' result: ${result}`);
      
      const previousResult = formula.result;
      formula.result = result;
      formula.timedOut = false;
      
      try {
        await this.safeSetCapabilityValue('onoff', result);
        await this.safeSetCapabilityValue('alarm_generic', result);
      } catch (e) {
        if (e.statusCode === 404) {
          this.log('Device deleted, skipping capability update');
          return null;
        }
        throw e;
      }
      
      if (previousResult !== null && previousResult !== result) {
        const triggerData = {
          formula: {
            id: formulaId,
            name: formula.name
          }
        };
        
        const state = { formulaId };
        
        try {
          if (result) {
            await this.homey.flow.getDeviceTriggerCard('formula_changed_to_true')
              .trigger(this, triggerData, state);
          } else {
            await this.homey.flow.getDeviceTriggerCard('formula_changed_to_false')
              .trigger(this, triggerData, state);
          }
          
          await this.homey.flow.getDeviceTriggerCard('device_state_changed')
            .trigger(this, { state: result }, {});
            
        } catch (e) {
          if (e.statusCode === 404) {
            this.log('Device deleted, skipping flow trigger');
            return null;
          }
          this.error('Error triggering flow:', e);
        }
      }

      return result;

    } catch (e) {
      this.error(`❌ Failed to evaluate formula '${formula.name}': ${e.message}`);
      return null;
    }
  }

  async evaluateAllFormulasInitial() {
    this.log('Initial evaluation of all formulas...');
    
    let anyEvaluated = false;
    
    for (const formula of this.formulas) {
      if (!formula.enabled) continue;
      
      const expression = formula.expression;
      if (!expression) continue;
      
      const requiredInputs = this.parseExpression(expression);
      if (requiredInputs.length === 0) continue;
      
      const allInputsDefined = requiredInputs.every(id => 
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );
      
      if (allInputsDefined) {
        this.log(`Formula '${formula.name}': All inputs defined, evaluating...`);
        await this.evaluateFormula(formula.id);
        anyEvaluated = true;
      } else {
        const states = {};
        requiredInputs.forEach(id => {
          states[id] = formula.inputStates[id.toLowerCase()];
        });
        this.log(`Formula '${formula.name}': Missing inputs:`, states);
      }
    }
    
    if (!anyEvaluated) {
      this.log('⚠️ No formulas could be evaluated - waiting for input values');
      await this.safeSetCapabilityValue('onoff', false);
      await this.safeSetCapabilityValue('alarm_generic', false);
    }
  }

  parseExpression(expression) {
    const inputs = this.getAvailableInputsUppercase(); // f.eks. ['A','B','C']
    if (!inputs.length) return [];
    const varRe = new RegExp(`\\b(${inputs.join('|')})\\b`, 'gi');
    const matches = expression.match(varRe);
    return matches ? [...new Set(matches.map(c => c.toUpperCase()))] : [];
  }

  validateExpression(expression) {
    if (!expression || expression.trim() === '') {
      return { valid: false, error: 'Expression cannot be empty' };
    }

    const upper = expression.toUpperCase();
    const inputs = this.getAvailableInputsUppercase();
    if (!inputs.length) return { valid: false, error: 'No inputs available' };

    // Tokeniser: ord-operatorer, symbol-operatorer, paranteser og inputs
    const tokenRe = new RegExp(
      `\\b(?:AND|OR|XOR|NOT)\\b|&&|\\|\\||\\^|!=|\\*|\\+|!|\\(|\\)|\\b(?:${inputs.join('|')})\\b`,
      'gi'
    );

    // Finn ugyldige rester
    const stripped = upper.replace(tokenRe, '').replace(/\s+/g, '');
    if (stripped.length > 0) {
      return { valid: false, error: `Invalid tokens in expression: "${stripped}"` };
    }

    // Grov parantes-sjekk
    let depth = 0;
    for (const ch of upper) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth < 0) return { valid: false, error: 'Unbalanced parentheses' };
    }
    if (depth !== 0) return { valid: false, error: 'Unbalanced parentheses' };

    // Syntaks-test: normaliser til JS og evaluer med dummyverdier
    let testExpr = upper
      .replace(/\bAND\b|&&|\*/g, '&&')
      .replace(/\bOR\b|\|\||\+/g, '||')
      .replace(/\bXOR\b|\^|!=/g, '!=')  // boolsk XOR ~= ulikhet
      .replace(/\bNOT\b|!/g, '!');

    for (const key of inputs) {
      const re = new RegExp(`\\b${key}\\b`, 'g');
      testExpr = testExpr.replace(re, 'true');
    }

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return ${testExpr}`);
      void fn();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Invalid expression syntax: ${e.message}` };
    }
  }

  getFormulas() {
    return this.formulas
      .filter(f => f.enabled)
      .map(f => ({
        id: f.id,
        name: f.name,
        description: f.expression || '(no expression)'
      }));
  }

  getInputOptions() {
    return this.getAvailableInputsUppercase().map(input => ({
      id: input.toLowerCase(),
      name: input
    }));
  }

  getFormulaResult(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) {
      this.log(`getFormulaResult: Formula '${formulaId}' not found`);
      return null;
    }
    
    return formula.result;
  }

  hasFormulaTimedOut(formulaId) {
    const formula = this.formulas.find(f => f.id === formulaId);
    if (!formula) return false;
    return formula.timedOut;
  }

  async evaluateAllFormulas() {
    this.log('Re-evaluating all formulas (resetting locks)...');
    
    const results = [];
    for (const formula of this.formulas) {
      if (formula.enabled) {
        this.availableInputs.forEach(id => {
          formula.lockedInputs[id] = false;
        });
        this.log(`🔓 Unlocked all inputs for formula '${formula.name}'`);
        
        const result = await this.evaluateFormula(formula.id);
        results.push({ id: formula.id, name: formula.name, result });
      }
    }
    
    this.log(`Evaluated ${results.length} formulas`);
    return results;
  }

  startTimeoutChecks() {
    this.timeoutInterval = setInterval(() => {
      this.checkTimeouts();
    }, 1000);
  }

  checkTimeouts() {
    const now = Date.now();
    
    this.formulas.forEach(formula => {
      if (!formula.timeout || formula.timeout <= 0) return;
      if (formula.timedOut || !formula.enabled) return;
      if (!formula.lastInputTime) return;
      
      const hasAnyInput = this.availableInputs.some(id => 
        formula.inputStates[id] !== 'undefined'
      );
      
      if (!hasAnyInput) return;
      
      const requiredInputs = this.parseExpression(formula.expression);
      const allInputsDefined = requiredInputs.every(id => 
        formula.inputStates[id.toLowerCase()] !== 'undefined'
      );
      
      if (allInputsDefined) return;
      
      const timeoutMs = formula.timeout * 1000;
      const elapsed = now - formula.lastInputTime;
      
      if (elapsed >= timeoutMs) {
        this.log(`⏱️ Formula '${formula.name}' timed out after ${formula.timeout}s`);
        formula.timedOut = true;
        
        const triggerData = {
          formula: {
            id: formula.id,
            name: formula.name
          }
        };
        
        const state = {
          formulaId: formula.id
        };
        
        this.homey.flow.getDeviceTriggerCard('formula_timeout')
          .trigger(this, triggerData, state)
          .catch(err => this.error('Error triggering timeout:', err));
      }
    });
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed:', changedKeys);

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    // 1) Oppdater kapasitet hvis formler eller koblinger antyder flere inputs
    if (changedKeys.includes('formulas') || changedKeys.includes('input_links')) {
      const detectedInputs = this.detectRequiredInputs(newSettings);
      const originalNumInputs = this.getData().numInputs ?? 2;
      const newNumInputs = Math.max(detectedInputs, originalNumInputs);
      if (newNumInputs !== this.numInputs) {
        this.log(`📊 Updating capacity: ${this.numInputs} → ${newNumInputs} inputs`);
        this.numInputs = newNumInputs;
        this.availableInputs = this.getAvailableInputIds();
      }
    }

    // 2) Autoformat-buffer
    const formatSettings = {};
    let needsFormat = false;

    // 3) Parse/autoformat formler
    let parsedFormulas = [];
    if (changedKeys.includes('formulas')) {
      try {
        let rawFormulas = newSettings.formulas;
        this.log('[onSettings] Raw formulas input:', rawFormulas);
        parsedFormulas = typeof rawFormulas === 'string' ? JSON.parse(rawFormulas) : rawFormulas;
        this.log('[onSettings] Parsed formulas:', parsedFormulas);

        const formatted = JSON.stringify(parsedFormulas, null, 2);
        const original = typeof newSettings.formulas === 'string' ? newSettings.formulas : JSON.stringify(newSettings.formulas);
        if (formatted !== original) {
          formatSettings.formulas = formatted;
          needsFormat = true;
          this.log('Will auto-format formulas JSON');
        }
      } catch (e) {
        this.error('Could not parse formulas:', e.message);
        throw new Error(`Invalid formulas JSON: ${e.message}`);
      }
    }

    // 4) Parse/autoformat input_links (kun hvis de faktisk endret seg)
    let parsedLinks = [];
    if (changedKeys.includes('input_links')) {
      try {
        let rawLinks = newSettings.input_links;
        this.log('[onSettings] Raw input_links:', rawLinks);
        parsedLinks = typeof rawLinks === 'string' ? JSON.parse(rawLinks) : rawLinks;

        const formatted = JSON.stringify(parsedLinks, null, 2);
        const original = typeof newSettings.input_links === 'string' ? newSettings.input_links : JSON.stringify(newSettings.input_links);
        if (formatted !== original) {
          formatSettings.input_links = formatted;
          needsFormat = true;
          this.log('Will auto-format input_links JSON');
        }
      } catch (e) {
        this.error('Could not parse input_links:', e.message);
        throw new Error(`Invalid input_links JSON: ${e.message}`);
      }
    }

    // 5) Re-initialiser formelstrukturen ved formelendring
    if (changedKeys.includes('formulas')) {
      this.formulas = parsedFormulas.map(f => ({
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

      this.availableInputs.forEach(id => {
        this.formulas.forEach(f => {
          f.inputStates[id] = 'undefined';
          f.lockedInputs[id] = false;
        });
      });

      this.log(`Initialized ${this.formulas.length} formulas`);
      this.formulas.forEach(f => {
        this.log(` - ${f.name}: "${f.expression}" (enabled: ${f.enabled})`);
      });

      // Valider uttrykkene
      for (const formula of this.formulas) {
        const validation = this.validateExpression(formula.expression);
        this.log(`[onSettings] Validation for "${formula.expression}":`, validation);
        if (!validation.valid) {
          throw new Error(`Formula '${formula.name}': ${validation.error}`);
        }
      }
    }

    // 6) Hvis koblinger endret seg: sett opp lyttere og (re)hent initialverdier
    if (changedKeys.includes('input_links')) {
      await this.setupDeviceLinks();         // setter this.inputLinks + fetchInitialValues(...)
      await this.evaluateAllFormulasInitial();
    }

    // 7) Hvis KUN formler endret seg: hent verdier før evaluering
    if (changedKeys.includes('formulas') && !changedKeys.includes('input_links')) {
      await this.refetchInputsAndEvaluate('formulas-change');
    }

    this.startTimeoutChecks();
    this.log('Settings applied successfully');

    // 8) Autoformat settings etterpå
    if (needsFormat) {
      setTimeout(async () => {
        try {
          this.log('Applying formatted settings...');
          await this.setSettings(formatSettings);
          this.log('✨ Settings auto-formatted');
        } catch (e) {
          this.error('Failed to auto-format settings:', e.message);
        }
      }, 500);
    }
  }

  async pollDeviceInputs() {
    this.log('🔄 Polling all linked device inputs...');

    const links = this.inputLinks || [];
    if (!links.length) {
      this.warn('⚠️ No inputLinks available for polling');
      return;
    }
    if (!this.homey.app.api) {
      this.error('App API not available for polling');
      return;
    }

    for (const link of links) {
      this.log(`🔗 Polling input "${link.input}" from device "${link.deviceId}" using capability "${link.capability}"`);
      try {
        const dev = await this.homey.app.api.devices.getDevice({ id: link.deviceId });
        if (!dev) {
          this.warn(`⚠️ Device not found: ${link.deviceId}`);
          continue;
        }

        let raw = null;
        if (dev.capabilitiesObj && dev.capabilitiesObj[link.capability]) {
          raw = dev.capabilitiesObj[link.capability].value;
        } else if (dev.capabilityValues && dev.capabilityValues[link.capability] !== undefined) {
          raw = dev.capabilityValues[link.capability];
        } else if (dev.state && dev.state[link.capability] !== undefined) {
          raw = dev.state[link.capability];
        }

        if (raw === null || raw === undefined) {
          this.log(`⚠️ No value for ${link.input.toUpperCase()} (${link.capability})`);
          continue;
        }

        const boolValue = this.convertToBoolean(raw, link.capability);
        this.log(`📥 Polled ${link.input.toUpperCase()}: ${raw} → ${boolValue}`);

        for (const formula of this.formulas) {
          formula.inputStates[link.input] = boolValue;
          if (boolValue !== 'undefined') {
            formula.lastInputTime = Date.now();
          }
        }
      } catch (e) {
        this.error(`❌ Failed to poll ${link.input}:`, e.message);
      }
    }
  }

async onDeleted() {
  this._isDeleting = true; // 👈 signaliser til eventer at vi er på vei ut
  this.log('Device deleted — cleaning up listeners & timers');

  // Prøv å unregister’e alle listeners vi har lagret
  for (const [key, entry] of this.deviceListeners.entries()) {
    try {
      if (typeof entry?.unregister === 'function') {
        await entry.unregister();
        this.log(`Unregistered listener: ${key}`);
      } else if (entry?.device && entry?.listener && typeof entry.device.removeListener === 'function') {
        // Best effort fallback for device.on(...) varianter
        const ev = entry.eventName || (entry.capability ? `capability.${entry.capability}` : undefined);
        if (ev) entry.device.removeListener(ev, entry.listener);
        this.log(`Removed listener via removeListener: ${key}`);
      }
    } catch (e) {
      this.error('Error cleaning up listener:', e);
    }
  }
  this.deviceListeners.clear();

  // Stopp eventuelle intervaller (timeouts tikker i egen metode hos deg)
  if (this.timeoutInterval) {
    clearInterval(this.timeoutInterval);
    this.timeoutInterval = null;
  }

  // Frigi evt. andre ressurser (om du senere bruker pollingIntervals etc.)
  if (this.pollingIntervals && typeof this.pollingIntervals.clear === 'function') {
    try { this.pollingIntervals.clear(); } catch (_) {}
  }

  this.log('Cleanup complete');
}
};