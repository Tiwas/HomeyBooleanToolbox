# Project Documentation: Homey Boolean Toolbox

## Overview
**Homey Boolean Toolbox** (`no.tiwas.booleantoolbox`) is a Homey application designed to provide advanced boolean logic capabilities for automation flows. It allows users to create virtual devices ("Logic Units" and "Logic Devices") that evaluate complex formulas based on multiple inputs.

## Core Components

### 1. Logic Devices & Units
*   **Logic Device:** A user-friendly device with a visual pairing wizard. Best for simple setups and single formulas. Features dynamic inputs (2-10).
*   **Logic Unit:** Targeted at advanced users. Configured via JSON settings. Supports multiple independent formulas within a single unit.
*   **Legacy Units:** Supports legacy "Logic Unit X" devices (fixed input counts).

### 2. Formula Engine
*   **Location:** `no.tiwas.booleantoolbox/lib/FormulaEvaluator.js`
*   **Capabilities:** Handles boolean operations (`AND`, `OR`, `XOR`, `NOT`) and bitwise equivalents.
*   **Features:**
    *   Dynamic variable parsing (A, B, C...).
    *   Timeout handling (reset to false after X seconds).
    *   "First Impression" mode (locks inputs for sequence logic).

### 3. Waiter Gates (BETA)
*   **Purpose:** Allows flows to pause and wait for specific device state changes.
*   **Mechanism:** Registers listeners and routes flow based on success (YES) or timeout (NO).
*   **Key Files:** `WaiterManager.js`.

## Project Structure
*   `no.tiwas.booleantoolbox/`: Main Homey app source.
    *   `app.js`: Application entry point.
    *   `drivers/`: Device drivers (`logic-device`, `logic-unit`, etc.).
    *   `lib/`: Core logic libraries (`FormulaEvaluator.js`, `Logger.js`).
    *   `locales/`: Translation files.
*   `docs/`: Documentation for the GitHub Pages site.
*   `tests/`: Jest unit tests (`FormulaEvaluator.test.js`).

## Key Technologies
*   **Platform:** Homey (Athom).
*   **Language:** JavaScript (Node.js environment).
*   **Testing:** Jest.

## Constraints (See AI_RULES.md)
*   **Production Status:** Live app.
*   **Modifications:** Only strictly requested changes. No refactoring.
