'use strict';

/**
 * CapturedStateManager - Singleton class for managing captured device states
 *
 * Purpose: Store and retrieve snapshots of device states for later application
 *
 * Features:
 * - Named states (key-value storage)
 * - Stack-based states (push/pop/peek)
 * - Persistent storage via Homey settings
 * - Per-device namespacing
 */

class CapturedStateManager {
    constructor(homey, logger) {
        if (CapturedStateManager.instance) {
            return CapturedStateManager.instance;
        }

        this.homey = homey;
        this.logger = logger;

        // Configuration
        this.STORAGE_PREFIX = 'captured_states_';
        this.MAX_NAMED_STATES = 50;
        this.MAX_STACK_DEPTH = 20;
        this.MAX_STATE_SIZE_BYTES = 100000; // ~100KB per device

        CapturedStateManager.instance = this;
        this.logger.info('🔧 CapturedStateManager initialized');
    }

    /**
     * Get storage key for a device
     */
    _getStorageKey(deviceId) {
        return `${this.STORAGE_PREFIX}${deviceId}`;
    }

    /**
     * Get all data for a device (both named and stack)
     */
    _getDeviceData(deviceId) {
        const key = this._getStorageKey(deviceId);
        const raw = this.homey.settings.get(key);
        if (!raw) {
            return { named: {}, stack: [] };
        }
        try {
            const data = JSON.parse(raw);
            // Ensure structure exists
            return {
                named: data.named || {},
                stack: data.stack || []
            };
        } catch (e) {
            this.logger.error(`Failed to parse stored data for device ${deviceId}`, e);
            return { named: {}, stack: [] };
        }
    }

    /**
     * Save all data for a device
     */
    _saveDeviceData(deviceId, data) {
        const key = this._getStorageKey(deviceId);
        const json = JSON.stringify(data);
        if (json.length > this.MAX_STATE_SIZE_BYTES) {
            throw new Error(`Storage limit exceeded for device ${deviceId}`);
        }
        this.homey.settings.set(key, json);
    }

    /**
     * Read current values from devices based on template
     * @param {object} template - Template with items array
     * @param {object} api - Homey API instance
     * @returns {object} - { values, errors }
     */
    async _readCurrentValues(template, api) {
        const values = {};
        const errors = [];

        for (const item of template.items || []) {
            try {
                const apiDevice = await api.devices.getDevice({ id: item.device_id });
                values[item.device_id] = {};

                for (const capId of item.capabilities || []) {
                    if (apiDevice.capabilitiesObj && apiDevice.capabilitiesObj[capId]) {
                        const value = apiDevice.capabilitiesObj[capId].value;
                        if (value !== undefined && value !== null) {
                            values[item.device_id][capId] = value;
                        }
                    }
                }
            } catch (e) {
                errors.push({
                    device_id: item.device_id,
                    device_name: item.device_name,
                    error: e.message
                });
                this.logger.warn(`Failed to read state for device ${item.device_name}: ${e.message}`);
            }
        }

        return { values, errors };
    }

    // ==================== NAMED STATES ====================

    /**
     * Capture current state to a named slot
     * @param {string} deviceId - State capture device ID
     * @param {string} stateName - Name for this state
     * @param {object} template - Template defining what to capture
     * @param {object} api - Homey API instance
     * @returns {object} - { success, errors, state }
     */
    async captureState(deviceId, stateName, template, api) {
        const data = this._getDeviceData(deviceId);

        // Check limit (only if this is a NEW state)
        if (Object.keys(data.named).length >= this.MAX_NAMED_STATES && !data.named[stateName]) {
            throw new Error(`Maximum ${this.MAX_NAMED_STATES} named states per device reached`);
        }

        // Read current values
        const { values, errors } = await this._readCurrentValues(template, api);

        // Store state
        data.named[stateName] = {
            captured_at: new Date().toISOString(),
            values
        };

        this._saveDeviceData(deviceId, data);

        this.logger.info(`✅ Captured state "${stateName}" for device ${deviceId}`);

        return {
            success: true,
            errors,
            state: data.named[stateName]
        };
    }

    /**
     * Get a specific captured state
     */
    getState(deviceId, stateName) {
        const data = this._getDeviceData(deviceId);
        return data.named[stateName] || null;
    }

    /**
     * Check if a named state exists
     */
    stateExists(deviceId, stateName) {
        const data = this._getDeviceData(deviceId);
        return !!data.named[stateName];
    }

    /**
     * Delete a named state
     */
    deleteState(deviceId, stateName) {
        const data = this._getDeviceData(deviceId);
        if (!data.named[stateName]) {
            return false;
        }
        delete data.named[stateName];
        this._saveDeviceData(deviceId, data);
        this.logger.info(`🗑️  Deleted state "${stateName}" for device ${deviceId}`);
        return true;
    }

    /**
     * List all named state names for a device
     */
    listStateNames(deviceId) {
        const data = this._getDeviceData(deviceId);
        return Object.keys(data.named).map(name => ({
            name,
            captured_at: data.named[name].captured_at
        }));
    }

    // ==================== STACK OPERATIONS ====================

    /**
     * Push current state onto the stack
     * @param {string} deviceId - State capture device ID
     * @param {object} template - Template defining what to capture
     * @param {object} api - Homey API instance
     * @returns {object} - { success, errors, depth }
     */
    async pushState(deviceId, template, api) {
        const data = this._getDeviceData(deviceId);

        // Check stack depth
        if (data.stack.length >= this.MAX_STACK_DEPTH) {
            throw new Error(`Maximum stack depth (${this.MAX_STACK_DEPTH}) reached`);
        }

        // Read current values
        const { values, errors } = await this._readCurrentValues(template, api);

        // Push to front of array (top of stack)
        data.stack.unshift({
            pushed_at: new Date().toISOString(),
            values
        });

        this._saveDeviceData(deviceId, data);

        this.logger.info(`📥 Pushed state onto stack for device ${deviceId} (depth: ${data.stack.length})`);

        return {
            success: true,
            errors,
            depth: data.stack.length
        };
    }

    /**
     * Pop state from stack (removes and returns top)
     * @param {string} deviceId - State capture device ID
     * @returns {object|null} - The popped state or null if empty
     */
    popState(deviceId) {
        const data = this._getDeviceData(deviceId);

        if (data.stack.length === 0) {
            return null;
        }

        // Remove from front (top of stack)
        const state = data.stack.shift();
        this._saveDeviceData(deviceId, data);

        this.logger.info(`📤 Popped state from stack for device ${deviceId} (remaining: ${data.stack.length})`);

        return state;
    }

    /**
     * Peek at top of stack (returns without removing)
     * @param {string} deviceId - State capture device ID
     * @returns {object|null} - The top state or null if empty
     */
    peekState(deviceId) {
        const data = this._getDeviceData(deviceId);

        if (data.stack.length === 0) {
            return null;
        }

        return data.stack[0];
    }

    /**
     * Clear the entire stack
     * @param {string} deviceId - State capture device ID
     * @returns {number} - Number of items cleared
     */
    clearStack(deviceId) {
        const data = this._getDeviceData(deviceId);
        const count = data.stack.length;
        data.stack = [];
        this._saveDeviceData(deviceId, data);
        this.logger.info(`🧹 Cleared stack for device ${deviceId} (${count} items)`);
        return count;
    }

    /**
     * Get current stack depth
     */
    getStackDepth(deviceId) {
        const data = this._getDeviceData(deviceId);
        return data.stack.length;
    }

    /**
     * Check if stack is empty
     */
    isStackEmpty(deviceId) {
        const data = this._getDeviceData(deviceId);
        return data.stack.length === 0;
    }

    // ==================== EXPORT/IMPORT ====================

    /**
     * Export all named states as JSON object
     * @param {string} deviceId - State capture device ID
     * @returns {object} - { states: { name: { captured_at, values }, ... } }
     */
    exportNamedStates(deviceId) {
        const data = this._getDeviceData(deviceId);
        this.logger.info(`📤 Exported ${Object.keys(data.named).length} named states for device ${deviceId}`);
        return {
            states: data.named
        };
    }

    /**
     * Import named states from JSON, overwriting existing states with same name
     * @param {string} deviceId - State capture device ID
     * @param {object} statesData - Object with states property containing named states
     * @returns {object} - { imported, overwritten, errors }
     */
    importNamedStates(deviceId, statesData) {
        if (!statesData || typeof statesData !== 'object') {
            throw new Error('Invalid import data: expected object');
        }

        const states = statesData.states;
        if (!states || typeof states !== 'object') {
            throw new Error('Invalid import data: missing or invalid "states" property');
        }

        const data = this._getDeviceData(deviceId);
        let imported = 0;
        let overwritten = 0;
        const errors = [];

        for (const [stateName, stateData] of Object.entries(states)) {
            try {
                // Validate state structure
                if (!stateData || typeof stateData !== 'object') {
                    errors.push({ name: stateName, error: 'Invalid state data' });
                    continue;
                }

                if (!stateData.values || typeof stateData.values !== 'object') {
                    errors.push({ name: stateName, error: 'Missing or invalid values' });
                    continue;
                }

                // Check if we're overwriting
                if (data.named[stateName]) {
                    overwritten++;
                }

                // Import the state
                data.named[stateName] = {
                    captured_at: stateData.captured_at || new Date().toISOString(),
                    values: stateData.values
                };
                imported++;

            } catch (e) {
                errors.push({ name: stateName, error: e.message });
            }
        }

        // Check total count after import
        if (Object.keys(data.named).length > this.MAX_NAMED_STATES) {
            throw new Error(`Import would exceed maximum ${this.MAX_NAMED_STATES} named states`);
        }

        this._saveDeviceData(deviceId, data);

        this.logger.info(`📥 Imported ${imported} states (${overwritten} overwritten) for device ${deviceId}`);

        return { imported, overwritten, errors };
    }

    // ==================== UTILITY ====================

    /**
     * Clean up all data when device is deleted
     */
    cleanupDevice(deviceId) {
        const key = this._getStorageKey(deviceId);
        this.homey.settings.unset(key);
        this.logger.info(`🧹 Cleaned up stored states for deleted device ${deviceId}`);
    }

    /**
     * Get summary of stored data for a device
     */
    getDeviceSummary(deviceId) {
        const data = this._getDeviceData(deviceId);
        return {
            namedStates: Object.keys(data.named).length,
            stackDepth: data.stack.length,
            maxNamedStates: this.MAX_NAMED_STATES,
            maxStackDepth: this.MAX_STACK_DEPTH
        };
    }
}

// Singleton instance
CapturedStateManager.instance = null;

module.exports = CapturedStateManager;
