# Boolean Toolbox for Homey

Advanced boolean logic for your Homey automations. Create smart devices that react to multiple inputs with customizable formulas.

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/Tiwas/HomeyBooleanToolbox)
[![Homey](https://img.shields.io/badge/Homey-5.0+-green.svg)](https://homey.app)

---

## 🛠️ Interactive Tools

Test and build your logic before deploying:

- **[Boolean Logic Emulator](https://tiwas.github.io/HomeyBooleanToolbox/emulator.html)** - Test expressions with live truth tables
- **[Formula Builder](https://tiwas.github.io/HomeyBooleanToolbox/formula-builder.html)** - Visual formula editor with validation

---

## 📦 What's Inside

### Logic Units & Logic Devices

Two flavors of boolean logic devices - choose what fits your needs:

| Feature | Logic Device | Logic Unit |
|---------|-------------|------------|
| **Setup** | Visual pairing wizard | Quick add |
| **Inputs** | Dynamic (2-10, auto-expands) | Dynamic (2-10, auto-expands) |
| **Configuration** | Zone/room selection | Manual JSON |
| **Formulas** | Single formula | Multiple formulas |
| **Best for** | Simple setups, beginners | Advanced users, multi-formula needs |

**Capabilities:**
- `alarm_generic` - Formula result (true/false)
- `onoff` - Enable/disable device

**Important:** Within a formula, there is no isolation between flows. This is by design to allow formulas to work across flows. If you need isolated formulas that can be used in multiple places within the same flow, create multiple copies of the device with different names.

*Note: Logic Unit X (2, 3, 4...10 inputs) are legacy devices with fixed input counts - use the new Logic Unit or Logic Device instead.*

[📚 Read detailed guide →](https://tiwas.github.io/HomeyBooleanToolbox/docs/devices.html)

---

### ⏳ Waiter Gates (BETA)

**⚠️ Experimental feature** - I'm still exploring if these provide real value. Feedback welcome!

Waiter Gates let your flows pause and wait for device states to change, with YES/NO outputs:

**Flow Cards:**
- **Wait until device capability becomes value** *(condition)* - Waits for a device capability to reach a target value
  - ✅ YES path: Value matches (or already matched)
  - ❌ NO path: Timeout expired
- **Control waiter gate** *(action)* - Enable/disable/stop a waiter by ID
- **Wait** *(action)* - Simple delay (BONUS: basic pause without device monitoring)

**Example use case:**
```
WHEN motion detected
AND wait until [Living Room Light].onoff becomes true (timeout: 5 minutes)
THEN announce "Light turned on!"
ELSE notify "Light didn't turn on - check bulb?"
```

**How it works:**
1. Flow hits the wait condition and checks current value
2. If already matches → Continue immediately (YES path)
3. If not → Registers listener and waits for change
4. On match → YES path | On timeout → NO path

**Known limitations:**
- IDs must be unique across flows (or leave empty for auto-generation)
- Active waiters consume memory
- Still figuring out real-world usefulness 🤔

[📚 Read waiter gates guide →](https://tiwas.github.io/HomeyBooleanToolbox/docs/waiter-gates.html)

---

## 🚀 Quick Start

### 1. Add a Device

**Logic Device (recommended for beginners):**
- Go to **Devices** → **Add Device** → **Boolean Toolbox** → **Logic Device**
- Choose inputs (2-10) - expands automatically if needed
- Configure inputs by selecting room → device → capability
- Save and configure formula in device settings (single formula)

**Logic Unit (for advanced users):**
- Go to **Devices** → **Add Device** → **Boolean Toolbox** → **Logic Unit**
- Configure via settings JSON (supports multiple formulas)
- Inputs expand automatically based on formula requirements

*Legacy: Logic Unit X (2, 3, 4...10 inputs) have fixed input counts - use the new devices instead.*

### 2. Write Formulas

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

**Operators:** `AND`, `OR`, `XOR`, `NOT` (plus `&`, `|`, `^`, `!`)

### 3. Use in Flows

```
WHEN: Formula [motion_detected] changed to TRUE
THEN: Turn on lights
```

[📚 Read complete setup guide →](https://tiwas.github.io/HomeyBooleanToolbox/docs/getting-started.html)

---

## 🎮 Flow Cards

### Triggers (WHEN)
- Formula result changed to TRUE/FALSE
- Formula timed out
- State changed *(Logic Device only)*

### Conditions (AND)
- Formula result is...
- Formula has timed out
- **Wait until device capability becomes value** *(Waiter Gates - BETA)*

### Actions (THEN)
- Set input value for formula
- Evaluate formula / Re-evaluate all
- **Control waiter gate** *(Waiter Gates - BETA)*
- **Wait** *(Simple delay - BONUS)*

[📚 See all flow cards →](https://tiwas.github.io/HomeyBooleanToolbox/docs/flow-cards.html)

---

## 💡 Key Features

### Dynamic Input Expansion
Start with 2 inputs, grow to 10 automatically:
```json
// Created with 2 inputs, saved with:
{"expression": "A AND B AND C AND D"}
// Device auto-expands to 4 inputs! ✨
```

### First Impression Mode
Lock inputs at first value for sequence-based logic:
```json
{"firstImpression": true, "timeout": 30}
```

### Multiple Independent Formulas (Logic Unit only)
Each formula maintains its own input states:
```json
[
  {"id": "day_mode", "expression": "A AND B"},
  {"id": "night_mode", "expression": "A OR B"}
]
```

**Note:** Formulas are not isolated between flows - they can be triggered from any flow. To use the same logic in multiple places within one flow, create separate device copies.

### JSON Auto-Formatting
Paste ugly JSON, get beautiful formatting on save. Works in all settings fields.

[📚 Read advanced features →](https://tiwas.github.io/HomeyBooleanToolbox/docs/advanced.html)

---

## 🤝 Support & Community

- **Forum:** [Homey Community](https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906)
- **Issues:** [GitHub Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
- **Source:** [GitHub Repository](https://github.com/Tiwas/HomeyBooleanToolbox)
- **Changelog:** [Version History](https://tiwas.github.io/HomeyBooleanToolbox/docs/changelog.html)

### Support Development

If this app makes your life easier, consider buying me a coffee ☕

[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/paypalme/tiwasno)

---

## 📄 License & Credits

Created by **Lars Kvanum** ([@Tiwas](https://github.com/Tiwas))

This app is provided as-is. Use at your own risk.

---

**Boolean Toolbox** - Smarter automations with advanced boolean logic 🚀
