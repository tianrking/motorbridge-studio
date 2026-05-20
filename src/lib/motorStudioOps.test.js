import { describe, expect, it } from 'vitest';
import { mapParamStreamToHit, mapResponseToHit } from './motorStudioOps';

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
    expect(next.pmax).toBeCloseTo(4 * Math.PI);
    expect(next.vmax).toBe(50);
    expect(next.tmax).toBe(17);
  });

  it('maps RobStride observation params into live feedback fields', () => {
    const next = mapParamStreamToHit(
      { vendor: 'robstride', pos: 0, vel: 0, torq: 0 },
      {
        vendor: 'robstride',
        values: {
          run_mode: 1,
          mechPos: -0.82,
          mechVel: 0.25,
          iqf: 0.31,
          VBUS: 24.1,
          torque_fdb: 0.08,
          drv_temp: 0,
        },
      }
    );

    expect(next.pos).toBeCloseTo(-0.82);
    expect(next.vel).toBeCloseTo(0.25);
    expect(next.iqf).toBeCloseTo(0.31);
    expect(next.torq).toBeCloseTo(0.08);
    expect(next.vbus).toBeCloseTo(24.1);
    expect(next.t_mos).toBeUndefined();
    expect(next.status_name).toBe('Position');
    expect(next.feedback_source).toBe('robstride_observation_params');
  });

  it('maps Damiao param stream values into diagnostic fields without overriding feedback', () => {
    const next = mapParamStreamToHit(
      { vendor: 'damiao', pos: 0 },
      {
        vendor: 'damiao',
        values: {
          CTRL_MODE: 2,
          VBus: 24.2,
          Tpcb: 35,
          Tmtr: 32,
          p_m: 0.5,
          xout: 0.45,
          PMAX: 12.5,
          VMAX: 50,
          TMAX: 17,
        },
      }
    );

    expect(next.pos).toBe(0);
    expect(next.motor_pos).toBeCloseTo(0.5);
    expect(next.output_pos).toBeCloseTo(0.45);
    expect(next.vbus).toBeCloseTo(24.2);
    expect(next.t_mos).toBeCloseTo(35);
    expect(next.t_rotor).toBeCloseTo(32);
    expect(next.status).toBe(2);
    expect(next.pmax).toBeCloseTo(12.5);
  });
});
