![large|500x350](upload://p5hslvVrgjtVwqB76PnfDcsZAWL.jpeg)

**Boolean Toolbox v1.5.0 is now available in the Homey App Store!**

Replace complex flow networks with powerful logic devices controlled by dynamic formulas. Make your flows cleaner, more readable, and easier to maintain.

<a href="https://tiwas.github.io/HomeyBooleanToolbox/" target="_blank">→ Full Documentation & Tools</a>

---

## -NEWS- State Capture Device (BETA)

**Available on the test branch (v1.7.0)**

A new device type for dynamic state capture with templates, named slots, and push/pop stack operations:

- **Template-based:** Define which devices/capabilities to capture (values read at runtime)
- **Named states:** Store up to 50 named snapshots per device
- **Push/Pop stack:** Temporary state management with up to 20 levels
- **Homey tokens:** Use dynamic state names from flow variables

**Example use case:**
```
WHEN: Doorbell rings
THEN: Push current state to stack
THEN: Set all lights to 100%
THEN: Wait 5 minutes
THEN: Pop state (restore previous)
```

<a href="https://tiwas.github.io/HomeyBooleanToolbox/docs/state-capture-device.html" target="_blank">→ Read State Capture Device Documentation</a>

---

## What's New in v1.5.0

### ⏳ Waiter Gates (BETA)
Reactive flow cards that pause and wait for device states to change:
- **Wait until** device capability becomes value (with YES/NO paths)
- Perfect for verifying that commands actually executed
- Auto-generated waiter IDs for easy management

<a href="https://tiwas.github.io/HomeyBooleanToolbox/docs/waiter-gates.html" target="_blank">→ Read Waiter Gates Documentation</a>

### 🌍 Complete Localization
All flow cards now support 12 languages: English, Norwegian, Danish, German, Spanish, French, Italian, Dutch, Swedish, Polish, Finnish, Russian

### 🔧 Code Quality Improvements
Reduced logging verbosity and improved code documentation

---

## Device Types

**Logic Device** - Recommended for beginners
- Visual pairing wizard with zone/room selection
- Single formula per device
- State changed trigger

**Logic Unit** - For advanced users
- Multiple formulas per device
- Full JSON configuration
- Dynamic input expansion (2-10 inputs)

**Logic Unit X** - Deprecated
- Fixed input counts (2, 3, 4...10)
- Still functional but not recommended for new setups

<a href="https://tiwas.github.io/HomeyBooleanToolbox/docs/devices.html" target="_blank">→ Complete Device Guide</a>

---

## Documentation

- <a href="https://tiwas.github.io/HomeyBooleanToolbox/docs/getting-started.html" target="_blank">**Getting Started Guide**</a> - Create your first logic device in 5 minutes
- <a href="https://tiwas.github.io/HomeyBooleanToolbox/docs/flow-cards.html" target="_blank">**Flow Cards Reference**</a> - Complete guide to all available cards
- <a href="https://tiwas.github.io/HomeyBooleanToolbox/docs/changelog.html" target="_blank">**Changelog**</a> - Full version history

---

## Installation and Links

* **Homey App Store:** <a href="https://homey.app/en-no/app/no.tiwas.booleantoolbox/Boolean-Toolbox/" target="_blank">Install Boolean Toolbox v1.5.0</a>
* **Install test version:** <a href="https://homey.app/a/no.tiwas.booleantoolbox/test/" target="_blank">Install Boolean Toolbox v1.7.0 (test)</a>
* **GitHub Repo (source code):** <a href="https://github.com/tiwas/HomeyBooleanToolbox" target="_blank">https://github.com/tiwas/HomeyBooleanToolbox</a>
* **Online Emulator:** <a href="https://tiwas.github.io/HomeyBooleanToolbox/emulator.html" target="_blank">https://tiwas.github.io/HomeyBooleanToolbox/emulator.html</a>
* **Formula Builder:** <a href="https://tiwas.github.io/HomeyBooleanToolbox/formula-builder.html" target="_blank">https://tiwas.github.io/HomeyBooleanToolbox/formula-builder.html</a>

---

## Feedback & Support

Found a bug or have a suggestion? Please report it:

* **GitHub Issues:** <a href="https://github.com/tiwas/HomeyBooleanToolbox/issues" target="_blank">Report here</a>
* **This Forum Thread:** Reply below!

All feedback is greatly appreciated and helps shape the future of this app.

---

## Support the Project

If you find Boolean Toolbox useful, consider supporting its development:

<a href="https://paypal.me/tiwasno" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-blue.svg" alt="PayPal"></a>

---

**Boolean Toolbox** - Simplify complex logic in your Homey flows ⚡