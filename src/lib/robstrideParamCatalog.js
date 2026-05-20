// RobStride protocol section 4 runtime parameter list, aligned with
// motor_vendors/robstride/src/registers.rs in MotorBridge v0.3.5.
export const ROBSTRIDE_PARAM_CATALOG = [
  {
    id: 0x7005,
    name: 'run_mode',
    dataType: 'Int8',
    access: 'rw',
    desc: 'Control mode: 0 MIT, 1 Position/PP, 2 velocity, 3 current, 5 CSP.',
  },
  {
    id: 0x7006,
    name: 'iq_ref',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Current-mode Iq target, A, typical range -43..43.',
  },
  {
    id: 0x700a,
    name: 'spd_ref',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Velocity-mode target, rad/s, typical range -20..20.',
  },
  {
    id: 0x700b,
    name: 'limit_torque',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Torque limit, Nm, typical range 0..60.',
  },
  {
    id: 0x7010,
    name: 'cur_kp',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Current-loop Kp, default around 0.17.',
  },
  {
    id: 0x7011,
    name: 'cur_ki',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Current-loop Ki, default around 0.012.',
  },
  {
    id: 0x7014,
    name: 'cur_filter_gain',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Current filter gain ratio, typical range 0..1, default around 0.1.',
  },
  {
    id: 0x7016,
    name: 'loc_ref',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Position target, rad. Used by unified pos_vel.',
  },
  {
    id: 0x7017,
    name: 'limit_spd',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Position speed limit, rad/s, typical range 0..20. Used by unified pos_vel.',
  },
  {
    id: 0x7018,
    name: 'limit_cur',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Velocity/position current limit, A, typical range 0..43.',
  },
  {
    id: 0x7019,
    name: 'mechPos',
    dataType: 'Float32',
    access: 'ro',
    desc: 'Load-side counted mechanical angle, rad.',
  },
  { id: 0x701a, name: 'iqf', dataType: 'Float32', access: 'ro', desc: 'Filtered Iq current, A.' },
  {
    id: 0x701b,
    name: 'mechVel',
    dataType: 'Float32',
    access: 'ro',
    desc: 'Load-side mechanical velocity, rad/s.',
  },
  { id: 0x701c, name: 'VBUS', dataType: 'Float32', access: 'ro', desc: 'Bus voltage, V.' },
  {
    id: 0x701e,
    name: 'loc_kp',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Position-loop Kp, default around 60. Used by unified pos_vel when kp/loc_kp is supplied.',
  },
  {
    id: 0x701f,
    name: 'spd_kp',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Speed-loop Kp, default around 6.',
  },
  {
    id: 0x7020,
    name: 'spd_ki',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Speed-loop Ki, default around 0.02.',
  },
  {
    id: 0x7021,
    name: 'spd_filter_gain',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Speed filter gain, default around 0.1.',
  },
  {
    id: 0x7022,
    name: 'acc_rad',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Velocity-mode acceleration, rad/s^2, default around 20.',
  },
  {
    id: 0x7024,
    name: 'vel_max',
    dataType: 'Float32',
    access: 'rw',
    desc: 'PP/Position mode max velocity, rad/s, default around 10.',
  },
  {
    id: 0x7025,
    name: 'acc_set',
    dataType: 'Float32',
    access: 'rw',
    desc: 'PP/Position mode acceleration, rad/s^2, default around 10.',
  },
  {
    id: 0x7026,
    name: 'EPScan_time',
    dataType: 'UInt16',
    access: 'wo',
    desc: 'Active report period. Default 1 means 10 ms; each +1 adds about 5 ms.',
  },
  {
    id: 0x7028,
    name: 'canTimeout',
    dataType: 'UInt32',
    access: 'wo',
    desc: 'CAN timeout. Default 0; 20000 means about 1 s.',
  },
  {
    id: 0x7029,
    name: 'zero_sta',
    dataType: 'UInt8',
    access: 'wo',
    desc: 'Zero state: 0 for 0..2pi, 1 for -pi..pi. Save parameters after writing.',
  },
  {
    id: 0x702a,
    name: 'damper',
    dataType: 'UInt8',
    access: 'rw',
    desc: 'Switch. 1 disables power-off back-drive damping.',
  },
  {
    id: 0x702b,
    name: 'add_offset',
    dataType: 'Float32',
    access: 'rw',
    desc: 'Zero offset, rad, default 0.',
  },
  {
    id: 0x702c,
    name: 'alveolous_open',
    dataType: 'UInt8',
    access: 'rw',
    desc: 'Switch. 1 enables cogging compensation.',
  },
  {
    id: 0x702d,
    name: 'iq_test',
    dataType: 'UInt8',
    access: 'rw',
    desc: 'Switch. 1 enables more precise initialization calibration.',
  },
  {
    id: 0x702e,
    name: 'dcc_set',
    dataType: 'Float32',
    access: 'rw',
    desc: 'PP-mode deceleration, rad/s^2, default around 10.',
  },
].sort((a, b) => a.id - b.id);

export const ROBSTRIDE_ACCESS_LABELS = {
  rw: 'Read/Write',
  ro: 'Read-Only',
  wo: 'Write-Only',
};

export function toRobstrideCliType(dataType) {
  const t = String(dataType || '').toLowerCase();
  if (t === 'uint8' || t === 'u8') return 'u8';
  if (t === 'uint16' || t === 'u16') return 'u16';
  if (t === 'uint32' || t === 'u32') return 'u32';
  if (t === 'int8' || t === 'i8') return 'i8';
  if (t === 'float' || t === 'float32' || t === 'f32') return 'f32';
  return '';
}

export function canRobstrideRead(access) {
  return access === 'rw' || access === 'ro';
}

export function canRobstrideWrite(access) {
  return access === 'rw' || access === 'wo';
}
