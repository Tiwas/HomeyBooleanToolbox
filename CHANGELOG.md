# Changelog

All notable changes to Boolean Toolbox for Homey will be documented in this file.

---

## [1.3.0] - 2025 (Current)

### ✨ New Features
- **Waiter Gates (BETA)** - Reactive flow cards that pause flows and wait for device capability changes
  - Wait until device capability becomes value (condition card with YES/NO paths)
  - Control waiter gate (enable/disable/stop by ID)
  - Auto-generate waiter IDs when not specified
  - Immediate resolution if value already matches
- **Wait action card** - Simple delay without device monitoring (BONUS feature)

### 🌍 Localization
- Complete translation coverage for all flow cards
- 12 languages supported: English, Norwegian, Danish, German, Spanish, French, Italian, Dutch, Swedish, Polish, Finnish, Russian

### 🔧 Improvements
- Reduced logging verbosity (13 statements changed from info to debug)
- Code quality improvements:
  - Translated Norwegian comments to English
  - Removed unnecessary comments
  - Improved code documentation

---

## [1.2.0] - 2024

### ✨ New Features
- **Logic Device** - New device type with completely redesigned pairing experience
  - Visual setup wizard with zone/room selection
  - Browse devices by location
  - Direct device linking during pairing
  - One-click configuration
- **Dynamic Input Capacity** - Devices automatically expand from 2-10 inputs based on formula requirements
- **JSON Auto-Formatting** - Automatic beautification of JSON in settings fields

### 🔧 Improvements
- Event-driven architecture (removed polling)
- "State changed" trigger with state token (Logic Device only)
- Better initial value detection
- Shared base classes for maintainability

### 📚 Documentation
- Enhanced documentation with interactive tools
- Updated examples and use cases

---

## [1.1.1] - 2023

### 🌍 Localization
- Added machine-generated translations for multiple languages

### 📚 Documentation
- Documentation improvements and clarifications

---

## [1.1.0] - 2023

### ✨ New Features
- **Isolated Input States Per Formula** - Each formula maintains its own input states
- **First Impression Mode** - Lock inputs at first received value
- **Timeout Detection** - Formulas can timeout if inputs not received within specified time
- **Manual Re-evaluation Actions** - Force formula re-evaluation via flow cards

### ⚠️ Breaking Changes
- Flow cards structure changed
- **Recommendation:** Create new devices for smooth transition

---

## [1.0.0] - 2023

### ✨ New Features
- Support for up to 10 inputs (A-J)
- Advanced flow cards for formula control
- Multiple formulas per Logic Unit

### 🔧 Improvements
- Enhanced expression parser
- Better error handling

---

## [0.7.0] - 2023

### 🐛 Bug Fixes
- Major stability improvements
- Fixed critical issues affecting reliability

---

## [0.5.1] - 2023

### 🎨 Visual Improvements
- UI/UX enhancements
- Better visual feedback

---

## [0.5.0] - 2023

### 🎉 Initial Release
- Logic Units (2-10 inputs) with boolean logic
- Basic flow cards (triggers, conditions, actions)
- Formula configuration via JSON
- Support for AND, OR, XOR, NOT operators
- Interactive Boolean Logic Emulator tool
- Formula Builder tool

---

## Version Notes

### Deprecated Features
- **Logic Unit X (2, 3, 4...10 inputs)** - Legacy devices with fixed input counts
  - Still functional but no longer recommended
  - Use new Logic Unit or Logic Device instead for dynamic input expansion

### Migration Guide

**From Logic Unit X to Logic Unit/Logic Device:**
1. Create new Logic Unit or Logic Device
2. Copy formula JSON from old device settings
3. Configure input links (Logic Device) or use manual JSON (Logic Unit)
4. Test formulas work as expected
5. Update flows to use new device
6. Remove old device once verified

**From v1.0.0 to v1.1.0:**
- Flow card structure changed - recommended to create new devices
- Input states are now isolated per formula
- Update flows to use new flow card structure

---

## Roadmap (Future Considerations)

- Waiter Gates improvements based on user feedback
- Additional flow card types
- Enhanced error reporting
- Performance optimizations
- More interactive documentation

---

## Support

- **Forum:** [Homey Community](https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906)
- **Issues:** [GitHub Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
- **Source:** [GitHub Repository](https://github.com/Tiwas/HomeyBooleanToolbox)

---

**Note:** This changelog follows [Keep a Changelog](https://keepachangelog.com/) principles.
