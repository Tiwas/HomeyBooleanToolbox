# 🔧 Initializing Logger in Drivers - Solution

## The Problem

```
TypeError: Cannot read properties of undefined (reading 'info') at LogicUnit2Driver.onInit (/app/lib/BaseLogicDriver.js:10:17)
```

This happens because `BaseLogicDriver.js` tries to use `this.logger.info()`, but the logger was never initialized.

---

## 📋 Global settings: loggerConfig.js

### What is loggerConfig.js?

Logger.js now supports a **global configuration file** that lets you set default log levels for the entire app in one place. This makes it easy to adjust logging without changing code in every single file.

### Create the configuration file

**Location:** `lib/loggerConfig.js` (same folder as Logger.js)

```javascript
'use strict';

/**
 * Global Logger Configuration
 * * This is the central configuration for all logging in the app.
 * You can set a default level and override for specific categories.
 */

module.exports = {
  // Default log level for all loggers
  // Options: 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'
  defaultLevel: 'INFO',
  
  // Override log level for specific categories
  categoryLevels: {
    'LogicUnit2Driver': 'DEBUG',      // Show all logging for this driver
    'LogicUnit10Device': 'DEBUG',     // Useful for debugging a single device
    'FormulaEngine': 'WARN',          // Only warnings and errors
    'App': 'INFO',                    // Default info logging for app
    'BaseLogicUnit': 'ERROR'          // Only errors for the base class
  },
  
  // Global options (optional)
  options: {
    timestamps: false,  // Add timestamps (Homey already has this)
    colors: false       // Colors in console (not supported by Homey)
  }
};
```

### How it works

**Priority of settings (highest to lowest):**

1. **Directly in code** (options parameter) - **OVERRIDES ALL** ⚠️
2. **categoryLevels** in loggerConfig.js
3. **defaultLevel** in loggerConfig.js
4. **Hardcoded default** ('INFO')

**Important:** If you set `level` directly in code, everything else is ignored!

**Examples:**

```javascript
// 1. Without loggerConfig.js, without level in code:
this.logger = new Logger(this, 'MyDriver');  
// → Uses 'INFO' (hardcoded default)

// 2. With loggerConfig.js (defaultLevel: 'WARN'), without level in code:
this.logger = new Logger(this, 'MyDriver');  
// → Uses 'WARN' (from config.defaultLevel)

// 3. With loggerConfig.js (categoryLevels: { MyDriver: 'DEBUG' }):
this.logger = new Logger(this, 'MyDriver');  
// → Uses 'DEBUG' (from config.categoryLevels - overrides defaultLevel)

// 4. Directly in code (overrides ALL, including config):
this.logger = new Logger(this, 'MyDriver', { level: 'ERROR' });  
// → Uses 'ERROR' (explicitly set - IGNORES loggerConfig.js)
```

**Best practice:**

✅ **RECOMMENDED:** Let Logger use config
```javascript
// No level parameter - flexible via config
this.logger = new Logger(this, 'MyDriver');
```

❌ **AVOID:** Hardcoding level in code
```javascript
// Locks the level to DEBUG - cannot be overridden via config
this.logger = new Logger(this, 'MyDriver', { level: 'DEBUG' });
```

**Exception:** Only use level in code when a module ALWAYS must have a specific level regardless of configuration.

### Practical Examples

#### Example 1: Production (minimal logging)

```javascript
module.exports = {
  defaultLevel: 'WARN',
  categoryLevels: {
    'App': 'INFO'  // Only main app messages
  }
};
```

#### Example 2: Development (heavy logging)

```javascript
module.exports = {
  defaultLevel: 'DEBUG',
  categoryLevels: {
    'BaseLogicDriver': 'INFO',  // Less spam from base classes
    'BaseLogicUnit': 'INFO'
  }
};
```

#### Example 3: Debugging one driver

```javascript
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'LogicUnit5Driver': 'DEBUG',   // Only this one needs debug
    'LogicUnit5Device': 'DEBUG',
    'FormulaEngine': 'DEBUG'       // Show formulas for this device
  }
};
```

#### Example 4: Testing specific functionality

```javascript
module.exports = {
module.exports = {
  defaultLevel: 'WARN',
  categoryLevels: {
    'FormulaEngine': 'DEBUG',  // See all formula calculations
    'FlowCardHandler': 'DEBUG' // See flow activity
  }
};
```

### Structure in the project

```
lib/
├── Logger.js          ← Logger class
├── loggerConfig.js    ← ADD THIS (optional)
├── BaseLogicDriver.js
└── BaseLogicUnit.js
```

### When should you use loggerConfig.js?

✅ **Bruk når:**
- You want to easily adjust log level for the whole app
- You are developing and need DEBUG for specific modules
- You are deploying to production and want to reduce logging
- You are debugging a specific problem

❌ **Not necessary when:**
- The app is finished and working (Logger uses good defaults)
- You only have a few modules
- You are happy with INFO level everywhere

### Usage Tips

- **Start without config** - Logger works fine without it
- **Add when needed** - When you need finer control
- **Comment well** - Explain why you changed the level
- **Use git** - Commit different configs for dev/prod
- **Don't commit DEBUG** - Remember to set back before release

### Example of dynamic config

For advanced users - you can make the config dynamic:

```javascript
'use strict';

// Read environment or Homey setting
const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  defaultLevel: isDevelopment ? 'DEBUG' : 'WARN',
  
  categoryLevels: {
    'App': 'INFO',  // Always show app messages
    ...(isDevelopment && {
      'FormulaEngine': 'DEBUG',
      'LogicUnit': 'DEBUG'
    })
  }
};
```

---

## 📖 All logging methods and when they are shown

Logger.js has many specialized methods for different types of logging. Here is a complete overview.

### Log levels and what is shown

Logger has 5 levels:
- **DEBUG** (0) - Shows all
- **INFO** (1) - Shows info, warn, error
- **WARN** (2) - Shows warn and error
- **ERROR** (3) - Shows only error
- **NONE** (4) - Shows nothing

**Example of setup without level:**
```javascript
// In BaseLogicDriver or other module
const Logger = require('./Logger');

async onInit() {
  // Without level - uses loggerConfig.js or default 'INFO'
  this.logger = new Logger(this, 'MyDriver');
  
  // Now you can log
  this.logger.info('Driver started');
}
```

### Standard logging methods

#### 1. debug() - DEBUG level
Detailed information for debugging. Shown only when log level is DEBUG.

```javascript
// Symbol: 🔍
this.logger.debug('Processing input values');
this.logger.debug('Current state:', { active: true, count: 5 });

// Shown only when log level is DEBUG
```

**When to use:**
- Detailed calculations
- Variable values during runtime
- Program flow information

#### 2. info() - INFO level
Normal operation information. Shown when log level is INFO, DEBUG.

```javascript
// Symbol: ✅
this.logger.info('Driver initialized');
this.logger.info('Device paired:', device.getName());

// Shown when log level is: DEBUG, INFO
```

**When to use:**
- Start/stop of components
- Successful operations
- Important events

#### 3. warn() - WARN level
Warnings about potential problems. Shown when log level is WARN, INFO, DEBUG.

```javascript
// Symbol: ⚠️
this.logger.warn('API rate limit approaching');
this.logger.warn('Invalid input value, using default');

// Shown when log level is: DEBUG, INFO, WARN
```

**When to use:**
- Things that work, but are not optimal
- Deprecated functions
- Near-error situations

#### 4. error() - ERROR level
Errors and exceptions. Always shown (except for NONE).

```javascript
// Symbol: ❌
this.logger.error('Failed to connect to API');
this.logger.error('Invalid formula', error);

// Shown when log level is: DEBUG, INFO, WARN, ERROR
```

**When to use:**
- All errors and exceptions
- Critical problems
- Operations that fail

### Specialized logging methods

#### 5. formula() - Formula calculations (DEBUG)
For logging formula calculations. Shown only at DEBUG level.

```javascript
// Symbol: 📐
this.logger.formula('Evaluating: A AND B');
this.logger.formula('Result:', { input: [true, false], output: false });

// Shown only when log level is: DEBUG
```

**Perfect for:**
- Formula input and output
- Calculated values
- Logical operations

#### 6. input() - Input data (DEBUG)
Logs incoming data. Shown only at DEBUG level.

```javascript
// Symbol: 📥
this.logger.input('Flow card triggered', { value: true });
this.logger.input('Received from API:', response);

// Shown only when log level is: DEBUG
```

**Perfect for:**
- Flow card input
- API responses
- Webhook data

#### 7. output() - Output data (DEBUG)
Logs outgoing data. Shown only at DEBUG level.

```javascript
// Symbol: 📤
this.logger.output('Sending to device:', { state: 'on' });
this.logger.output('Flow card result', result);

// Shown only when log level is: DEBUG
```

**Perfect for:**
- Data sent to devices
- Flow card output
- API requests

#### 8. device() - Device events (INFO)
Logs device-specific events. Shown at INFO level and lower.

```javascript
// Symbol: 🔌
this.logger.device('Device added', device.getName());
this.logger.device('Capability changed:', { capability: 'onoff', value: true });

// Shown when log level is: DEBUG, INFO
```

**Perfect for:**
- Device pairing/unpairing
- Capability changes
- Device status

#### 9. api() - API calls (DEBUG)
Logs API interactions. Shown only at DEBUG level.

```javascript
// Symbol: 🌐
this.logger.api('GET /api/devices');
this.logger.api('API response:', { status: 200, data: {...} });

// Shown only when log level is: DEBUG
```

**Perfect for:**
- HTTP requests
- API responses
- Homey API calls

#### 10. flow() - Flow cards (INFO)
Logs flow card activity. Shown at INFO level and lower.

```javascript
// Symbol: 🔄
this.logger.flow('Flow card "AND" triggered');
this.logger.flow('Condition evaluated:', { result: true });

// Shown when log level is: DEBUG, INFO
```

**Perfect for:**
- Flow card triggers
- Conditions
- Actions

### Advanced methods

#### 11. timeStart() and timeEnd() - Time measurement (DEBUG)
Measure how long operations take.

```javascript
// Symbol: ⏱️
this.logger.timeStart('formula-calculation');

// ... do something ...

const duration = this.logger.timeEnd('formula-calculation');
// Logs: "⏱️ [MyDriver] Timer 'formula-calculation': 45ms"

// Shown only when log level is: DEBUG
```

#### 12. dump() - Object printing (DEBUG)
Pretty-formatted printing of objects.

```javascript
// Symbol: 🔍
const complexObject = {
  devices: [...],
  settings: {...},
  state: {...}
};

this.logger.dump('Current state', complexObject);
// Shows JSON-formatted output

// Shown only when log level is: DEBUG
```

#### 13. once() - Log only once
Logs a message only one time (to avoid spam).

```javascript
// Useful in loops or frequently called functions
for (let i = 0; i < 1000; i++) {
  this.logger.once('loop-warning', 'warn', 'This is only shown once');
}
// Shown only the first time
```

#### 14. separator() - Visual separator (DEBUG)
Creates a visual separator in the log.

```javascript
this.logger.separator();
// Logs: "──────────────────────────────────────────────────"

// Shown only when log level is: DEBUG
```

#### 15. banner() - Important message (INFO)
Creates a frame around important messages.

```javascript
this.logger.banner('SYSTEM STARTED');
// Logs:
// ╔══════════════════╗
//   SYSTEM STARTED  
// ╚══════════════════╝

// Shown when log level is: DEBUG, INFO
```

### Practical example: Complete logging in a driver

```javascript
'use strict';

const Homey = require('homey');
const Logger = require('./Logger');

class LogicUnit5Driver extends Homey.Driver {
  
  async onInit() {
    // Initialize without level - uses loggerConfig.js
    this.logger = new Logger(this, 'LogicUnit5Driver');
    
    // Important startup message
    this.logger.banner('Logic Unit 5 Driver Starting');
    
    // Normal info
    this.logger.info('Initializing driver');
    
    // Device events
    this.logger.device('Loading paired devices');
    
    // Debug information (shown only on DEBUG)
    this.logger.debug('Driver settings:', this.getSettings());
    
    this.logger.info('Driver initialized successfully');
  }
  
  async onPair(session) {
    this.logger.info('Pairing session started');
    
    session.setHandler('list_devices', async () => {
      this.logger.debug('Listing available devices');
      
      const devices = [
        { name: 'Logic Unit 5', data: { id: 'unit-5' } }
      ];
      
      this.logger.debug('Found devices:', devices);
      return devices;
    });
  }
  
  async calculateFormula(inputs) {
    // Start timer
    this.logger.timeStart('formula-calculation');
    
    // Log input
    this.logger.input('Formula inputs:', inputs);
    
    // Log the formula itself
    this.logger.formula('Evaluating: A AND B OR C');
    
    try {
      // Calculation here
      const result = inputs.A && inputs.B || inputs.C;
      
      // Log output
      this.logger.output('Formula result:', result);
      
      // Stop timer
      const duration = this.logger.timeEnd('formula-calculation');
      
      return result;
    } catch (error) {
      this.logger.error('Formula calculation failed', error);
      throw error;
    }
  }
  
  async callAPI() {
    this.logger.api('GET /api/data');
    
    try {
      const response = await fetch('https://api.example.com/data');
      this.logger.api('API response:', { status: response.status });
      
      return await response.json();
    } catch (error) {
      this.logger.error('API call failed', error);
      throw error;
    }
  }
}

module.exports = LogicUnit5Driver;
```

### What is shown at different levels?

With the code above, here is what is shown at different log levels:

#### DEBUG (all is shown):
```
╔════════════════════════════════════╗
  Logic Unit 5 Driver Starting  
╚════════════════════════════════════╝
✅ [LogicUnit5Driver] Initializing driver
🔌 [LogicUnit5Driver] Loading paired devices
🔍 [LogicUnit5Driver] Driver settings: {...}
✅ [LogicUnit5Driver] Driver initialized successfully
✅ [LogicUnit5Driver] Pairing session started
🔍 [LogicUnit5Driver] Listing available devices
🔍 [LogicUnit5Driver] Found devices: [...]
⏱️ [LogicUnit5Driver] Timer started: formula-calculation
📥 [LogicUnit5Driver] Formula inputs: {...}
📐 [LogicUnit5Driver] Evaluating: A AND B OR C
📤 [LogicUnit5Driver] Formula result: true
⏱️ [LogicUnit5Driver] Timer 'formula-calculation': 12ms
🌐 [LogicUnit5Driver] GET /api/data
🌐 [LogicUnit5Driver] API response: { status: 200 }
```

#### INFO (normal operation):
```
╔════════════════════════════════════╗
  Logic Unit 5 Driver Starting  
╚════════════════════════════════════╝
✅ [LogicUnit5Driver] Initializing driver
🔌 [LogicUnit5Driver] Loading paired devices
✅ [LogicUnit5Driver] Driver initialized successfully
✅ [LogicUnit5Driver] Pairing session started
```

#### WARN (only warnings and errors):
```
(nothing from the example above - only if warn() or error() is called)
```

#### ERROR (only errors):
```
(nothing from the example above - only if error() is called)
```

### (nothing from the example above - only if error() is called)

| **Method** | **Level** | **Symbol** | **Shows when** | **Use for** |
| --- | --- | --- | --- | --- |
| `debug()` | DEBUG | 🔍 | DEBUG | Detailed debugging |
| `info()` | INFO | ✅ | DEBUG, INFO | Normal operation |
| `warn()` | WARN | ⚠️ | DEBUG, INFO, WARN | Warnings |
| `error()` | ERROR | ❌ | Always\* | Errors |
| `formula()` | DEBUG | 📐 | DEBUG | Formula calculations |
| `input()` | DEBUG | 📥 | DEBUG | Incoming data |
| `output()` | DEBUG | 📤 | DEBUG | Outgoing data |
| `device()` | INFO | 🔌 | DEBUG, INFO | Device events |
| `api()` | DEBUG | 🌐 | DEBUG | API calls |
| `flow()` | INFO | 🔄 | DEBUG, INFO | Flow cards |
| `timeStart/End()` | DEBUG | ⏱️ | DEBUG | Time measurement |
| `dump()` | DEBUG | 🔍 | DEBUG | Object printing |
| `separator()` | DEBUG | - | DEBUG | Visual separator |
| `banner()` | INFO | - | DEBUG, INFO | Important messages |

\* Except if log level is NONE

---

## ✅ Solution: Initialize in BaseLogicDriver

### Method 1: In BaseLogicDriver.js (RECOMMENDED)

Since all drivers inherit from `BaseLogicDriver`, initialize the logger THERE:

**Open:** `lib/BaseLogicDriver.js`

**Add import at the top:**
```javascript
'use strict';

const Homey = require('homey');
const Logger = require('./Logger');  // ← ADD
```

**In the onInit() method (at the very top):**
```javascript
async onInit() {
  // Initialize logger FIRST
  const driverName = this.constructor.name || 'LogicDriver';
  this.logger = new Logger(this, driverName, { level: 'INFO' });
  this.logger.info('Driver initialized');
  
  // The rest of your onInit code...
}
```

**Complete example:**
```javascript
'use strict';

const Homey = require('homey');
const Logger = require('./Logger');

class BaseLogicDriver extends Homey.Driver {
  
  async onInit() {
    // Initialize logger
    const driverName = this.constructor.name || 'LogicDriver';
    this.logger = new Logger(this, driverName, { level: 'INFO' });
    this.logger.info('Driver initialized');
    
    // The rest of your existing code...
    this.log('Logic Driver has been initialized'); // Can be replaced with logger later
  }
  
  // Rest of the class...
}

module.exports = BaseLogicDriver;
```

---

## Alternative: In each individual driver

If you do NOT want to change BaseLogicDriver, you can initialize in each driver:

**In each driver file (e.g., `drivers/logic-unit-2/driver.js`):**

```javascript
'use strict';

const BaseLogicDriver = require('../../lib/BaseLogicDriver');
const Logger = require('../../lib/Logger');  // ← ADD

module.exports = class LogicUnit2Driver extends BaseLogicDriver {
  
  async onInit() {
    // Initialize logger BEFORE super.onInit()
    this.logger = new Logger(this, 'LogicUnit2', { level: 'INFO' });
    
    // Call parent onInit
    await super.onInit();
    
    // Any driver-specific code here
  }
};
```

**BUT:** This is not recommended because you have to do it in EVERY driver file.

---

## ✅ Recommended Approach

**1. Initialize in BaseLogicDriver (do it ONCE)**

This makes ALL drivers automatically get a logger.

**2. DO NOT set level in code**

Let loggerConfig.js control the levels:

```javascript
// ✅ RECOMMENDED - flexible configuration
const driverName = this.constructor.name || 'LogicDriver';
this.logger = new Logger(this, driverName);  // No { level: '...' }

// ❌ AVOID - locks the level
this.logger = new Logger(this, driverName, { level: 'INFO' });
```

**3. Use dynamic driver name**

```javascript
const driverName = this.constructor.name || 'LogicDriver';
```

This gives you:
- `LogicUnit2Driver` → Logger shows `[LogicUnit2Driver]`
- `LogicUnit3Driver` → Logger shows `[LogicUnit3Driver]`
- etc.

**4. Control levels via loggerConfig.js**

Instead of overriding in code:

```javascript
// lib/loggerConfig.js
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'LogicUnit5Driver': 'DEBUG',   // ← Set level here
    'LogicUnit5Device': 'DEBUG',
    'FormulaEngine': 'DEBUG'
  }
};
```

**5. Only override in code when absolutely necessary**

If a driver ALWAYS must have a specific level (rare):

```javascript
async onInit() {
  // Only in special cases
  this.logger = new Logger(this, 'CriticalDriver', { level: 'ERROR' });
  
  await super.onInit();
}
```

---

## 🔍 Debugging

### Check that Logger.js is in the right place

```
lib/
├── Logger.js          ← MUST be here
├── loggerConfig.js    ← Optional configuration
├── BaseLogicDriver.js
└── BaseLogicUnit.js
```

### Check import-path

From `BaseLogicDriver.js`:
```javascript
const Logger = require('./Logger');  // ← Same folder
```

From `drivers/logic-unit-2/driver.js`:
```javascript
const Logger = require('../../lib/Logger');  // ← Two levels up
```

---

## 📝 Complete example: BaseLogicDriver.js

**BEFORE:**
```javascript
'use strict';

const Homey = require('homey');

class BaseLogicDriver extends Homey.Driver {
  
  async onInit() {
    this.log('Logic Driver has been initialized');
    // ... rest of the code ...
  }
}

module.exports = BaseLogicDriver;
```

**AFTER:**
```javascript
'use strict';

const Homey = require('homey');
const Logger = require('./Logger');

class BaseLogicDriver extends Homey.Driver {
  
  async onInit() {
    // Initialize logger WITHOUT level - uses loggerConfig.js if it exists
    const driverName = this.constructor.name || 'LogicDriver';
    this.logger = new Logger(this, driverName);  // ← No { level: '...' }
    
    this.logger.info('Driver initialized');
    
    // Replace old this.log with this.logger methods:
    // this.log('...')   → this.logger.info('...')
    // this.error('...') → this.logger.error('...')
    
    // The rest of your existing code...
  }
  
  // Other methods...
  async onPair(session) {
    this.logger.info('Pairing session started');
    // ...
  }
  
  async onRepair(session, device) {
    this.logger.info('Repair session started for', device.getName());
    // ...
  }
}

module.exports = BaseLogicDriver;
```

**With loggerConfig.js you can now control all levels centrally:**
```javascript
// lib/loggerConfig.js
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'LogicUnit2Driver': 'DEBUG',   // This one gets DEBUG
    'LogicUnit5Driver': 'DEBUG',   // This one gets DEBUG
    'BaseLogicDriver': 'WARN'      // The base class only gets WARN
  }
};
```

---

## 🚀 Test

After the change, run:

```bash
homey app run -r
```

**Expected output:**
```
✅ [App] Boolean Toolbox initialized
🌐 [App] Homey API initialized
✅ [LogicUnit2Driver] Driver initialized
✅ [LogicUnit3Driver] Driver initialized
✅ [LogicUnit4Driver] Driver initialized
... (all drivers)
✅ [logic-device] Driver initialized
```

**No errors! 🎉**

---

## 💡 Tips

### Convert logging gradually

You don't need to replace all `this.log()` at once. Do it gradually:

1. **First:** Initialize logger
2. **Test:** That no errors occur
3. **Gradually:** Replace `this.log()` with `this.logger.info/debug()`

### Use the right methods for the right situation

```javascript
// Normal operation
this.logger.info('Device initialized');

// Debugging
this.logger.debug('Processing values:', values);

// Formulas
this.logger.formula('A AND B =', result);

// API calls
this.logger.api('GET /devices', response);

// Devices
this.logger.device('Device paired:', device.getName());

// Flow cards
this.logger.flow('Condition evaluated:', result);

// Errors
this.logger.error('Operation failed', error);
```

### Control levels via loggerConfig.js (RECOMMENDED)

**Instead of this (in code):**
```javascript
// ❌ AVOID - locks the level
this.logger = new Logger(this, driverName, { level: 'DEBUG' });
```

**Do this (in config file):**
```javascript
// ✅ RECOMMENDED - flexible configuration
// lib/loggerConfig.js
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'LogicUnit10Driver': 'DEBUG',
    'LogicUnit10Device': 'DEBUG'
  }
};
```

### Switching between production and development

**Create two config files:**

`lib/loggerConfig.dev.js` (development):
```javascript
module.exports = {
  defaultLevel: 'DEBUG',
  categoryLevels: {
    'BaseLogicDriver': 'INFO',  // Reduce noise
    'BaseLogicUnit': 'INFO'
  }
};
```

`lib/loggerConfig.prod.js` (production):
```javascript
module.exports = {
  defaultLevel: 'WARN',
  categoryLevels: {
    'App': 'INFO'
  }
};
```

**Switch at deployment:**
```bash
# Development
cp lib/loggerConfig.dev.js lib/loggerConfig.js

# Production
cp lib.loggerConfig.prod.js lib/loggerConfig.js
```

---

## ✅ Checklist

- [ ] Logger.js is located in `lib/Logger.js`
- [ ] `const Logger = require('./Logger')` added to BaseLogicDriver.js
- [ ] Logger is initialized in `onInit()` in BaseLogicDriver
- [ ] Tested that the app starts without errors
- [ ] All drivers show logger messages
- [ ] (Optional) Created `lib/loggerConfig.js` for finer control

---

**Solution:** Initialize logger in BaseLogicDriver.js's onInit()  
**Configuration:** (Optional) Use loggerConfig.js for centralized control of log levels
**Time:** ~2-5 minutes  
**Difficulty:** Easy
