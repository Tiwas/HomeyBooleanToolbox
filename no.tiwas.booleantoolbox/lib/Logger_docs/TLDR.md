# TL;DR - Logger.js

## 3 things you MUST know:

### 1. Initialize WITHOUT level
```javascript
✅ this.logger = new Logger(this, 'MyDriver');
❌ this.logger = new Logger(this, 'MyDriver', { level: 'DEBUG' });
```

### 2. Use loggerConfig.js to control levels
```javascript
// lib/loggerConfig.js
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'MyDriver': 'DEBUG'
  }
};
```

### 3. Use the correct method
```javascript
this.logger.info('Normal message');      // Always visible
this.logger.debug('Debug info');         // Only on DEBUG
this.logger.formula('A AND B');          // Only on DEBUG
this.logger.error('Error', error);        // Always visible
```

## Most common methods:

| Method | Shows when | Use for |
|--------|-----------|----------|
| `info()` | INFO, DEBUG | Normal operation |
| `debug()` | DEBUG | Debugging |
| `warn()` | WARN, INFO, DEBUG | Warnings |
| `error()` | Alltid | Errors |
| `formula()` | DEBUG | Formulas |
| `device()` | INFO, DEBUG | Device events |

## If something isn't working:

**Don't see DEBUG:** Set in loggerConfig.js:
```javascript
categoryLevels: { 'MyDriver': 'DEBUG' }
```

**Logger not defined:** Add in onInit():
```javascript
this.logger = new Logger(this, 'MyDriver');
```

**Config ignored:** Remove `{ level: '...' }` from new Logger()

---

**Need more info?** Read [START-HERE.md](START-HERE.md)
