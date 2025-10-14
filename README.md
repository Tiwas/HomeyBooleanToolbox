# Boolean Toolbox for Homey

Create advanced, state-aware logic units with multiple formulas and intelligent input handling.

[![Version](https://img.shields.io/badge/version-1.1.1-blue.svg)](https://github.com/Tiwas/HomeyBooleanToolbox)
[![Homey](https://img.shields.io/badge/Homey-5.0+-green.svg)](https://homey.app)

## 🎉 What's New in v1.1.0

### 🔥 MAJOR UPDATE - Breaking Changes

**⚠️ Important:** This is a major upgrade with significant changes. While backwards compatibility is maintained, we **strongly recommend** creating new Logic Units and reconfiguring your flows for the best experience.

### ✨ New Features

#### 1. **Isolated Input States Per Formula**
The biggest improvement! Each formula now has its **own separate input state**. 

- ✅ Formula 1's input `A` is completely independent from Formula 2's input `A`
- ✅ No more shared state between formulas
- ✅ More predictable and reliable behavior

**Before v1.1.0:** All formulas on a device shared the same inputs (messy!)  
**After v1.1.0:** Each formula tracks its own inputs (clean!)

#### 2. **"First Impression" Mode** (Default)
Choose how your formulas handle incoming input values:

**First Impression Mode** (`firstImpression: true` - default):
- 🔒 Locks each input at its **first received value**
- ⚡ Evaluates when **all required inputs** have been set
- 🛡️ Ignores subsequent changes until manual re-evaluation
- Perfect for: Sequences, one-time triggers, stable conditions

**Reactive Mode** (`firstImpression: false` or `0`):
- 🔄 Inputs can change continuously
- ⚡ Re-evaluates on every input change
- Perfect for: Real-time monitoring, dynamic conditions

#### 3. **Timeout Detection**
Set a timeout per formula to catch incomplete evaluations:

```json
{
  "id": "f1",
  "name": "Security Check",
  "expression": "A AND B AND C",
  "timeout": 30,
  "firstImpression": true
}
```

- ⏱️ Triggers if not all inputs arrive within the timeout
- 🎯 New flow trigger: "Formula timed out"
- 💡 Useful for detecting failed sequences or missing sensors

#### 4. **Manual Re-evaluation**
New flow actions to reset and re-evaluate:

- **"Evaluate formula"** - Reset locks for one specific formula
- **"Re-evaluate all formulas"** - Reset locks for all formulas on the device

#### 5. **Enhanced Configuration**
- Supports both `true`/`false` and `1`/`0` for boolean values
- Cleaner JSON syntax
- Better error messages

---

## 📖 What is Boolean Toolbox?

Boolean Toolbox lets you create **Logic Units** - virtual devices that evaluate boolean expressions using multiple inputs (A, B, C, etc.). Think of it as programmable logic gates for your smart home!

### Features

- 🔢 **2-10 inputs** per Logic Unit (choose what you need)
- 📝 **Multiple formulas** per device (each with isolated state)
- 🎯 **Boolean operators**: AND (`*`, `&`), OR (`+`, `|`), XOR (`^`, `!=`), NOT (`!`)
- ⏱️ **Timeout detection** for incomplete sequences
- 🔒 **First Impression mode** for one-time triggers
- 🔄 **Reactive mode** for continuous monitoring
- 🎨 **State-aware** - each formula remembers its inputs
- 🚀 **Flow integration** - triggers, actions, and conditions

---

## 🚀 Quick Start

### 1. Add a Logic Unit

1. Go to **Devices** → **Add Device**
2. Search for **Boolean Toolbox**
3. Choose the number of inputs you need (2-10)
4. Add the device to your home

### 2. Configure Your Formulas

Go to the device settings and add formulas in JSON format:

```json
[
  {
    "id": "formula_1",
    "name": "Motion & Dark",
    "expression": "A AND B",
    "enabled": true,
    "timeout": 60,
    "firstImpression": true
  },
  {
    "id": "formula_2", 
    "name": "Any Window Open",
    "expression": "A OR B OR C",
    "enabled": true,
    "timeout": 0,
    "firstImpression": false
  }
]
```

### 3. Use in Flows

**WHEN:**
- "Formula result changed to TRUE"
- "Formula result changed to FALSE"
- "Formula timed out"

**THEN:**
- "Set input value for formula"
- "Evaluate formula"
- "Re-evaluate all formulas"

**AND:**
- "Formula result is..."
- "Formula has timed out"

---

## 🎯 Use Cases & Examples

### Example 1: Security Sequence (First Impression Mode)

**Scenario:** Turn on alarm only if all doors are closed within 30 seconds of arming.

```json
{
  "id": "security",
  "name": "All Doors Closed",
  "expression": "A AND B AND C",
  "timeout": 30,
  "firstImpression": true
}
```

**Flow:**
```
WHEN: User arms alarm
THEN: Set input A to [front door closed] for [security]
      Set input B to [back door closed] for [security]
      Set input C to [garage door closed] for [security]

IF: Formula [security] is TRUE
THEN: Activate alarm
ELSE: Send notification "Close all doors first!"

IF: Formula [security] timed out
THEN: Send notification "Security check failed - not all doors reported"
```

**Why First Impression?** Each door's state is locked at the moment of arming. Even if someone opens a door later, the alarm activation decision is based on the initial state.

### Example 2: Living Room Lights (Reactive Mode)

**Scenario:** Turn on lights if motion detected AND it's dark, turn off when either condition changes.

```json
{
  "id": "auto_light",
  "name": "Motion & Dark",
  "expression": "A AND B",
  "timeout": 0,
  "firstImpression": false
}
```

**Flow:**
```
WHEN: Motion sensor changes
THEN: Set input A to [motion detected] for [auto_light]

WHEN: Lux sensor changes
THEN: Set input B to [is dark] for [auto_light]

WHEN: Formula [auto_light] changed to TRUE
THEN: Turn on living room lights

WHEN: Formula [auto_light] changed to FALSE
THEN: Turn off living room lights
```

**Why Reactive?** The lights should respond immediately to changes in both motion and light level.

### Example 3: Multiple Formulas (Isolated States)

**Scenario:** One device with different logic for day and night.

```json
[
  {
    "id": "day_mode",
    "name": "Daytime Motion",
    "expression": "A AND B AND C",
    "firstImpression": false
  },
  {
    "id": "night_mode",
    "name": "Nighttime Security",
    "expression": "A OR B OR C",
    "firstImpression": true,
    "timeout": 300
  }
]
```

**Important:** Input `A` for `day_mode` is completely separate from input `A` for `night_mode`!

**Flows:**
```
// Daytime: All sensors must be active (reactive)
WHEN: Sensor changes
THEN: Set input A to [sensor state] for [day_mode]

// Nighttime: Any sensor triggers (first impression, 5min timeout)
WHEN: Night mode activated
THEN: Set input A to [sensor state] for [night_mode]
      Set input B to [sensor state] for [night_mode]
      Set input C to [sensor state] for [night_mode]
```

---

## ⚙️ Formula Configuration

### Formula Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | required | Unique identifier for the formula |
| `name` | string | required | Human-readable name (shown in flows) |
| `expression` | string | required | Boolean expression (e.g., "A AND B") |
| `enabled` | boolean | `true` | Enable/disable the formula |
| `timeout` | number | `0` | Seconds before timeout (0 = infinite) |
| `firstImpression` | boolean/number | `true` | Lock inputs at first value (`true`/`1`) or reactive mode (`false`/`0`) |

### Supported Operators

| Operator | Symbols | Example | Description |
|----------|---------|---------|-------------|
| AND | `AND`, `&`, `*` | `A AND B` | Both must be true |
| OR | `OR`, `+`, `\|` | `A OR B` | At least one must be true |
| XOR | `XOR`, `^`, `!=` | `A XOR B` | Exactly one must be true |
| NOT | `NOT`, `!` | `NOT A` | Inverts the value |

### Expression Examples

```javascript
// Simple AND
"A AND B"

// Complex grouping
"(A OR B) AND (C OR D)"

// With NOT
"A AND NOT B"

// Mixed operators
"(A AND B) OR (C AND D) OR E"

// XOR for exclusive conditions
"A XOR B"  // True if only A or only B, not both
```

---

## 🔄 First Impression vs Reactive Mode

### When to Use First Impression Mode

✅ **Sequences** - Actions that should complete in a specific order  
✅ **One-time triggers** - Events that should only evaluate once  
✅ **Stable conditions** - Check state at a specific moment  
✅ **Timeout detection** - Verify all inputs arrive in time

**Examples:**
- Alarm arming sequence
- Startup checks
- Multi-step automation triggers
- Garage door close verification

### When to Use Reactive Mode

✅ **Real-time monitoring** - Continuous evaluation of changing conditions  
✅ **Dynamic responses** - Immediate reaction to any input change  
✅ **Live states** - Current status tracking

**Examples:**
- Automatic lighting based on motion + lux
- HVAC control based on temperature + occupancy
- Alert systems with live sensor data
- Dynamic presence detection

---

## 🔧 Migration Guide (v1.0.0 → v1.1.0)

### ⚠️ Breaking Changes

1. **Flow card changes** - Some flow cards now use device picker instead of autocomplete
2. **Input state isolation** - Formulas no longer share input states
3. **Default behavior** - First Impression mode is now default

### Recommended Migration Path

**Option 1: Fresh Start (Recommended)**

1. Create **new Logic Units** (don't delete old ones yet)
2. Configure formulas with new v1.1.0 features
3. Create **new flows** using the new devices
4. Test thoroughly
5. Disable old flows and devices
6. Delete old Logic Units when confident

**Option 2: Upgrade Existing Devices**

1. Your existing devices should continue working
2. Add `"firstImpression": false` to all formulas to maintain old behavior
3. Review and update flows if device picker behaves differently
4. Test all scenarios

**Migration Example:**

**Old formula (v1.0.0):**
```json
{
  "id": "f1",
  "name": "My Formula",
  "expression": "A AND B",
  "enabled": true
}
```

**New formula (v1.1.0 - maintaining old behavior):**
```json
{
  "id": "f1",
  "name": "My Formula",
  "expression": "A AND B",
  "enabled": true,
  "timeout": 0,
  "firstImpression": false
}
```

**New formula (v1.1.0 - using new features):**
```json
{
  "id": "f1",
  "name": "My Formula",
  "expression": "A AND B",
  "enabled": true,
  "timeout": 30,
  "firstImpression": true
}
```

---

## 🐛 Troubleshooting

### Formula Not Evaluating

**Check:**
- ✅ Formula is `"enabled": true`
- ✅ All required inputs have been set
- ✅ Expression syntax is correct
- ✅ Formula hasn't timed out

**First Impression Mode:**
- Inputs are locked after first value - use "Evaluate formula" action to reset

### Timeout Issues

**If formulas time out unexpectedly:**
- Increase the `timeout` value
- Check that all required inputs are being set
- Use flow triggers to see when inputs arrive
- Set `timeout: 0` for infinite timeout

### Flows Not Working

**v1.1.0 migration:**
- Recreate flow cards that use formulas
- Ensure device is correctly selected in flow card
- Check formula names match exactly

---

## 📚 Technical Details

### Device Types

| Device | Inputs | Use Case |
|--------|--------|----------|
| Logic Unit (2 inputs) | A, B | Simple AND/OR/XOR gates |
| Logic Unit (3 inputs) | A, B, C | Small automation sequences |
| Logic Unit (4 inputs) | A, B, C, D | Multi-sensor conditions |
| Logic Unit (5 inputs) | A, B, C, D, E | Complex room automation |
| Logic Unit (6-10 inputs) | A-J | Advanced multi-device logic |

### Compatibility

- **Homey Pro:** ✅ Fully supported
- **Homey Cloud:** ✅ Fully supported
- **Minimum Homey version:** 5.0.0

---

## 🤝 Support & Contribution

- **Community:** [Homey Community Forum](https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906)
- **Issues:** [GitHub Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
- **Source Code:** [GitHub Repository](https://github.com/Tiwas/HomeyBooleanToolbox)
- **Documentation:** [GitHub Pages](https://tiwas.github.io/HomeyBooleanToolbox/)

### Author

Created by **Lars Kvanum** ([@Tiwas](https://github.com/Tiwas))

### Support Development

If you find this app useful, consider supporting development:

[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/paypalme/tiwasno)

---

## 📝 Changelog

### v1.1.0 (Current)
- ✨ Each formula now has isolated input state
- ✨ New "First Impression" mode (lock inputs at first value)
- ✨ Timeout detection per formula
- ✨ Manual re-evaluation actions
- ✨ Support for 0/1 as boolean values
- 🐛 Fixed device handling in flow cards
- 🐛 Improved error messages
- ⚠️ Breaking: Flow cards changed to device type
- ⚠️ Breaking: Recommended to create new devices

### v1.0.0
- ✨ Support for 10 inputs
- ✨ Advanced flow cards for rapidly changing inputs

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

**Boolean Toolbox v1.1.0** - Create smarter automations with advanced boolean logic! 🚀