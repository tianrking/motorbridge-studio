import { describe, expect, it } from 'vitest';
import { normalizeControlForHit, normalizeControlValue, normalizeHits } from './utils';

describe('utils normalizeHits', () => {
  it('uses probe as robstride esc_id when both probe and device_id exist', () => {
    const normalized = normalizeHits(
      'robstride',
      {
        hits: [
          { probe: 1, device_id: 35, responder_id: 254, feedback_id: 0xfd },
          { probe: 2, device_id: 71, responder_id: 254, feedback_id: 0xfd },
        ],
      },
      'rs-00'
    );

    expect(normalized).toHaveLength(2);
    expect(normalized[0].esc_id).toBe(1);
    expect(normalized[1].esc_id).toBe(2);
    expect(normalized[0].device_id).toBe(35);
    expect(normalized[1].device_id).toBe(71);
  });

  it('adds RobStride model limits to scan hits', () => {
    const [hit] = normalizeHits(
      'robstride',
      {
        hits: [{ probe: 4, device_id: 4, responder_id: 0xfd, feedback_id: 0xfd }],
      },
      'rs-00'
    );

    expect(hit.pmax).toBeCloseTo(4 * Math.PI);
    expect(hit.vmax).toBe(50);
    expect(hit.tmax).toBe(17);
  });
});

describe('utils normalizeControlValue', () => {
  it('preserves empty numeric control text while editing', () => {
    expect(normalizeControlValue('target', '', 1.23)).toBe('');
  });

  it('still parses numeric control text when present', () => {
    expect(normalizeControlValue('target', '1.23', 0)).toBeCloseTo(1.23);
  });
});

describe('utils normalizeControlForHit', () => {
  it('does not refill cleared numeric control fields while editing', () => {
    const hit = { vendor: 'robstride', esc_id: 1, mst_id: 0xfd };
    const control = normalizeControlForHit(hit, {
      target: '',
      vlim: '',
      kp: '',
      kd: '',
      tau: '',
      ratio: '',
      newEsc: '',
      newMst: '',
    });

    expect(control.target).toBe('');
    expect(control.vlim).toBe('');
    expect(control.kp).toBe('');
    expect(control.kd).toBe('');
    expect(control.tau).toBe('');
    expect(control.ratio).toBe('');
    expect(control.newEsc).toBe('');
    expect(control.newMst).toBe('');
  });
});
