# Boolean Toolbox for Homey

Create advanced, state-aware logic units with multiple formulas and intelligent input handling.

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/Tiwas/HomeyBooleanToolbox)
[![Homey](https://img.shields.io/badge/Homey-5.0+-green.svg)](https://homey.app)

## 🛠️ Interactive Tools

**🎮 [Boolean Logic Emulator](https://tiwas.github.io/HomeyBooleanToolbox/emulator.html)** - Test your expressions interactively with live truth tables!

**🔧 [Formula Builder](https://tiwas.github.io/HomeyBooleanToolbox/formula-builder.html)** - Build and validate formulas with a visual editor!

---

## 🎉 What's New in v1.2.0

### ✨ New Features

#### 1. **Logic Device with Visual Pairing**
NEW device type with a completely redesigned pairing experience:

- 🎨 **Visual setup wizard** - Select devices by zone/room
- 📍 **Browse by location** - Find your devices organized by room
- 🔗 **Direct device linking** - Connect inputs to real devices during pairing
- 🎯 **One-click configuration** - Everything set up before you finish pairing
- 📈 **Dynamic inputs** - Automatically expands to support 2-10 inputs as needed

#### 2. **Dynamic Input Capacity**
Your Logic Device automatically adapts to your needs:

```json
{
  "expression": "A AND B AND C AND D AND E"
}
```

Created device with 2 inputs? No problem! The device will automatically expand to support 5 inputs when you save this formula. 🚀

#### 3. **Auto-Formatting JSON**
Save time with automatic JSON beautification:

- ✨ Paste compressed JSON → Get beautifully formatted output
- 🔄 Edit formulas → Auto-formats on save
- 📝 Cleaner, more readable configuration

### 🔧 Improvements

- Event-driven architecture (removed polling)
- "State changed" trigger with state token
- Better initial value detection
- Shared base classes for maintainability

---

## 📖 Device Types

### Logic Device (NEW! 🎉)

**Perfect for:** Dynamic setups, visual configuration, growing automations

**Features:**
- 🎨 Visual pairing wizard with zone/room selection
- 📈 Dynamic input capacity (2-10 inputs, auto-expands)
- 🔗 Direct device linking during setup
- ✨ JSON auto-formatting
- 🎯 Easier to configure and maintain

**Use when you want:**
- Easy visual setup
- Flexibility to add more inputs later
- Direct device connections
- A cleaner configuration experience

### Logic Units (2-10 inputs)

**Perfect for:** Fixed configurations, simple setups

**Features:**
- 🎯 Pre-defined input count (choose 2, 3, 4... up to 10)
- ⚡ Quick setup for simple cases
- 🔧 Manual JSON configuration

**Use when you want:**
- A simple, fixed number of inputs
- Quick setup for straightforward logic

---

## 🚀 Quick Start

### Option 1: Logic Device (Recommended for most users)

1. **Add Device**
   - Go to **Devices** → **Add Device**
   - Select **Boolean Toolbox** → **Logic Device**

2. **Choose Number of Inputs**
   - Select how many inputs you need (2-10)
   - Don't worry - this will auto-expand if you need more later!

3. **Configure Inputs by Room**
   - Select a room/zone
   - Choose a device from that room
   - Pick which capability to monitor (e.g., onoff, alarm_motion)
   - Repeat for each input
   - Give your device a name

4. **Configure Formulas** (after pairing)
   - Go to device settings
   - Edit the "Formulas" JSON:

```json
[
  {
    "id": "formula_1",
    "name": "Motion & Dark",
    "expression": "A AND B",
    "enabled": true,
    "timeout": 60,
    "firstImpression": false
  }
]
```

5. **Done!** Your Logic Device is ready to use in flows.

### Option 2: Logic Unit (For simple, fixed setups)

1. Go to **Devices** → **Add Device**
2. Select **Boolean Toolbox** → Choose **Logic Unit (X inputs)**
3. Add device and configure via settings

---

## 🎯 Use Cases & Examples

### Example 1: Security System with Visual Setup

**Using Logic Device:**

**During Pairing:**
1. Choose 3 inputs
2. Input A → Living Room → Motion Sensor → alarm_motion
3. Input B → Front Door → Contact Sensor → alarm_contact  
4. Input C → Back Door → Contact Sensor → alarm_contact
5. Name: "Security Monitor"

**After Pairing (Settings):**

```json
[
  {
    "id": "intrusion",
    "name": "Intrusion Detection",
    "expression": "A AND (B OR C)",
    "enabled": true,
    "timeout": 0,
    "firstImpression": false
  }
]
```

**In Flows:**
```
WHEN: Formula [intrusion] changed to TRUE
THEN: Send notification "Motion detected with door open!"
      Turn on all lights
      Start recording
```

### Example 2: Smart Lighting - Growing Complexity

**Start Simple (2 inputs):**

```json
{
  "id": "auto_light",
  "name": "Motion & Dark",
  "expression": "A AND B",
  "enabled": true
}
```

**Later, Expand (5 inputs) - Just edit and save!**

```json
{
  "id": "auto_light",
  "name": "Smart Conditions",
  "expression": "(A OR B) AND C AND NOT D AND NOT E",
  "enabled": true
}
```

The device **automatically expands** from 2 to 5 inputs! 🎉

### Example 3: Multiple Formulas with Isolated States

```json
[
  {
    "id": "day_mode",
    "name": "Daytime Logic",
    "expression": "A AND B AND C",
    "firstImpression": false
  },
  {
    "id": "night_mode",
    "name": "Nighttime Security",
    "expression": "A OR B OR C",
    "firstImpression": true,
    "timeout": 300
  },
  {
    "id": "away_mode",
    "name": "Away Detection",
    "expression": "NOT A AND NOT B",
    "firstImpression": false
  }
]
```

Each formula has **completely independent** input states!

---

## ⚙️ Formula Configuration

### Formula Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | required | Unique identifier |
| `name` | string | required | Display name (shown in flows) |
| `expression` | string | required | Boolean expression (e.g., "A AND B") |
| `enabled` | boolean | `true` | Enable/disable formula |
| `timeout` | number | `0` | Seconds before timeout (0 = infinite) |
| `firstImpression` | boolean | `false` | Lock inputs at first value |

### Input Links

The Logic Device stores device connections in `input_links`:

```json
[
  {
    "input": "a",
    "deviceId": "abc123...",
    "capability": "onoff",
    "deviceName": "Living Room Light"
  },
  {
    "input": "b",
    "deviceId": "def456...",
    "capability": "alarm_motion",
    "deviceName": "Motion Sensor"
  }
]
```

These are automatically created during pairing and stored for reference.

### Supported Operators

| Operator | Symbols | Example | Description |
|----------|---------|---------|-------------|
| AND | `AND`, `&`, `*` | `A AND B` | Both must be true |
| OR | `OR`, `+`, `|` | `A OR B` | At least one must be true |
| XOR | `XOR`, `^`, `!=` | `A XOR B` | Exactly one must be true |
| NOT | `NOT`, `!` | `NOT A` | Inverts the value |

### Expression Examples

```javascript
// Simple
"A AND B"

// Complex grouping
"(A OR B) AND (C OR D)"

// With NOT
"A AND NOT B"

// All 10 inputs
"A AND B AND C AND D AND E AND F AND G AND H AND I AND J"
```

---

## 📊 Dynamic Input Capacity

The Logic Device automatically detects required inputs from:

1. **Formula expressions** - Scans for letters A-J
2. **Input links** - Checks configured device connections

**Example:**

```json
// Device created with 2 inputs

// You save this formula:
{
  "expression": "A AND B AND C AND D AND E AND F"
}

// Device automatically expands to 6 inputs! ✨
```

**Benefits:**
- ✅ Start small, grow as needed
- ✅ No need to recreate devices
- ✅ Handles up to 10 inputs (A-J)
- ✅ Auto-detects from both formulas and links

---

## 🔄 First Impression vs Reactive Mode

### First Impression Mode (`firstImpression: true`)

**How it works:**
- 🔒 Locks each input at its **first received value**
- ⚡ Evaluates when **all required inputs** are set
- 🛡️ Ignores subsequent changes until manual re-evaluation

**Use for:**
- Sequences that should complete in order
- One-time trigger evaluations
- Startup condition checks
- Timeout-sensitive logic

**Example:**
```json
{
  "expression": "A AND B AND C",
  "timeout": 30,
  "firstImpression": true
}
```

### Reactive Mode (`firstImpression: false` - default)

**How it works:**
- 🔄 Inputs can change continuously
- ⚡ Re-evaluates on every input change
- 📊 Real-time monitoring

**Use for:**
- Live sensor monitoring
- Dynamic conditions
- Continuous state tracking

**Example:**
```json
{
  "expression": "A AND B",
  "timeout": 0,
  "firstImpression": false
}
```

---

## 🎨 JSON Auto-Formatting

The Logic Device automatically formats your JSON when you save:

**Before Save:**
```json
[{"id":"f1","name":"Test","expression":"A AND B","enabled":true,"timeout":0,"firstImpression":false}]
```

**After Save:**
```json
[
  {
    "id": "f1",
    "name": "Test",
    "expression": "A AND B",
    "enabled": true,
    "timeout": 0,
    "firstImpression": false
  }
]
```

Works for both `formulas` and `input_links`! ✨

---

## 🎮 Flow Cards

### Triggers (WHEN)

- **Formula result changed to TRUE** - Specific formula became true
- **Formula result changed to FALSE** - Specific formula became false
- **Formula timed out** - Didn't receive all inputs in time
- **State changed** (Logic Device only) - Any state change with state token

### Actions (THEN)

- **Set input value for formula** - Manually set input for specific formula
- **Evaluate formula** - Reset locks and re-evaluate one formula
- **Re-evaluate all formulas** - Reset locks and re-evaluate all

### Conditions (AND)

- **Formula result is...** - Check if true/false
- **Formula has timed out** - Check timeout status

---

## 🛠️ Troubleshooting

### Device Not Expanding Inputs

**Check:**
- ✅ Formula syntax is correct (uses A-J)
- ✅ Input links are properly formatted JSON
- ✅ Settings were saved successfully

**Logs will show:**
```
🔍 Detected max input: E (5 inputs needed)
📈 Detected 5 inputs needed (originally 2). Expanding capacity!
```

### JSON Not Auto-Formatting

**Common causes:**
- ❌ Invalid JSON syntax
- ❌ Missing quotes or commas

**Look for log message:**
```
✨ Auto-formatted formulas JSON
```

### Formula Not Evaluating

**Check:**
- ✅ Formula is `"enabled": true`
- ✅ All required inputs have values
- ✅ Expression syntax is correct
- ✅ Device has enough input capacity

---

## 📚 Technical Details

### Device Comparison

| Feature | Logic Device | Logic Units |
|---------|-------------|-------------|
| Pairing | Visual wizard | Simple add |
| Input Count | Dynamic (2-10) | Fixed (2-10) |
| Setup | Zone-based | Manual JSON |
| Expansion | Automatic | Fixed |
| JSON Format | Auto-format | Manual |
| Best For | Most users | Simple setups |

### System Requirements

- **Homey Pro:** ✅ Fully supported
- **Homey Cloud:** ✅ Fully supported  
- **Minimum Version:** Homey 5.0.0
- **SDK:** 3

---

## 🤝 Support & Contribution

- **Community:** [Homey Forum](https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906)
- **Issues:** [GitHub Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
- **Source:** [GitHub](https://github.com/Tiwas/HomeyBooleanToolbox)
- **Docs:** [GitHub Pages](https://tiwas.github.io/HomeyBooleanToolbox/)

### Author

Created by **Lars Kvanum** ([@Tiwas](https://github.com/Tiwas))

### Support Development

[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/paypalme/tiwasno)

---

## 📝 Changelog

### v1.2.0 (Current)
- ✨ NEW: Logic Device with visual pairing wizard
- ✨ NEW: Dynamic input capacity (auto-expands 2-10)
- ✨ NEW: Zone/room-based device selection during pairing
- ✨ NEW: JSON auto-formatting for formulas and input links
- ✨ NEW: "State changed" trigger with state token
- 🔧 IMPROVED: Event-driven architecture (removed polling)
- 🔧 IMPROVED: Better initial value detection
- 🔧 IMPROVED: Shared base classes for code maintainability
- 📚 IMPROVED: Enhanced documentation

### v1.1.1
- 🌍 Added machine-generated translations
- 📚 Documentation updates

### v1.1.0
- ✨ Isolated input states per formula
- ✨ "First Impression" mode
- ✨ Timeout detection
- ✨ Manual re-evaluation actions
- ⚠️ Breaking: Flow cards changed
- ⚠️ Recommended to create new devices

### v1.0.0
- ✨ Support for 10 inputs
- ✨ Advanced flow cards

### v0.7.0
- 🐛 Major stability improvements

### v0.5.1
- 🎨 Visual improvements

### v0.5.0
- 🎉 Initial release

---

## 📄 License

This app is provided as-is. Use at your own risk.

---

**Boolean Toolbox v1.2.0** - Create smarter automations with advanced boolean logic! 🚀
