# Logger.js - Key Concepts

## ⚠️ MOST IMPORTANT TO REMEMBER

### 1. DO NOT set level in the code!

```javascript
// ❌ WRONG - Locks the level in code
this.logger = new Logger(this, 'MyDriver', { level: 'DEBUG' });
// → Cannot be changed via loggerConfig.js!

// ✅ RIGHT - Let loggerConfig.js control
this.logger = new Logger(this, 'MyDriver');
// → Flexible configuration!
```

**Why?** 
When you set `{ level: 'DEBUG' }` in the code, Logger ignores ALL other settings. You cannot change the level via loggerConfig.js, and must change the code every time you want to adjust logging.

---

## 🎯 Priority Explained

Logger chooses the log level in this order:

```
1. new Logger(this, 'Name', { level: 'DEBUG' })
   ↓ If NOT set in code:

2. loggerConfig.js → categoryLevels: { 'Name': 'DEBUG' }
   ↓ If NOT in categoryLevels:

3. loggerConfig.js → defaultLevel: 'INFO'
   ↓ If loggerConfig.js does not exist:

4. Hardcoded default: 'INFO'
```

### Examples:

```javascript
// WITHOUT loggerConfig.js:
this.logger = new Logger(this, 'MyDriver');
// → Uses 'INFO' (default)

// WITH loggerConfig.js (defaultLevel: 'WARN'):
this.logger = new Logger(this, 'MyDriver');
// → Uses 'WARN' (from config.defaultLevel)

// WITH loggerConfig.js (categoryLevels: { MyDriver: 'DEBUG' }):
this.logger = new Logger(this, 'MyDriver');
// → Uses 'DEBUG' (from config.categoryLevels)

// LEVEL IN CODE (overrides ALL):
this.logger = new Logger(this, 'MyDriver', { level: 'ERROR' });
// → Uses 'ERROR' (ignores loggerConfig.js completely!)
```

---

## 📊 What is shown when?

| Your setting| debug() | info() | warn() | error() | formula() | device() | flow() |
|-------------|---------|--------|--------|---------|-----------|----------|--------|
| DEBUG       | ✅      | ✅     | ✅     | ✅      | ✅        | ✅       | ✅     |
| INFO        | ❌      | ✅     | ✅     | ✅      | ❌        | ✅       | ✅     |
| WARN        | ❌      | ❌     | ✅     | ✅      | ❌        | ❌       | ❌     |
| ERROR       | ❌      | ❌     | ❌     | ✅      | ❌        | ❌       | ❌     |

**Note:** 
- `formula()`, `input()`, `output()`, `api()` are always DEBUG level
- `device()` and `flow()` are always INFO level
- `info()` is INFO level
- `debug()` is DEBUG level
- `warn()` is WARN level
- `error()` is ERROR level

---

## 🔧 Correct use of loggerConfig.js

### Create the file: `lib/loggerConfig.js`

```javascript
'use strict';

module.exports = {
  // Default level for EVERYTHING
  defaultLevel: 'INFO',
  
  // Specific overrides
  categoryLevels: {
    'MyDriver': 'DEBUG',        // This driver gets DEBUG
    'OtherDriver': 'WARN',      // This one only gets WARN
    'BaseLogicDriver': 'ERROR'  // The base class only ERROR
  }
};
```

### How the category name is determined:

```javascript
// The name comes from the second parameter of new Logger():
this.logger = new Logger(this, 'MyDriver');
//                              ^^^^^^^^
//                              This name is used!

// Dynamic name from the class:
const driverName = this.constructor.name;
this.logger = new Logger(this, driverName);
// → For the class LogicUnit5Driver the name becomes 'LogicUnit5Driver'
```

### In loggerConfig.js:

```javascript
categoryLevels: {
  'LogicUnit5Driver': 'DEBUG'  // ← Matches constructor.name
}
```

---

## 💡 Best Practices

### ✅ DO THIS:

```javascript
// 1. Initialize without level
this.logger = new Logger(this, 'MyDriver');

// 2. Use the right method for the situation
this.logger.info('Normal event');
this.logger.debug('Detailed info');
this.logger.formula('Formula calculation');
this.logger.device('Device event');
this.logger.error('Something went wrong', error);

// 3. Control levels via loggerConfig.js
// lib/loggerConfig.js:
module.exports = {
  categoryLevels: {
    'MyDriver': 'DEBUG'
  }
};
```

### ❌ DON'T DO THIS:

```javascript
// 1. Don't hardcode level
this.logger = new Logger(this, 'MyDriver', { level: 'DEBUG' });

// 2. Don't use the wrong method
this.logger.debug('Important message');  // Only shown on DEBUG
this.logger.error('This is just info'); // Misleading

// 3. Don't use this.log()
this.log('Old style');  // Use this.logger.info() instead
```

---

## 🎨 Which method when?

| Situation | Use | Level | Symbol |
|-----------|------|------|--------|
| Driver started | `info()` | INFO | ✅ |
| Device added | `device()` | INFO | 🔌 |
| Flow card run | `flow()` | INFO | 🔄 |
| Debugging values | `debug()` | DEBUG | 🔍 |
| Formula calculation | `formula()` | DEBUG | 📐 |
| Receiving data | `input()` | DEBUG | 📥 |
| Sending data | `output()` | DEBUG | 📤 |
| API call | `api()` | DEBUG | 🌐 |
| Warning | `warn()` | WARN | ⚠️ |
| Error | `error()` | ERROR | ❌ |

---

## 🚀 Quick Start

1. **Initialize in BaseLogicDriver:**
   ```javascript
  const Logger = require('./Logger');

  async onInit() {
    this.logger = new Logger(this, this.constructor.name);
    this.logger.info('Driver initialized');
  }
   ```

2. **Create loggerConfig.js (optional):**
   ```javascript
  // lib/loggerConfig.js
  module.exports = {
    defaultLevel: 'INFO',
    categoryLevels: {}
  };
   ```

3. **Use in code:**
   ```javascript
  this.logger.info('Normal event');
  this.logger.debug('Detailed info');
  this.logger.error('Error', error);
   ```

4. **Adjust as needed:**
   ```javascript
  // Change in loggerConfig.js to see more:
  categoryLevels: {
    'MyDriver': 'DEBUG'
  }
   ```

---

## 🔍 Common Errors

### Error 1: "Cannot read properties of undefined (reading 'info')"

**Problem:** Logger is not initialized

**Solution:**
```javascript
async onInit() {
  this.logger = new Logger(this, 'MyDriver'); // ← Add this
  this.logger.info('OK');
}
```

### Error 2: Not seeing DEBUG messages

**Problem:** Log level is not DEBUG

**Solution:**
```javascript
// In lib/loggerConfig.js:
categoryLevels: {
  'MyDriver': 'DEBUG'  // ← Add this
}
```

### Error 3: loggerConfig.js is ignored

**Problem:** Level set in code

**Solution:**
```javascript
// ❌ Remove this:
this.logger = new Logger(this, 'MyDriver', { level: 'INFO' });

// ✅ Use this:
this.logger = new Logger(this, 'MyDriver');
```

---

## 📚 Further Reading

- **Logger-CheatSheet.txt** - All on one page
- **Logger-QuickReference.md** - Quick reference
- **example-driver-complete.js** - Complete example
- **Logger_info.md** - Full documentation
