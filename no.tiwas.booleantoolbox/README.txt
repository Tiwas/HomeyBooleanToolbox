Smart (Components) Toolkit - Advanced Logic & State Management for Homey

Create advanced, state-aware logic units for your Homey flows. Move beyond simple AND/OR cards and build powerful logic modules based on dynamic boolean expressions.

== DEVICES ==

Logic Unit (2-10 inputs)
  Create complex boolean logic using text-based formulas. Supports multiple formulas per device, timeouts, first-impression mode, and dynamic input linking to any device capability.
  - Define formulas like: (A AND B) OR (NOT C)
  - Link inputs to any device capability
  - Multiple formulas per unit with individual timeouts
  - Error detection and formula validation

Logic Device
  A simpler single-formula logic device for straightforward boolean logic needs.

State Capture Device
  Dynamically capture and restore device states at runtime.
  - Named States: Save snapshots with custom names for scene management
  - Stack Operations: Push/pop for temporary state changes (e.g., doorbell interruptions)
  - Template-based: Define which devices and capabilities to capture
  - Backup/Restore: Export all named states as JSON for backup, import to restore

State Device
  Pre-define device states and apply them via flows. Configure states at setup time rather than capturing them dynamically.

== FLOW CARDS ==

Actions:
  Logic Unit/Device:
    - Evaluate formula / Evaluate all formulas
    - Set input value (single or all via JSON)
    - Clear error state
    - Validate configuration

  State Capture Device:
    - Capture state (save to named slot)
    - Apply captured state
    - Delete captured state
    - Push state (to stack)
    - Pop state (from stack and apply)
    - Peek and apply (view top without removing)
    - Clear stack
    - Export named states (JSON backup)
    - Import named states (restore from JSON)

  State Device:
    - Apply state

  Utilities:
    - Wait (delay execution)
    - Control waiter (pause/resume gates)
    - Evaluate expression (inline logic)

Conditions:
  - Formula result is true/false
  - Formula has timed out
  - Device has error
  - Captured state exists
  - Stack is empty / Stack depth is X
  - Wait until becomes true

Triggers:
  - Formula changed to true/false
  - Formula timed out
  - State changed
  - State captured/applied
  - Configuration alarm changed
  - Error occurred

== DOCUMENTATION ==

Full documentation available at: https://tiwas.github.io/SmartComponentsToolkit/

== SUPPORT ==

Community forum: https://community.homey.app/t/app-boolean-toolbox-create-advanced-logic-with-simple-formulas/143906
Issues: https://github.com/Tiwas/SmartComponentsToolkit/issues
