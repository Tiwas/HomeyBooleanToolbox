"use strict";

const BaseLogicUnit = require("../../lib/BaseLogicUnit");

module.exports = class LogicUnitDevice extends BaseLogicUnit {
  /**
   * Override onSettings to detect required inputs from formulas
   * and dynamically expand capacity before calling super.onSettings()
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.logger.info("settings.changed_dynamic", {
      keys: changedKeys.join(", "),
    });

    // CRITICAL: Detect inputs from formulas BEFORE calling super.onSettings()
    if (changedKeys.includes("formulas")) {
      try {
        const formulas = JSON.parse(newSettings.formulas);

        if (Array.isArray(formulas)) {
          // Get all used variables from all formulas
          const usedVars = this.getUsedVariables(formulas);

          if (usedVars.length > 0) {
            // Get the highest variable (e.g., if 'E' is used, maxVar = 'E')
            const maxVar = usedVars[usedVars.length - 1];
            // Convert letter to number (A=1, B=2, ..., J=10)
            const detectedInputs = maxVar.charCodeAt(0) - 64; // 'A' = 65, so A=1

            // Expand capacity if needed
            if (detectedInputs > this.numInputs) {
              this.logger.info("settings.expanding_capacity", {
                from: this.numInputs,
                to: detectedInputs,
                reason: `Formula uses variable ${maxVar}`,
              });

              this.numInputs = detectedInputs;
              this.availableInputs = this.getAvailableInputIds();

              this.logger.debug("settings.expanded", {
                numInputs: this.numInputs,
                availableInputs: this.availableInputs.join(", "),
              });
            }
          }
        }
      } catch (e) {
        this.logger.error("settings.expansion_failed", e);
        // Continue anyway, let super.onSettings() handle the error
      }
    }

    // CRITICAL: Call super.onSettings() to preserve all existing logic:
    // - Stop timeout checks
    // - Re-initialize formulas
    // - Validate expressions
    // - Re-evaluate all formulas
    // - Restart timeout checks
    // - Auto-formatting
    await super.onSettings({ oldSettings, newSettings, changedKeys });
  }

  /**
   * Extract all used variables from formulas (sorted and unique)
   * @param {Array} formulas - Array of formula objects
   * @returns {Array} - Sorted array of unique uppercase letters used (e.g., ['A', 'B', 'E'])
   */
  getUsedVariables(formulas) {
    if (!Array.isArray(formulas)) {
      return [];
    }

    const usedVars = new Set();

    formulas.forEach((formula) => {
      if (
        formula &&
        formula.expression &&
        typeof formula.expression === "string"
      ) {
        const expression = formula.expression.toUpperCase();

        // Find all single uppercase letters A-J
        const matches = expression.match(/\b[A-J]\b/g);

        if (matches) {
          matches.forEach((letter) => usedVars.add(letter));
        }
      }
    });

    // Convert Set to sorted Array
    return Array.from(usedVars).sort();
  }

  /**
   * Validate if an input is used in any formula
   * Logs a warning if setting an unused input
   * @param {string} inputId - Input ID (lowercase, e.g., 'a', 'b')
   * @returns {boolean} - True if input is used in at least one formula
   */
  validateInput(inputId) {
    if (!inputId || typeof inputId !== "string") {
      return false;
    }

    const inputUpper = inputId.toUpperCase();
    const usedVars = this.getUsedVariables(this.formulas || []);
    const isUsed = usedVars.includes(inputUpper);

    if (!isUsed) {
      this.logger.warn("input.unused_warning", {
        input: inputUpper,
        usedInputs: usedVars.join(", ") || "none",
      });
    }

    return isUsed;
  }

  /**
   * Override getInputOptions to show only inputs that are actually used in formulas
   * This makes autocomplete smarter - no clutter with unused inputs
   *
   * If a specific formula is provided in args (for set_input_value_lu card),
   * only show inputs used in THAT formula.
   * Otherwise, show all inputs used in ANY formula (for set_input_lu card).
   *
   * @param {Object} args - Optional args from flow card (may contain formula)
   * @returns {Array} - Array of input options for autocomplete
   */
  getInputOptions(args) {
    let formulasToCheck = this.formulas || [];

    // If a specific formula is selected, show only its inputs
    if (args && args.formula && args.formula.id) {
      const selectedFormula = this.formulas.find(
        (f) => f.id === args.formula.id,
      );
      if (selectedFormula) {
        formulasToCheck = [selectedFormula];
        this.logger.debug("input_options.context_specific", {
          formula: selectedFormula.name,
          expression: selectedFormula.expression,
        });
      }
    }

    const usedVars = this.getUsedVariables(formulasToCheck);

    // If no formulas yet or no variables used, fall back to showing all available inputs
    if (usedVars.length === 0) {
      return super.getInputOptions();
    }

    // Return only the used variables
    return usedVars.map((letter) => ({
      id: letter.toLowerCase(), // Use lowercase 'a', 'b' as ID
      name: letter, // Display uppercase 'A', 'B'
    }));
  }

  /**
   * Override setInputForFormula to add validation warning
   * Inherits the actual logic from BaseLogicUnit
   */
  async setInputForFormula(formulaId, inputId, value) {
    // Validate input (logs warning if unused)
    this.validateInput(inputId);

    // Call parent implementation
    return super.setInputForFormula(formulaId, inputId, value);
  }

  // All other methods inherited from BaseLogicUnit
};