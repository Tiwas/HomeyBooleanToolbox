# Contributing to Boolean Toolbox

Thank you for considering contributing to Boolean Toolbox! 🎉

## 🌍 Translations

Boolean Toolbox currently supports **English** and **Norwegian**. We'd love to have your help translating the app to more languages!

### Where are translations stored?

All translations are in the `app.json` file in the root directory. Look for sections like this:

```json
"name": {
  "en": "Boolean Toolbox",
  "no": "Boolean Toolbox"
}
```

### How to contribute a translation

Choose the method that works best for you:

#### Option 1: Pull Request (for Git users)

1. **Fork** this repository
2. Open `app.json` in your editor
3. Find all text objects with language codes (`"en"`, `"no"`)
4. Add your language code and translation
5. **Submit a Pull Request** with your changes

**Example:**
```json
"name": {
  "en": "Boolean Toolbox",
  "no": "Boolean Toolbox",
  "de": "Boolean Werkzeugkasten"  ← your translation
}
```

#### Option 2: GitHub Issue (easier!)

Don't know Git? No problem!

1. Go to [Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
2. Click **"New Issue"**
3. Title: `Translation: [Your Language]` (e.g., "Translation: German")
4. Paste your translations in the issue
5. I'll add them to the app!

**Template for your issue:**
```
Language: German (de)

App name: Boolean Werkzeugkasten
App description: Erstellen Sie erweiterte, zustandsbewusste Logikeinheiten

Driver names:
- Logic Unit (2 inputs) → Logikeinheit (2 Eingänge)
- Logic Unit (3 inputs) → Logikeinheit (3 Eingänge)
...

Flow cards:
- "Formula result changed to TRUE" → "Formelergebnis wurde WAHR"
...

(Feel free to use the structure that works for you!)
```

#### Option 3: Send directly

Email me your translation file or text:
- **Email:** Create an issue on GitHub or contact via [Homey Community Forum](https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906)
- I'll handle the technical parts!

### What needs to be translated?

You'll find text in these sections of `app.json`:

1. **App information**
   - `name` - App name
   - `description` - App description

2. **Driver names** (for each Logic Unit 2-10)
   - `drivers[].name` - Device type name
   - Example: "Logic Unit (5 inputs)"

3. **Settings**
   - `drivers[].settings[].label` - Setting label
   - `drivers[].settings[].hint` - Help text (can be long!)

4. **Flow cards**
   - `flow.triggers[].title` - Trigger name
   - `flow.triggers[].titleFormatted` - Trigger with placeholders
   - `flow.actions[].title` - Action name
   - `flow.actions[].titleFormatted` - Action with placeholders
   - `flow.conditions[].title` - Condition name
   - `flow.conditions[].titleFormatted` - Condition with placeholders
   - `flow.*.args[].placeholder` - Dropdown placeholder text
   - `flow.actions[].args[].values[].label` - Dropdown values

### Language codes

Use ISO 639-1 codes:
- `en` - English
- `no` - Norwegian
- `de` - German
- `nl` - Dutch
- `fr` - French
- `es` - Spanish
- `it` - Italian
- `sv` - Swedish
- `da` - Danish
- `pl` - Polish
- `ru` - Russian
- `pt` - Portuguese
- `cs` - Czech
- ...and more!

See the [full list here](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).

### Translation tips

- **Keep it concise** - Flow cards appear in small UI spaces
- **Be consistent** - Use the same terms throughout
- **Technical terms** - Some words like "AND", "OR", "XOR" might stay in English (your choice!)
- **Test if possible** - If you have Homey, test that translations look good in the UI
- **Variables** - Keep placeholder syntax like `[[formula]]` unchanged

**Example with placeholder:**
```json
"titleFormatted": {
  "en": "Formula [[formula]] changed to TRUE",
  "de": "Formel [[formula]] wurde WAHR"
}
```

### Need help?

Not sure about something? Just ask!
- **GitHub Issues:** Ask questions in a new issue
- **Community Forum:** [Boolean Toolbox thread](https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906)

---

## 🐛 Bug Reports

Found a bug? Please report it!

1. Go to [Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
2. Click **"New Issue"**
3. Describe:
   - What you expected to happen
   - What actually happened
   - Steps to reproduce
   - Your Homey firmware version
   - Boolean Toolbox version

---

## ✨ Feature Requests

Have an idea for a new feature?

1. Check if it's already requested in [Issues](https://github.com/Tiwas/HomeyBooleanToolbox/issues)
2. If not, create a new issue with:
   - Clear description of the feature
   - Why it would be useful
   - Any examples of how it would work

---

## 💻 Code Contributions

Want to contribute code?

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. Open a **Pull Request**

### Development setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/HomeyBooleanToolbox.git
cd HomeyBooleanToolbox/no.tiwas.booleantoolbox

# Install dependencies
npm install

# Run on your Homey
homey app install
```

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

## 🙏 Thank You!

Every contribution, no matter how small, helps make Boolean Toolbox better for everyone. Thank you for your time and effort! ❤️

---

**Boolean Toolbox** by Lars Kvanum ([@Tiwas](https://github.com/Tiwas))