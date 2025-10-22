# Logger.js - Quick Reference Guide

## 🚀 Quick Start

```javascript
// 1. Import Logger
const Logger = require('./Logger');

// 2. Initialize (WITHOUT level)
this.logger = new Logger(this, 'MyDriver');

// 3. Use!
this.logger.info('Hello World');
```

## 📊 Log Levels (what shows when)

| Level | debug() | info() | warn() | error() | formula() | input() | output() | api() | device() | flow() |
|------|---------|--------|--------|---------|-----------|---------|----------|-------|----------|--------|
| **DEBUG** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **INFO** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **WARN** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ERROR** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 🎯 Most Common Methods

```javascript
// Normal operation (INFO)
this.logger.info('Driver started');
this.logger.device('Device paired:', name);
this.logger.flow('Flow card triggered');

// Debugging (DEBUG)
this.logger.debug('Current values:', values);
this.logger.formula('A AND B =', result);
this.logger.input('Received:', data);
this.logger.output('Sending:', data);
this.logger.api('GET /api/devices');

// Problems
this.logger.warn('Approaching limit');
this.logger.error('Operation failed', error);

// Timing
this.logger.timeStart('operation');
// ... code ...
this.logger.timeEnd('operation'); // Shows: 42ms
```

## ⚙️ Configuration (lib/loggerConfig.js)

```javascript
module.exports = {
  // Default level for all
  defaultLevel: 'INFO',
  
  // Specific categories
  categoryLevels: {
    'MyDriver': 'DEBUG',        // This one gets DEBUG
    'OtherDriver': 'WARN'       // This one gets WARN
  }
};
```

## 🔄 Priority

```
Directly in code (highest)
    ↓
categoryLevels
    ↓
defaultLevel
    ↓
'INFO' (default)
```

## ✅ Best Practices

```javascript
// ✅ DO THIS - flexible
this.logger = new Logger(this, 'MyDriver');

// ❌ NOT THIS - locks the level
this.logger = new Logger(this, 'MyDriver', { level: 'DEBUG' });
```

## 🎨 Symbols

| Metode | Symbol | Bruk til |
|--------|--------|----------|
| `info()` | ✅ | Normal operation |
| `debug()` | 🔍 | Detailed debugging |
| `warn()` | ⚠️ | Warnings |
| `error()` | ❌ | Errors |
| `formula()` | 📐 | Formula calculations |
| `input()` | 📥 | Incoming data |
| `output()` | 📤 | Outgoing data |
| `device()` | 🔌 | Device events |
| `api()` | 🌐 | API calls |
| `flow()` | 🔄 | Flow cards |
| `timeStart/End()` | ⏱️ | Time measurement |

## 📝 Complete minimal example

```javascript
'use strict';

const Homey = require('homey');
const Logger = require('./Logger');

class MyDriver extends Homey.Driver {
  
  async onInit() {
    // Initialize
    this.logger = new Logger(this, 'MyDriver');
    this.logger.info('Driver initialized');
    
    // Use
    this.logger.debug('Debug info', { value: 123 });
    this.logger.device('Device added');
    this.logger.warn('Warning message');
    this.logger.error('Error occurred', error);
  }
  
  async calculateFormula(a, b) {
    this.logger.input('Formula inputs:', { a, b });
    this.logger.formula('Calculating: A AND B');
    
    const result = a && b;
    
    this.logger.output('Formula result:', result);
    return result;
  }
}

module.exports = MyDriver;
```

## 🔧 Development vs Production

```javascript
// Development (lib/loggerConfig.js)
module.exports = {
  defaultLevel: 'DEBUG'
};

// Production (lib/loggerConfig.js)
module.exports = {
  defaultLevel: 'WARN',
  categoryLevels: {
    'App': 'INFO'  // Only app messages
  }
};
```

## 💡 Pro tips

```javascript
// Avoid spam in loops
this.logger.once('key', 'warn', 'Only shown once');

// Pretty object print
this.logger.dump('State', complexObject);

// Visual separator
this.logger.separator();

// Important message with frame
this.logger.banner('IMPORTANT MESSAGE');

// Time measurement
this.logger.timeStart('operation');
await doSomething();
const ms = this.logger.timeEnd('operation');
```

## 📁 File Structure

```
lib/
├── Logger.js           ← Logger class
├── loggerConfig.js     ← Your configuration (optional)
└── BaseLogicDriver.js  ← Initialize here

drivers/
└── my-driver/
    └── driver.js       ← Uses logger here
```

## 🆘 Troubleshooting

**Problem:** `Cannot read properties of undefined (reading 'info')`

**Solution:** Logger is not initialized
```javascript
// Add in onInit()
this.logger = new Logger(this, 'MyDriver');
```

**Problem:** Not seeing DEBUG messages

**Solution:** Change log level
```javascript
// lib/loggerConfig.js
module.exports = {
  categoryLevels: {
    'MyDriver': 'DEBUG'  // ← Add this
  }
};
```

---

**Full documentation:** See Logger_info.md  
**Complete example:** See example-driver-complete.js
