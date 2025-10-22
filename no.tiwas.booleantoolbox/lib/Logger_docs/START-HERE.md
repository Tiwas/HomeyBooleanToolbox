# 🚀 START HERE - Logger.js Documentation

Welcome to the Logger.js documentation for Boolean Toolbox!

## ⚡ Quick Start (2 minutes)

```javascript
// 1. Import
const Logger = require('./Logger');

// 2. Initialize (IMPORTANT: no { level: '...' })
this.logger = new Logger(this, 'MyDriver');

// 3. Use!
this.logger.info('Hello World');
this.logger.debug('Debug info', { data: 123 });
this.logger.error('Oops', error);

## ⚠️ MOST IMPORTANT TO KNOW

**NEVER do this:**
```javascript
❌ this.logger = new Logger(this, 'Name', { level: 'DEBUG' });
```

**ALWAYS do this:**
```javascript
✅ this.logger = new Logger(this, 'Name');
```

**Why?** Level in code overrides EVERYTHING and makes loggerConfig.js useless!

## 📚 Which file should I read?

### Completely new? Start here:
1. **Logger-ImportantConcepts.md** (10 min) ⚠️ **START HERE!**
   - The most important things you MUST know
   - Why not to hardcode level
   - Common errors

### Need a reference?
2. **Logger-CheatSheet.txt** (5 min)
   - Everything on one page
   - Keep open while coding

3. **Logger-QuickReference.md** (8 min)
   - Table of all methods
   - When is what shown

### Want to learn thoroughly?
4. **Logger_info.md** (20 min)
   - Complete guide
   - All details
   - Best practices

### Need a code example?
5. **example-driver-complete.js** (15 min)
   - Complete driver
   - All methods in use
   - Real-world patterns

## 🎯 Common Tasks

### "I just want to get started"
→ Read **Logger-ImportantConcepts.md** + copy code from **example-driver-complete.js**

### "I need to turn on DEBUG for one driver"
→ Create `lib/loggerConfig.js`:
```javascript
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'MyDriver': 'DEBUG'
  }
};
```

### "I have an error and don't know why"
→ Check **Logger-ImportantConcepts.md** → section "Common errors"

### "I forgot the syntax for a command"
→ Open **Logger-CheatSheet.txt** or **Logger-QuickReference.md**

### "I want to understand everything in detail"
→ Read **Logger_info.md** from top to bottom

## 📊 Quick Reference: What is shown when?

| Setting | debug() | info() | warn() | error() | formula() | device() |
|---------|---------|--------|--------|---------|-----------|----------|
| DEBUG   | ✅      | ✅     | ✅     | ✅      | ✅        | ✅       |
| INFO    | ❌      | ✅     | ✅     | ✅      | ❌        | ✅       |
| WARN    | ❌      | ❌     | ✅     | ✅      | ❌        | ❌       |
| ERROR   | ❌      | ❌     | ❌     | ✅      | ❌        | ❌       |

## 🎨 Most Important Methods

```javascript
// Normal operation
this.logger.info('Driver started');
this.logger.device('Device paired');
this.logger.flow('Flow card triggered');

// Debugging (only on DEBUG)
this.logger.debug('Values:', data);
this.logger.formula('A AND B');
this.logger.input('Received:', input);
this.logger.output('Sending:', output);

// Problems
this.logger.warn('Warning');
this.logger.error('Error', error);
```

## 📁 All files in the package

### Documentation (read in this order):
1. ⚠️ **Logger-ImportantConcepts.md** - START HERE!
2. 📋 **Logger-CheatSheet.txt** - All on one page
3. ⚡ **Logger-QuickReference.md** - Quick reference
4. 📚 **Logger_info.md** - Full guide

### Configuration (choose one):
5. 📝 **loggerConfig.js** - Standard template
6. 🔧 **loggerConfig.dev.js** - Development (DEBUG)
7. 🚀 **loggerConfig.prod.js** - Production (WARN)

### Examples:
8. 💡 **example-driver-complete.js** - Complete driver

### This file:
9. 🚀 **START-HERE.md** - You are here!

## 🔗 Next Step

**Recommended:**
```
START-HERE.md (you are here)
    ↓
Logger-ImportantConcepts.md (10 min)
    ↓
Logger-CheatSheet.txt (5 min, keep open)
    ↓
example-driver-complete.js (15 min, copy pattern)
    ↓
Start coding! 🎉
```

**If you want to learn everything:**
```
Logger-ImportantConcepts.md
    ↓
Logger_info.md
    ↓
example-driver-complete.js
    ↓
Logger-QuickReference.md (for later use)
```

## ❓ Having problems?

### "Cannot read properties of undefined"
→ Logger not initialized. Read Logger-ImportantConcepts.md → "Common errors"

### "Not seeing DEBUG messages"
→ Wrong log level. Read Logger-ImportantConcepts.md → "Priority"

### "loggerConfig.js is ignored"
→ Level in code. Read Logger-ImportantConcepts.md → "MOST IMPORTANT TO KNOW"

## 🎓 Pro tips

1. **Read Logger-ImportantConcepts.md first** - save yourself a headache later
2. **Keep Logger-CheatSheet.txt open** while coding
3. **Use the right method** for the right situation (see QuickReference)
4. **Don't hardcode level** - use loggerConfig.js
5. **Start with INFO** - switch to DEBUG only when necessary

## ✅ First Time Checklist

- [ ] Read Logger-ImportantConcepts.md (10 min)
- [ ] Look at Logger-CheatSheet.txt (5 min)
- [ ] Study example-driver-complete.js (15 min)
- [ ] Create lib/loggerConfig.js in your project
- [ ] Initialize logger in BaseLogicDriver (WITHOUT level!)
- [ ] Test that it works
- [ ] Bookmark Logger-QuickReference.md for later

## 🚀 Ready to start?

→ **Go to Logger-ImportantConcepts.md now!**

---

*Good luck with logging! 🎉*
