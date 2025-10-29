const { describe, it, expect } = require('@jest/globals');

describe('Logic Device Isolation', () => {
  it('should keep separate state for two different device instances', async () => {
    // Opprett to separate enheter
    const device1 = await createTestDevice({
      name: 'Device 1',
      formulas: [{
        id: 'f1',
        name: 'Formula 1',
        expression: 'A AND B',
        enabled: true
      }]
    });

    const device2 = await createTestDevice({
      name: 'Device 2',
      formulas: [{
        id: 'f1',
        name: 'Formula 1',
        expression: 'A AND B',
        enabled: true
      }]
    });

    // Sett inputs for device 1
    await device1.setInputForFormula('f1', 'a', true);
    await device1.setInputForFormula('f1', 'b', true);

    // Sett inputs for device 2
    await device2.setInputForFormula('f1', 'a', false);
    await device2.setInputForFormula('f1', 'b', false);

    // Verifiser at de har uavhengig state
    const result1 = device1.getFormulaResult('f1');
    const result2 = device2.getFormulaResult('f1');

    expect(result1).toBe(true);  // A AND B = true AND true
    expect(result2).toBe(false); // A AND B = false AND false
  });

  it('should prevent adding multiple formulas to Logic Device', async () => {
    const device = await createTestDevice({
      name: 'Test Device',
      formulas: [
        { id: 'f1', name: 'Formula 1', expression: 'A', enabled: true },
        { id: 'f2', name: 'Formula 2', expression: 'B', enabled: true }
      ]
    });

    // Dette skal kaste en feil
    await expect(
      device.onSettings({
        oldSettings: {},
        newSettings: {
          formulas: JSON.stringify([
            { id: 'f1', name: 'Formula 1', expression: 'A', enabled: true },
            { id: 'f2', name: 'Formula 2', expression: 'B', enabled: true }
          ])
        },
        changedKeys: ['formulas']
      })
    ).rejects.toThrow('Logic Device kan kun ha én formel');
  });
});