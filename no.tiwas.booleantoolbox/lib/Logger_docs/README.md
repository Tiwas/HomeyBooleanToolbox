# Logger Configuration - Files

This is the documentation and example files for the loggerConfig.js function in Boolean Toolbox.

## 🚀 New to Logger.js?

**→ Start with [START-HERE.md](START-HERE.md)** for a guided introduction!

## 📁 Files included

### Gateway

0. **START-HER.md** - 🚀 **START HERE!**
   - Quick introduction (2 min)
   - Guide to which file to read
   - Common tasks solved
   - Checklist for first time

0b. **TLDR.md** - ⚡ **SUPER SHORT!**
   - Just the absolute essentials (1 min)
   - 3 things you MUST know
   - Table of methods
   - Quick fixes

### Documentation

1. **Logger-ViktigeKonsepter.md** - ⚠️ READ THIS FIRST!
   - The most important concepts explained
   - Why NOT to set level in code
   - Prioritization step-by-step
   - Common errors and solutions

2. **Logger-CheatSheet.txt** - 📋 Visual overview
   - Everything on one page in ASCII format
   - Perfect to have open while coding
   - Tables and examples

3. **Logger-QuickReference.md** - ⚡ Quick reference
   - Everything you need on one page
   - Table of log levels
   - Most common commands
   - Quick start guide

4. **Logger_info.md** - 📚 Complete main guide
   - Complete guide for the Logger system
   - Detailed section on loggerConfig.js
   - All logging methods explained with examples
   - Best practices and tips

### Configuration Files

5. **loggerConfig.js** - 📝 Main template (use this!)
   - Complete template with comments
   - Examples of all settings
   - Tips for different scenarios

6. **loggerConfig.dev.js** - 🔧 Development configuration
   - Detailed logging (DEBUG level)
   - Reduced noise from base classes
   - Perfect for development and debugging

7. **loggerConfig.prod.js** - 🚀 Production configuration
   - Minimal logging (WARN level)
   - Only critical messages
   - Ready for deployment

### Examples

8. **example-driver-complete.js** - 💡 Complete example
   - Shows ALL logging methods in practice
   - Real-world driver example
   - Commented for learning

## 🎯 Which file should I use?

```
┌─────────────────────────────────────────────────────────────────┐
│  I WANT TO...                         → USE THIS FILE           │
├─────────────────────────────────────────────────────────────────┤
│  Just the absolute essentials (1 min) → TLDR.md                 │ 
│  Get started now (2 min)              → START-HERE.md           │
│  Understand the system first          → Logger-ViktigeKonsepter │ 
│  See everything on one page quickly   → Logger-CheatSheet       │ 
│  Find a command I forgot              → QuickReference          │ 
│  Learn the system thoroughly          → Logger_info.md          │ 
│  See a complete code example          → example-driver-*.js     │ 
│  Set up my own config                 → loggerConfig.js         │ 
│  Prepare for development              → loggerConfig.dev.js     │ 
│  Prepare for production               → loggerConfig.prod.js    │
└─────────────────────────────────────────────────────────────────┘
```

**Recommended order for new users:**
1. **TLDR.md** or **START-HERE.md** (choose based on time)
2. **Logger-ImportantConcepts.md** (understand the most important parts)
3. **Logger-CheatSheet.txt** (get the overview)
4. **example-driver-complete.js** (see it in practice)
5. **Logger_info.md** (consult when you need details)

**For those in a hurry:**
→ **TLDR.md** (1 min) → code → **Logger-CheatSheet.txt** (when you get stuck)

## 🚀 Getting Started

### Step 1: Place Logger.js
Make sure Logger.js is in `lib/Logger.js`

### Step 2: Initialize in code (WITHOUT level!)
```javascript
// In BaseLogicDriver or other module
const Logger = require('./Logger');

async onInit() {
  // ✅ RECOMMENDED - no level parameter
  this.logger = new Logger(this, 'MyDriver');
  
  // ❌ AVOID - locks the level
  // this.logger = new Logger(this, 'MyDriver', { level: 'DEBUG' });
  
  // Now you can log
  this.logger.info('Driver started');
}
```

### Step 3: Add configuration (optional)
```bash
# Copy the example file to your project
cp loggerConfig.js /path/to/your/project/lib/loggerConfig.js

# Or start with development config
cp loggerConfig.dev.js /path/to/your/project/lib/loggerConfig.js
```

### Step 4: Customize as needed
Edit `lib/loggerConfig.js` and set desired log levels.

## 📝 Usage Examples

### Quick Start (recommended for new users)
```bash
# 1. Read quick reference first
cat Logger-QuickReference.md

# 2. See complete example
cat example-driver-complete.js

# 3. Use in your project
# Copy pattern from the example
```

### Development (heavy logging)
```bash
cp loggerConfig.dev.js lib/loggerConfig.js
```

### Production (minimal logging)
```bash
cp loggerConfig.prod.js lib/loggerConfig.js
```

### Debugging a specific driver
Edit `lib/loggerConfig.js`:
```javascript
module.exports = {
  defaultLevel: 'INFO',
  categoryLevels: {
    'LogicUnit5Driver': 'DEBUG',  // ← Only this one gets DEBUG
    'LogicUnit5Device': 'DEBUG'
  }
};
```

## 📖 All logging methods

| **Method** | **Level** | **Symbol** | **Use for** |
| --- | --- | --- | --- |
| `info()` | INFO | ✅ | Normal operation |
| `debug()` | DEBUG | 🔍 | Detailed debugging |
| `warn()` | WARN | ⚠️ | Warnings |
| `error()` | ERROR | ❌ | Errors |
| `formula()` | DEBUG | 📐 | Formula calculations |
| `input()` | DEBUG | 📥 | Incoming data |
| `output()` | DEBUG | 📤 | Outgoing data |
| `device()` | INFO | 🔌 | Device events |
| `api()` | DEBUG | 🌐 | API calls |
| `flow()` | INFO | 🔄 | Flow cards |

**See Logger-QuickReference.md for the full table and examples!**

## 💡 Important to know

- **Logger works without configuration** - Default level is INFO
- **The config file is optional** - Only add when you need finer control
- **No code changes needed** - Logger.js automatically picks up the file
- **DO NOT set level in code** - Let loggerConfig.js control everything
- **Level in code overrides config** - If you set level in code, loggerConfig.js is ignored
- **Git-friendly** - Use different configs for dev/test/prod

## 🔧 Priority of settings

```
1. Level directly in code (overrides ALL - AVOID THIS!)
    ↓
2. categoryLevels in loggerConfig.js
    ↓
3. defaultLevel in loggerConfig.js
    ↓
4. Hardcoded default: 'INFO'
```

## 📚 Read more

### For beginners:
1. **Start here:** Logger-QuickReference.md (all on one page)
2. **See example:** example-driver-complete.js (complete real-world code)
3. **Deeper understanding:** Logger\_info.md (complete guide)

### For experienced users:
- **Logger_info.md** - Complete API documentation
  - How to initialize Logger in drivers
  - All logging methods with examples
  - loggerConfig.js best practices
  - Troubleshooting and tips
  
- **example-driver-complete.js** - Real driver example
  - All methods in use
  - Timing, formulas, API, flow cards
  - Real-world patterns

## ⚠️ Deployment

Before deploying to production:
```bash
# Use production configuration
cp loggerConfig.prod.js lib/loggerConfig.js

# Or delete configuration to use default values
rm lib/loggerConfig.js
```

---

**Tips:** Start simple without configuration, add it when you need it! 🎯
