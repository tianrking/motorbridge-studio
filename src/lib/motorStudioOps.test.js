import { describe, expect, it } from 'vitest';
import { mapResponseToHit } from './motorStudioOps';

describe('motor studio ops', () => {
  it('unwraps gateway state_once payloads before merging RobStride telemetry', () => {
    const hit = {
      vendor: 'robstride',
      model: 'rs-00',
      esc_id: 4,
      mst_id: 0xfd,
    };
    const next = mapResponseToHit(hit, {
      state: {
        vendor: 'robstride',
        has_value: true,
        state_seq: 42,
        status_code: 0,
        pos: -0.138,
        vel: 0.25,
        torq: 0.03,
        t_mos: 31.5,
      },
    });

    expect(next.pos).toBeCloseTo(-0.138);
    expect(next.vel).toBeCloseTo(0.25);
    expect(next.torq).toBeCloseTo(0.03);
    expect(next.t_mos).toBeCloseTo(31.5);
    expect(next.state_seq).toBe(42);
    expect(next.pmax).toBeCloseTo(4 * Math.PI);
    expect(next.vmax).toBe(50);
    expect(next.tmax).toBe(17);
  });

  it('does not mark repeated RobStride state frames as fresh telemetry', () => {
    const hit = {
      vendor: 'robstride',
      model: 'rs-00',
      esc_id: 4,
      mst_id: 0xfd,
      state_seq: 7,
      updated_at_ms: 123456,
    };
    const next = mapResponseToHit(hit, {
      vendor: 'robstride',
      has_value: true,
      state_seq: 7,
      pos: 1.25,
      vel: 2.5,
    });

    expect(next.pos).toBeCloseTo(1.25);
    expect(next.vel).toBeCloseTo(2.5);
    expect(next.state_seq).toBe(7);
    expect(next.updated_at_ms).toBe(123456);
  });
});
