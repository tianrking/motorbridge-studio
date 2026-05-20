import { describe, expect, it } from 'vitest';
import {
  ROBSTRIDE_PARAM_CATALOG,
  canRobstrideRead,
  canRobstrideWrite,
  toRobstrideCliType,
} from './robstrideParamCatalog';

describe('robstride parameter catalog helpers', () => {
  it('maps only parameter types supported by the v0.3.5 WS API', () => {
    expect(toRobstrideCliType('UInt8')).toBe('u8');
    expect(toRobstrideCliType('UInt16')).toBe('u16');
    expect(toRobstrideCliType('UInt32')).toBe('u32');
    expect(toRobstrideCliType('Int8')).toBe('i8');
    expect(toRobstrideCliType('Float32')).toBe('f32');
  });

  it('does not silently reinterpret signed 16/32-bit values as unsigned', () => {
    expect(toRobstrideCliType('int16')).toBe('');
    expect(toRobstrideCliType('int32')).toBe('');
  });

  it('uses the RobStride section 4 runtime 0x7xxx parameter list', () => {
    const ids = ROBSTRIDE_PARAM_CATALOG.map((x) => x.id);
    expect(ids).toEqual([
      0x7005, 0x7006, 0x700a, 0x700b, 0x7010, 0x7011, 0x7014, 0x7016, 0x7017, 0x7018, 0x7019,
      0x701a, 0x701b, 0x701c, 0x701e, 0x701f, 0x7020, 0x7021, 0x7022, 0x7024, 0x7025, 0x7026,
      0x7028, 0x7029, 0x702a, 0x702b, 0x702c, 0x702d, 0x702e,
    ]);
    expect(ids.every((id) => id >= 0x7000 && id <= 0x7fff)).toBe(true);
  });

  it('marks read-only and write-only RobStride parameters correctly', () => {
    const mechPos = ROBSTRIDE_PARAM_CATALOG.find((x) => x.id === 0x7019);
    const canTimeout = ROBSTRIDE_PARAM_CATALOG.find((x) => x.id === 0x7028);

    expect(mechPos?.access).toBe('ro');
    expect(canRobstrideRead(mechPos?.access)).toBe(true);
    expect(canRobstrideWrite(mechPos?.access)).toBe(false);

    expect(canTimeout?.access).toBe('wo');
    expect(canRobstrideRead(canTimeout?.access)).toBe(false);
    expect(canRobstrideWrite(canTimeout?.access)).toBe(true);
  });
});
