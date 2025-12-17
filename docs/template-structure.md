# Documentation Site Structure

## Proposed HTML Pages

Create these under `/docs/` directory:

### 1. `devices.html` - Complete Device Guide
**Content:**
- Deep dive into Logic Units vs Logic Devices
  * Both have dynamic inputs (2-10, auto-expand)
  * Logic Device: Single formula, visual pairing
  * Logic Unit: Multiple formulas, JSON config
  * Legacy Logic Unit X: Fixed inputs (deprecated)
- All capabilities explained with examples
- Input configuration patterns
- Visual pairing wizard walkthrough
- JSON structure reference
- Formula isolation explained (no isolation between flows - by design)
- When to use device copies vs multiple formulas
- Migration guide (Logic Unit X → Logic Unit/Device)

### 2. `waiter-gates.html` - Waiter Gates Deep Dive
**Content:**
- What are Waiter Gates (concept explanation)
- When to use vs when NOT to use
- Complete flow card reference
- Real-world examples:
  * Light confirmation (wait for light to turn on)
  * Door security (wait for door to close)
  * Multi-step sequences
- Waiter ID management
- Performance considerations
- Troubleshooting guide
- BETA feedback form

### 3. `getting-started.html` - Setup Tutorial
**Content:**
- Step-by-step first device setup
- Formula basics with interactive examples
- First flow creation
- Common patterns (AND, OR, NOT combinations)
- Testing your setup
- Next steps

### 4. `flow-cards.html` - Complete Flow Card Reference
**Content:**
- All triggers with parameters and examples
- All conditions with usage patterns
- All actions with argument details
- Token reference
- Advanced flow patterns
- Tips and tricks

### 5. `advanced.html` - Advanced Features
**Content:**
- First Impression mode (deep dive with timing diagrams)
- Multiple formulas per device
- Timeout handling strategies
- Input state isolation
- JSON auto-formatting technical details
- Performance optimization
- Complex expression examples

### 6. `troubleshooting.html` - Problem Solving
**Content:**
- Common issues and solutions
- Error message reference
- Debugging techniques
- Log interpretation
- FAQ
- Support channels

### 7. `changelog.html` - Version History
**Content:**
- Complete version history
- Breaking changes
- Migration guides
- Upgrade notes
- Future roadmap

### 8. `api-reference.html` - Developer Reference (optional)
**Content:**
- Device capabilities API
- Flow card arguments
- Token formats
- Expression parser details
- For advanced users/integrators

## Shared Components

### Navigation Template
```html
<nav>
  <a href="/">Home</a>
  <a href="/docs/getting-started.html">Getting Started</a>
  <a href="/docs/devices.html">Devices</a>
  <a href="/docs/waiter-gates.html">Waiter Gates (BETA)</a>
  <a href="/docs/flow-cards.html">Flow Cards</a>
  <a href="/docs/advanced.html">Advanced</a>
  <a href="/docs/troubleshooting.html">Troubleshooting</a>
  <a href="/docs/changelog.html">Changelog</a>
</nav>
```

### Style Guidelines
- Use same dark theme as emulator/formula-builder
- Responsive design (mobile-friendly)
- Code syntax highlighting
- Collapsible sections for long content
- Search functionality (nice to have)
- "Edit on GitHub" links

### Interactive Elements
- Embedded formula tester (iframe to emulator)
- Copy-paste JSON examples
- Expandable code blocks
- Visual diagrams for concepts
- Video tutorials (future)

## Implementation Notes

1. **Keep it simple:** Start with static HTML + CSS + minimal JS
2. **Use existing styling:** Reuse emulator.html styling for consistency
3. **Progressive enhancement:** Core content works without JS
4. **SEO friendly:** Proper meta tags, structured data
5. **Fast loading:** No heavy frameworks, optimized assets

## Content Priorities

**Must have (for v1.3.0 release):**
1. getting-started.html (essential for new users)
2. waiter-gates.html (BETA feature needs explanation)
3. troubleshooting.html (reduce support burden)

**Should have (post-release):**
4. devices.html (comprehensive reference)
5. flow-cards.html (complete card documentation)

**Nice to have (future):**
6. advanced.html
7. changelog.html
8. api-reference.html

## Example: Getting Started Page Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Getting Started - Boolean Toolbox</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav>...</nav>

  <main>
    <h1>Getting Started with Boolean Toolbox</h1>

    <section id="introduction">
      <h2>What You'll Build</h2>
      <p>Your first logic device in under 5 minutes...</p>
    </section>

    <section id="step1">
      <h2>Step 1: Add Your First Device</h2>
      <div class="step-content">
        <div class="instruction">
          <p>Navigate to Devices...</p>
        </div>
        <div class="visual">
          <img src="screenshots/add-device.png" alt="Add device screen">
        </div>
      </div>
    </section>

    <section id="step2">
      <h2>Step 2: Configure Inputs</h2>
      <!-- ... -->
    </section>

    <section id="test">
      <h2>Test Your Setup</h2>
      <div class="interactive">
        <iframe src="../emulator.html" width="100%" height="400"></iframe>
      </div>
    </section>

    <section id="next">
      <h2>What's Next?</h2>
      <ul>
        <li><a href="devices.html">Learn about device types</a></li>
        <li><a href="flow-cards.html">Explore flow cards</a></li>
        <li><a href="advanced.html">Master advanced features</a></li>
      </ul>
    </section>
  </main>

  <footer>...</footer>
</body>
</html>
```

## Current File Structure (v1.8.0)

```
/                           # Root
├── index.html              # Landing page
├── README.md               # Main documentation
├── CHANGELOG.md            # Version history
├── docs/                   # Documentation pages
│   ├── getting-started.html
│   ├── devices.html
│   ├── flow-cards.html
│   ├── state-device.html
│   ├── state-capture-device.html
│   ├── waiter-gates.html
│   └── changelog.html
└── tools/                  # Interactive tools
    ├── emulator.html       # Boolean Logic Emulator
    ├── formula-builder.html # Formula Builder
    ├── boolean-editor.html  # Boolean Editor
    ├── state-editor.html    # State Editor
    └── state-editor-api.html # State Editor (API)
```

## Tools Status

All tools are functional and available at `https://tiwas.github.io/SmartComponentsToolkit/tools/`
