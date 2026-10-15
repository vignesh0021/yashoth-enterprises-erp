// Weighment Engine Business Rule Tests
import { describe, it, expect } from 'vitest';
import { 
  calcNetWeight, 
  calcPayableWeight, 
  calcMaterialAmount, 
  roundTo3 
} from '../src/utils/calculations.ts';

describe('Weighment Engine & Calculations', () => {
  it('should calculate correct net weight for valid gross and tare', () => {
    // 12,500 kg gross - 4,500 kg tare = 8,000 kg net
    const net = calcNetWeight(12500, 4500);
    expect(net).toBe(8000);
  });

  it('should reject tare weight exceeding gross weight', () => {
    expect(() => calcNetWeight(4000, 4500)).toThrow('Tare weight cannot exceed gross weight');
  });

  it('should reject negative gross or tare weights', () => {
    expect(() => calcNetWeight(-100, 50)).toThrow('Gross and tare weights must be non-negative');
    expect(() => calcNetWeight(100, -50)).toThrow('Gross and tare weights must be non-negative');
  });

  it('should calculate payable weight deducting approved contamination/moisture deductions', () => {
    // 8,000 kg net - 250 kg deduction = 7,750 kg payable
    const payable = calcPayableWeight(12500, 4500, 250);
    expect(payable).toBe(7750);
  });

  it('should reject deductions exceeding net weight', () => {
    expect(() => calcPayableWeight(1000, 800, 300)).toThrow('Deductions cannot exceed net weight');
  });

  it('should correctly calculate material amount (payable weight * rate per unit)', () => {
    // 8,000 kg * ₹30/kg = ₹2,40,000
    const amount = calcMaterialAmount(8000, 30);
    expect(amount).toBe(240000);
  });

  it('should maintain decimal precision to 3 decimal places for weights', () => {
    const net = calcNetWeight(15420.755, 4120.355);
    expect(net).toBe(roundTo3(11300.400));
  });
});
