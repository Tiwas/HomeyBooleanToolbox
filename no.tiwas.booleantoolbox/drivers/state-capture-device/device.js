'use strict';

const Homey = require('homey');

class StateCaptureDevice extends Homey.Device {

    async onInit() {
        this.debug('StateCaptureDevice has been initialized');

        // Get state manager from app
        this.stateManager = this.homey.app.capturedStateManager;

        this.registerCapabilityListener('onoff', async (value) => {
            this.debug('Device toggled:', value);
            // onoff is just a visual indicator, no action on toggle
        });
    }

    debug(...args) {
        if (this.homey.settings.get('debug_mode')) {
            this.log('[DEBUG]', ...args);
        }
    }

    getDeviceId() {
        return this.getData().id;
    }

    getTemplate() {
        const json = this.getSetting('template_json');
        if (!json) return { items: [] };
        try {
            return JSON.parse(json);
        } catch (e) {
            this.error('Invalid template JSON:', e);
            return { items: [] };
        }
    }

    /**
     * Apply values to devices based on template
     * @param {object} values - Object with device_id -> { capability: value }
     * @returns {object} - { success, errors }
     */
    async _applyValues(values) {
        const api = this.homey.app.api;
        const template = this.getTemplate();
        const errors = [];
        const logErrors = this.getSetting('log_errors');

        for (const item of template.items || []) {
            const deviceValues = values[item.device_id];
            if (!deviceValues) continue;

            try {
                const apiDevice = await api.devices.getDevice({ id: item.device_id });

                for (const capId of item.capabilities || []) {
                    if (deviceValues[capId] !== undefined) {
                        try {
                            // Check if capability exists and is setable
                            if (apiDevice.capabilitiesObj &&
                                apiDevice.capabilitiesObj[capId] &&
                                apiDevice.capabilitiesObj[capId].setable) {
                                await apiDevice.setCapabilityValue(capId, deviceValues[capId]);
                                this.debug(`Set ${item.device_name}.${capId} = ${deviceValues[capId]}`);
                            } else {
                                this.debug(`Skipping ${item.device_name}.${capId}: Not setable or doesn't exist`);
                            }
                        } catch (capError) {
                            const errMessage = capError.message || 'Unknown error';
                            errors.push({
                                device: item.device_name,
                                capability: capId,
                                error: errMessage
                            });
                            if (logErrors) {
                                this.error(`Failed to set ${item.device_name}.${capId}: ${errMessage}`);
                            }
                        }
                    }
                }

                // Small delay between devices
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (e) {
                errors.push({
                    device: item.device_name,
                    device_id: item.device_id,
                    error: e.message
                });
                if (logErrors) {
                    this.error(`Failed to access device ${item.device_name}: ${e.message}`);
                }
            }
        }

        return { success: errors.length === 0, errors };
    }

    // ==================== FLOW ACTIONS: NAMED STATES ====================

    /**
     * Flow Action: Capture current state to named slot
     */
    async onFlowCaptureState(args) {
        const stateName = args.state_name;

        if (!stateName || stateName.trim() === '') {
            throw new Error(this.homey.__('errors.state_name_required') || 'State name is required');
        }

        const template = this.getTemplate();
        const api = this.homey.app.api;

        try {
            const result = await this.stateManager.captureState(
                this.getDeviceId(),
                stateName.trim(),
                template,
                api
            );

            // Trigger success flow
            await this.homey.flow.getTriggerCard('state_captured_scd')
                .trigger(this, { state_name: stateName })
                .catch(this.error);

            this.debug('State captured:', stateName);
            return true;

        } catch (e) {
            this.error('Capture failed:', e);

            await this.homey.flow.getTriggerCard('capture_error_scd')
                .trigger(this, { error: e.message, state_name: stateName })
                .catch(this.error);

            throw e;
        }
    }

    /**
     * Flow Action: Apply a captured state
     */
    async onFlowApplyState(args) {
        // Handle both autocomplete object and direct string
        const stateName = args.state_name?.name || args.state_name;

        if (!stateName) {
            throw new Error(this.homey.__('errors.state_name_required') || 'State name is required');
        }

        const state = this.stateManager.getState(this.getDeviceId(), stateName);
        if (!state) {
            throw new Error(this.homey.__('errors.state_not_found') || `State '${stateName}' not found`);
        }

        try {
            const result = await this._applyValues(state.values);

            // Trigger success
            await this.homey.flow.getTriggerCard('state_applied_scd')
                .trigger(this, { state_name: stateName })
                .catch(this.error);

            if (result.errors.length > 0) {
                this.debug(`Applied state "${stateName}" with ${result.errors.length} errors`);
            } else {
                this.debug(`Applied state "${stateName}" successfully`);
            }

            return true;

        } catch (e) {
            this.error('Apply failed:', e);

            await this.homey.flow.getTriggerCard('capture_error_scd')
                .trigger(this, { error: e.message, state_name: stateName })
                .catch(this.error);

            throw e;
        }
    }

    /**
     * Flow Action: Delete a captured state
     */
    async onFlowDeleteState(args) {
        const stateName = args.state_name?.name || args.state_name;

        if (!stateName) {
            throw new Error('State name is required');
        }

        const deleted = this.stateManager.deleteState(this.getDeviceId(), stateName);
        if (!deleted) {
            throw new Error(`State '${stateName}' not found`);
        }

        this.debug('Deleted state:', stateName);
        return true;
    }

    // ==================== FLOW ACTIONS: STACK ====================

    /**
     * Flow Action: Push current state onto stack
     */
    async onFlowPushState(args) {
        const template = this.getTemplate();
        const api = this.homey.app.api;

        try {
            const result = await this.stateManager.pushState(
                this.getDeviceId(),
                template,
                api
            );

            // Trigger success (state_name is empty for stack operations)
            await this.homey.flow.getTriggerCard('state_captured_scd')
                .trigger(this, { state_name: '' })
                .catch(this.error);

            this.debug(`Pushed state onto stack (depth: ${result.depth})`);
            return true;

        } catch (e) {
            this.error('Push failed:', e);

            await this.homey.flow.getTriggerCard('capture_error_scd')
                .trigger(this, { error: e.message, state_name: '' })
                .catch(this.error);

            throw e;
        }
    }

    /**
     * Flow Action: Pop state from stack and apply it
     */
    async onFlowPopState(args) {
        const state = this.stateManager.popState(this.getDeviceId());

        if (!state) {
            throw new Error(this.homey.__('errors.stack_empty') || 'Stack is empty');
        }

        try {
            const result = await this._applyValues(state.values);

            // Trigger success
            await this.homey.flow.getTriggerCard('state_applied_scd')
                .trigger(this, { state_name: '' })
                .catch(this.error);

            this.debug('Popped and applied state from stack');
            return true;

        } catch (e) {
            this.error('Pop/Apply failed:', e);

            await this.homey.flow.getTriggerCard('capture_error_scd')
                .trigger(this, { error: e.message, state_name: '' })
                .catch(this.error);

            throw e;
        }
    }

    /**
     * Flow Action: Peek at top of stack and apply (without removing)
     */
    async onFlowPeekApplyState(args) {
        const state = this.stateManager.peekState(this.getDeviceId());

        if (!state) {
            throw new Error(this.homey.__('errors.stack_empty') || 'Stack is empty');
        }

        try {
            const result = await this._applyValues(state.values);

            // Trigger success
            await this.homey.flow.getTriggerCard('state_applied_scd')
                .trigger(this, { state_name: '' })
                .catch(this.error);

            this.debug('Peeked and applied state from stack (not removed)');
            return true;

        } catch (e) {
            this.error('Peek/Apply failed:', e);

            await this.homey.flow.getTriggerCard('capture_error_scd')
                .trigger(this, { error: e.message, state_name: '' })
                .catch(this.error);

            throw e;
        }
    }

    /**
     * Flow Action: Clear the stack
     */
    async onFlowClearStack(args) {
        const count = this.stateManager.clearStack(this.getDeviceId());
        this.debug(`Cleared stack (${count} items removed)`);
        return true;
    }

    // ==================== FLOW ACTIONS: EXPORT/IMPORT ====================

    /**
     * Flow Action: Export all named states as JSON
     */
    async onFlowExportStates(args) {
        try {
            const exportData = this.stateManager.exportNamedStates(this.getDeviceId());
            const jsonString = JSON.stringify(exportData);

            this.debug(`Exported ${Object.keys(exportData.states).length} named states`);

            return { json_data: jsonString };

        } catch (e) {
            this.error('Export failed:', e);
            throw e;
        }
    }

    /**
     * Flow Action: Import named states from JSON
     */
    async onFlowImportStates(args) {
        const jsonData = args.json_data;

        if (!jsonData || jsonData.trim() === '') {
            throw new Error('JSON data is required');
        }

        let statesData;
        try {
            statesData = JSON.parse(jsonData);
        } catch (e) {
            throw new Error('Invalid JSON format: ' + e.message);
        }

        try {
            const result = this.stateManager.importNamedStates(this.getDeviceId(), statesData);

            this.debug(`Imported ${result.imported} states (${result.overwritten} overwritten)`);

            if (result.errors.length > 0) {
                this.debug('Import errors:', result.errors);
            }

            return true;

        } catch (e) {
            this.error('Import failed:', e);
            throw e;
        }
    }

    // ==================== FLOW CONDITIONS ====================

    /**
     * Flow Condition: Check if named state exists
     */
    onFlowConditionStateExists(args) {
        const stateName = args.state_name;
        if (!stateName) return false;
        return this.stateManager.stateExists(this.getDeviceId(), stateName);
    }

    /**
     * Flow Condition: Check if stack is empty
     */
    onFlowConditionStackEmpty(args) {
        return this.stateManager.isStackEmpty(this.getDeviceId());
    }

    /**
     * Flow Condition: Check stack depth against operator and value
     */
    onFlowConditionStackDepth(args) {
        const depth = this.stateManager.getStackDepth(this.getDeviceId());
        const targetDepth = Number(args.depth) || 0;
        const operator = args.operator;

        switch (operator) {
            case 'eq':
                return depth === targetDepth;
            case 'gt':
                return depth > targetDepth;
            case 'gte':
                return depth >= targetDepth;
            case 'lt':
                return depth < targetDepth;
            case 'lte':
                return depth <= targetDepth;
            default:
                return depth === targetDepth;
        }
    }

    // ==================== AUTOCOMPLETE ====================

    /**
     * Get state names for autocomplete
     */
    getStateNamesForAutocomplete(query) {
        const states = this.stateManager.listStateNames(this.getDeviceId());
        const lowerQuery = (query || '').toLowerCase();

        return states
            .filter(s => !query || s.name.toLowerCase().includes(lowerQuery))
            .map(s => ({
                name: s.name,
                description: `Captured: ${new Date(s.captured_at).toLocaleString()}`,
                id: s.name
            }));
    }

    // ==================== LIFECYCLE ====================

    async onDeleted() {
        // Clean up stored states when device is deleted
        if (this.stateManager) {
            this.stateManager.cleanupDevice(this.getDeviceId());
        }
    }
}

module.exports = StateCaptureDevice;
