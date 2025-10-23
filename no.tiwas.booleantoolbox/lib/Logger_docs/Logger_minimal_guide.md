# Minimal User Guide for Logger.js

This is a simplified guide to using `Logger.js` in your app.

## 1. Initialization

In your `driver.js` or `device.js`, initialize the logger in the `onInit()` method.

```
// ... import Logger ...
const Logger = require('../../lib/Logger'); // (Adjust path as needed)

class MyDevice extends Homey.Device {
  async onInit() {
    // 1. Initialize the logger
    // 'this' is the device context
    // 'MyCategory' is the name that will appear in logs, e.g., [MyCategory]
    this.logger = new Logger(this, 'MyCategory');

    // 2. Now you can use it
    this.logger.info('Device has initialized');
  }
}
```

## 2. Basic Usage (Key and Data)

The logger uses a `(message, data)` pattern.

`this.logger.info(message, data);`

The `data` object is used *only* to replace `{variables}` in the message string.

### Example A: With Localization (Recommended)

This is the primary way to use the logger.

**File: `locales/en.json`**
```
{
  "device.ready": "Device '{name}' is ready with {count} inputs."
}
```

**File: `driver.js` or `device.js`**
```
// Send the LOCALIZATION KEY, not the translated text
this.logger.info('device.ready', { name: 'My Device', count: 5 });
```
**Output:**`✅ [MyCategory] Device 'My Device' is ready with 5 inputs.`

**Important:** Do not call `this.homey.__()` yourself. Pass the raw key and the data object directly to the logger. The logger will handle the translation and variable substitution internally.

### Example B: Without Localization (Simple Logging)

This works in the exact same way, thanks to the logger's manual substitution fix. The `data` object replaces `{variables}` in the string.
```
let temp = 21.5;
let sensor = 'Living Room';

this.logger.debug('Current temperature for {sensor} is {temp}°C', { temp: temp, sensor: sensor });
```
**Output:**`🔍 [MyCategory] Current temperature for Living Room is 21.5°C`

**Critical Point:** If your message string does *not* contain `{}` placeholders, the `data` object will be ignored (as it's only used for substitution).
```
// DON'T DO THIS: The data object is ignored
this.logger.debug('Checking status...', { status: 'active' });
// Output: 🔍 [MyCategory] Checking status...

// DO THIS:
this.logger.debug('Checking status... (Status: {status})', { status: 'active' });
// Output: 🔍 [MyCategory] Checking status... (Status: active)
```
### Example C: Without Data

If you don't pass a data object, the message is logged as-is.
```
this.logger.info('Checking for updates...');
```
**Output:**`✅ [MyCategory] Checking for updates...`

## 3. Error Logging

`this.logger.error()` is special and has two modes:

### Mode 1: Message + Error Object (Recommended in `catch`)

Pass a simple string (non-localized) and the actual `Error` object as the second argument.
```
try {
  // ... something fails ...
  throw new Error('Network timeout');
} catch (e) {
  this.logger.error('Something went wrong during init', e);
}
```
**Output (two lines):**
```
    ❌ [MyCategory] Something went wrong during init
    ❌ [MyCategory] [Error: Network timeout ...and full stack trace...]
```
The logger automatically prints the full error object and stack trace for you.

### Mode 2: Message with Substitution

If you do *not* pass an `Error` object as the second argument, `error()` works just like `info()`.
```
// locales/en.json: 
// { "errors.load": "Failed to load {file}." }

this.logger.error('errors.load', { file: 'config.json' });
```
**Output (one line, no stack trace):**`❌ [MyCategory] Failed to load config.json`

## 4. Configuration (loggerConfig.js)

The logger automatically looks for a file named `lib/loggerConfig.js` to control log levels.

**File: `lib/loggerConfig.js` (Optional)**
```
module.exports = {
  // Default for all categories not listed below
  // Options: 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'
  defaultLevel: 'INFO',

  // Specific overrides
  categoryLevels: {
    'MyCategory': 'DEBUG', // Show DEBUG logs for this category
    'AnotherDriver': 'WARN'  // Only show warnings and errors
  }
};
```
**Log Level Priority:**

1. **Code:** `new Logger(this, 'MyCat', { level: 'DEBUG' })` (Overrides everything. **Avoid this!**)
2. **Config `categoryLevels`**: (e.g., `'MyCategory': 'DEBUG'`)
3. **Config `defaultLevel`**: (e.g., `'INFO'`)
4. **Logger Default**: (`'INFO'`)

**Recommendation:** **Do not** pass a level in the constructor. Control all levels using the `loggerConfig.js` file.

## 5. Common Methods

| Method | Default Level | Symbol | Description |
| --- | --- | --- | --- |
| `debug(msg, data)` | DEBUG | 🔍 | For detailed troubleshooting. |
| `info(msg, data)` | INFO | ✅ | For general app flow and important events. |
| `warn(msg, data)` | WARN | ⚠️ | For warnings (e.g., missing data, but app continues). |
| `error(msg, err)` | ERROR | ❌ | For errors that stop an operation. |
| `device(msg, data)` | INFO | 🔌 | (INFO Level) For device-specific events (init, delete). |
| `formula(msg, data)` | DEBUG | 📐 | (DEBUG Level) For logging formula calculations. |
| `input(msg, data)` | DEBUG | 📥 | (DEBUG Level) For incoming data. |
| `output(msg, data)` | DEBUG | 📤 | (DEBUG Level) For outgoing data. |
| `api(msg, data)` | DEBUG | 🌐 | (DEBUG Level) For API calls. |
| `flow(msg, data)` | INFO | 🔄 | (INFO Level) For Flow Card activity. |