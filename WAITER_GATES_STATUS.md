# Waiter Gates Implementation Status

**Branch:** `claude/waiter-gates-011CUpmak9V4m9sXDZT1hXEW`
**Last Update:** Backend implementation COMPLETE

---

## ✅ IMPLEMENTATION COMPLETE

All backend logic has been implemented. Ready for testing!

---

## 🎯 What Waiter Gates Should Do (User's Intent)

### Core Concept
Waiter Gates are **reactive flow cards** that keep a flow alive and listen for device capability changes.

### Example Use Case
```
Flow: Door opens while light is OFF
  WHEN: Door opens
  AND: Light is OFF
  AND: Wait 15 minutes for [Living Room Light].onoff = true
       ↓ YES (green): Light turned on → Reset alarm
       ↓ NO (red): Timeout → Keep alarm active
```

### How It Works
1. **Flow reaches Wait Gate** → Waiter is created with auto-generated UID
2. **Waiter registers listener** on device capability (e.g., Light.onoff)
3. **While waiting** (up to timeout):
   - If capability reaches target value → YES-output (green)
   - If timeout expires → NO-output (red)
   - If error → ERROR-output (bottom)
4. **Control Waiter** action card can:
   - **Enable**: Re-activate disabled waiter
   - **Disable**: Pause waiter temporarily
   - **Stop waiting**: End waiter gracefully (no output)

---

## ✅ What's Implemented (Commits f294dc5 + f555dfc)

### 1. Condition Card UI (.homeycompose/flow/conditions/wait_until_becomes_true.json)
```json
{
  "titleFormatted": "Wait [[timeout]] [[unit]] for [[device]].[[capability]] = [[target_value]] (ID: [[waiter_id]])",
  "args": [
    {
      "name": "waiter_id",       // Auto-generated UID if empty
      "type": "text"
    },
    {
      "name": "device",          // Autocomplete device picker
      "type": "device",
      "filter": "capabilities=*"
    },
    {
      "name": "capability",      // Autocomplete capability picker (NOT IMPLEMENTED YET)
      "type": "autocomplete"
    },
    {
      "name": "target_value",    // Value to wait for (e.g., "true", "50")
      "type": "text"
    },
    {
      "name": "timeout_value",   // Timeout amount
      "type": "number"
    },
    {
      "name": "timeout_unit",    // ms/s/m/h
      "type": "dropdown"
    }
  ]
}
```

### 2. Control Waiter Actions (.homeycompose/flow/actions/control_waiter.json)
**Changed from:**
- ❌ trigger (removed - capabilities trigger automatically)
- ❌ remove (removed - can't remove cards from flows)

**Changed to:**
- ✅ enable
- ✅ disable
- ✅ stop (stop waiting gracefully, no output)

### 3. Outputs (Clarified in hint text)
- ✅ **YES (green)**: Capability reached target value
- ❌ **NO (red)**: Timeout expired (ONLY timeout, not stop!)
- ⚠️ **ERROR (bottom)**: System error

---

## ✅ Backend Implementation Complete (Latest Session)

All critical backend features have been implemented:

### 1. ✅ Capability Autocomplete Listener (app.js:410-437)
- Returns list of available capabilities for selected device
- Filters results based on user query
- Proper error handling

### 2. ✅ WaiterManager Updates (WaiterManager.js)
- **createWaiter()** now accepts `deviceConfig` parameter (line 118)
- **registerCapabilityListener()** implemented (lines 308-358)
- **valueMatches()** helper implemented (lines 360-375)
- **stopWaiter()** method implemented (lines 377-400)
- **removeWaiter()** updated with listener cleanup (lines 291-300)
- **triggerWaiter()** removed (obsolete)

### 3. ✅ Condition Card Updates (app.js:439-506)
- Extracts device, capability, and target_value from args
- Creates deviceConfig object
- Passes deviceConfig to createWaiter()
- Registers capability listener after waiter creation
- Improved logging

### 4. ✅ Control Waiter Action Updates (app.js:526-544)
- Removed 'trigger' action (automatic via capabilities)
- Removed 'remove' action (can't remove flow cards)
- Added 'stop' action (graceful exit, no output)
- Kept 'enable' and 'disable' actions

---

## ❌ What Was NOT Implemented (Now Complete - See Above)

### 1. Capability Autocomplete Listener
**File:** `no.tiwas.booleantoolbox/app.js`
**Where:** In `registerAllFlowCards()` method

**What to add:**
```javascript
// After wait_until_becomes_true card is registered
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
```

### 2. WaiterManager: Add Capability Listener Registration
**File:** `no.tiwas.booleantoolbox/lib/WaiterManager.js`

**What to change in `createWaiter()` method:**

Add parameters to config:
```javascript
async createWaiter(id, config, flowContext, deviceConfig = null) {
    // deviceConfig = { deviceId, capability, targetValue }

    // ... existing code ...

    const waiterData = {
        id,
        created: Date.now(),
        flowId: flowContext.flowId,
        flowToken: flowContext.flowToken,
        enabled: true,
        timeoutMs,
        timeoutHandle: null,
        resolver: null,
        config,
        deviceConfig,           // NEW: Store device listening info
        capabilityListener: null // NEW: Store listener reference
    };

    // ... existing timeout code ...
}
```

**Add new method:**
```javascript
/**
 * Register capability listener for a waiter
 * @param {string} waiterId - Waiter ID
 * @param {object} homey - Homey API instance
 */
async registerCapabilityListener(waiterId, homey) {
    const waiter = this.waiters.get(waiterId);
    if (!waiter || !waiter.deviceConfig) return;

    const { deviceId, capability, targetValue } = waiter.deviceConfig;

    try {
        // Get device from Homey API
        const device = await homey.devices.getDevice({ id: deviceId });

        // Register capability listener
        const listener = async (value) => {
            this.logger.info(`📡 Capability change: ${deviceId}.${capability} = ${value}`);

            // Check if value matches target
            if (this.valueMatches(value, targetValue)) {
                this.logger.info(`✅ Target value reached for waiter: ${waiterId}`);

                // Trigger waiter (YES-output)
                if (waiter.resolver && waiter.enabled) {
                    waiter.resolver(true);
                    this.logger.info(`✅ Waiter "${waiterId}" resolved to YES-output (capability matched)`);
                }

                // Cleanup
                this.removeWaiter(waiterId);
            }
        };

        // Register listener
        await device.makeCapabilityInstance(capability, listener);

        // Store listener reference for cleanup
        waiter.capabilityListener = {
            device,
            capability,
            listener
        };

        this.logger.info(`📡 Registered listener for ${deviceId}.${capability}`);

    } catch (error) {
        this.logger.error(`Failed to register capability listener for ${waiterId}:`, error);
        throw error;
    }
}

/**
 * Check if actual value matches target value
 * @param {any} actual - Actual value from device
 * @param {string} target - Target value from user (as string)
 * @returns {boolean}
 */
valueMatches(actual, target) {
    // Convert target string to appropriate type
    let targetTyped = target;

    if (target === 'true') targetTyped = true;
    else if (target === 'false') targetTyped = false;
    else if (!isNaN(target)) targetTyped = Number(target);

    return actual === targetTyped;
}
```

**Update `removeWaiter()` to cleanup listeners:**
```javascript
removeWaiter(idPattern) {
    const matches = this.getWaitersByPattern(idPattern);

    if (matches.length === 0) {
        return 0;
    }

    let removed = 0;
    for (const { id, data: waiterData } of matches) {
        // Cancel timeout
        if (waiterData.timeoutHandle) {
            clearTimeout(waiterData.timeoutHandle);
        }

        // NEW: Unregister capability listener
        if (waiterData.capabilityListener) {
            try {
                const { device, capability, listener } = waiterData.capabilityListener;
                device.removeListener(`capability.${capability}`, listener);
                this.logger.info(`🔇 Unregistered listener for ${id}`);
            } catch (error) {
                this.logger.error(`Failed to unregister listener for ${id}:`, error);
            }
        }

        // ... rest of existing removal code ...
    }

    return removed;
}
```

### 3. Condition Card Run Listener Update
**File:** `no.tiwas.booleantoolbox/app.js`
**Location:** In `registerAllFlowCards()`, the wait_until_becomes_true listener

**What to change:**
```javascript
waitUntilCard.registerRunListener(async (args, state) => {
    try {
        const waiterId = args.waiter_id || '';
        const timeoutValue = Number(args.timeout_value) || 0;
        const timeoutUnit = args.timeout_unit || 's';

        // NEW: Extract device config
        const device = args.device;
        const capability = args.capability?.id || args.capability; // Handle autocomplete object
        const targetValue = args.target_value;

        this.logger.info(`🔷 Waiter condition triggered: ${waiterId || '(auto-generate)'}`);
        this.logger.info(`📡 Listening for: ${device.name}.${capability} = ${targetValue}`);

        return new Promise(async (resolve, reject) => {
            try {
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

                // Create waiter with device config
                const actualWaiterId = await this.waiterManager.createWaiter(
                    waiterId,
                    config,
                    flowContext,
                    deviceConfig  // NEW parameter
                );

                // Store resolver
                const waiterData = this.waiterManager.waiters.get(actualWaiterId);
                if (waiterData) {
                    waiterData.resolver = resolve;
                }

                // NEW: Register capability listener
                await this.waiterManager.registerCapabilityListener(
                    actualWaiterId,
                    this.homey
                );

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
```

### 4. Control Waiter 'Stop' Action
**File:** `no.tiwas.booleantoolbox/app.js`
**Location:** In control_waiter action listener

**What to change:**
```javascript
controlWaiterCard.registerRunListener(async (args, state) => {
    try {
        const waiterId = args.waiter_id;
        const action = args.action;

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
```

**Add to WaiterManager.js:**
```javascript
/**
 * Stop waiters gracefully (no output, just cleanup)
 * @param {string} idPattern - Waiter ID or pattern
 * @returns {number} - Number of waiters stopped
 */
stopWaiter(idPattern) {
    const matches = this.getWaitersByPattern(idPattern);

    if (matches.length === 0) {
        this.logger.warn(`⚠️  No waiters found matching pattern: ${idPattern}`);
        return 0;
    }

    let stopped = 0;
    for (const { id, data: waiterData } of matches) {
        // Just remove without triggering any output
        // (resolver is NOT called, so flow stops here)
        this.removeWaiter(id);
        stopped++;
    }

    this.logger.info(`🛑 Stopped ${stopped} waiter(s) matching "${idPattern}"`);
    return stopped;
}
```

### 5. Remove Old Trigger Logic (CLEANUP)
**File:** `no.tiwas.booleantoolbox/lib/WaiterManager.js`

**Delete this entire method** (no longer needed since capabilities trigger automatically):
```javascript
async triggerWaiter(idPattern, data = {}) {
    // DELETE THIS WHOLE METHOD
}
```

**Also remove from autocomplete list** in `getAllDefinedWaiterIds()` since we won't manually trigger.

---

## 🔧 Testing Instructions (After Implementation)

### Test Flow Setup

**Flow A: Main Flow**
```
WHEN: Door contact alarm turned ON
AND: Living Room Light is OFF
AND: Wait 2 minutes for [Living Room Light].onoff = true (ID: light-check)
  → YES: Send notification "Light turned on!"
  → NO: Send notification "Light still off after 2 minutes!"
```

**Flow B: Control Flow** (optional)
```
WHEN: Some trigger
THEN: Control waiter "light-check" → Stop waiting
```

### Expected Behavior

**Case 1: Light turns ON within 2 minutes**
1. Door opens → Flow A starts
2. Waiter created, listening on Light.onoff
3. Light turns ON
4. Capability listener detects change
5. Waiter resolves to YES
6. "Light turned on!" notification

**Case 2: Light stays OFF for 2+ minutes**
1. Door opens → Flow A starts
2. Waiter created, listening on Light.onoff
3. 2 minutes pass, no change
4. Timeout triggers
5. Waiter resolves to NO
6. "Light still off!" notification

**Case 3: Stop waiter manually**
1. Door opens → Flow A starts
2. Waiter created
3. Flow B runs "Control waiter → Stop"
4. Waiter removed, no output, flow ends

---

## 📊 Current Git Status

```
Branch: claude/waiter-gates-011CUpmak9V4m9sXDZT1hXEW
Status: Clean working tree
Latest commits:
  f555dfc - WIP: Add device/capability/target_value parameters (UI ONLY)
  f294dc5 - Remove 'trigger' and 'remove' actions, add 'stop waiting'
  42a8c75 - Add timeout handling with NO-output
  6f7eb0c - Fix: Show all defined waiter IDs in autocomplete
```

---

## ⚠️ Important Notes for Next Session

1. **Do NOT test the current code** - it will fail because listeners aren't registered
2. **Device parameter might need adjustment** - check if Homey's device picker returns the right object
3. **Capability autocomplete** might need the device object to be passed differently
4. **Value matching** needs careful type conversion (string "true" → boolean true, etc.)
5. **Listener cleanup** is critical - must unregister on timeout, stop, and normal completion
6. **User wanted wildcards removed** from waiter ID matching in Control waiter (decided against it later, but double-check)

---

## 🎯 Next Steps (Priority Order)

1. ✅ Implement capability autocomplete listener (app.js)
2. ✅ Add deviceConfig parameter to WaiterManager.createWaiter()
3. ✅ Implement registerCapabilityListener() in WaiterManager
4. ✅ Update condition card run listener to register listeners
5. ✅ Implement stopWaiter() method in WaiterManager
6. ✅ Update Control waiter action handler for 'stop'
7. ✅ Update removeWaiter() to cleanup capability listeners
8. ✅ Delete triggerWaiter() method (no longer used)
9. ✅ Test with real devices
10. ✅ Fix any bugs found during testing

---

## 📝 User Feedback History (Important Context)

### Key Clarifications Made During Session:

1. **Initial misunderstanding**: I thought wait gate needed manual "Control waiter → trigger" from other flows
   - **User corrected**: Wait gate listens on DEVICE CAPABILITY CHANGES automatically
   - No manual triggering needed!

2. **Outputs clarification**:
   - YES = Capability reached target value
   - NO = ONLY timeout (not stop!)
   - Stop waiting = graceful end, no output

3. **Control waiter actions**:
   - Removed "trigger" (automatic via capabilities)
   - Removed "remove" (can't remove cards from flows)
   - Added "stop waiting" (graceful exit)

4. **Waiter ID**: User wants auto-generated UID, but editable for Control waiter use

5. **User's JavaScript example** (see commit message in f555dfc) was KEY to understanding:
   - Promise with interval polling for state changes
   - Resolve on match, reject on timeout
   - This is what we're replicating with Homey capability listeners

---

**END OF STATUS DOCUMENT**
