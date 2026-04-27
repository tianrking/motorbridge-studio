import { defaultControlsForHit, getResponseValue, mergeHitsByVendor, motorKey, normalizeControlValue, toHex } from '../lib/utils';
import { DAMIAO_REGISTER_SNAPSHOT_FIELDS } from '../lib/appConfig';
import {
  controlMotorOp,
  probeMotorOp,
  refreshMotorStateOp,
  setIdForOp,
  verifyHitOp,
  zeroMotorOp,
  modelForHit,
} from '../lib/motorStudioOps';

export function useMotorControl({
  t,
  vendors,
  controls,
  setHits,
  setControls,
  pushLog,
  setTargetFor,
  sendCmd,
  closeBusQuietly,
  armBulkBusy,
  askConfirm,
}) {
  const patchControl = (k, patch) => {
    setControls((prev) => {
      const base = prev[k] || {};
      const normalizedPatch = Object.fromEntries(
        Object.entries(patch || {}).map(([field, value]) => [
          field,
          normalizeControlValue(field, value, base[field]),
        ]),
      );
      return { ...prev, [k]: { ...base, ...normalizedPatch } };
    });
  };

  const syncDamiaoRegisterSnapshot = (h, rid, value) => {
    if (String(h?.vendor) !== 'damiao') return;

    const field = DAMIAO_REGISTER_SNAPSHOT_FIELDS[Number(rid)];
    if (!field) return;

    const num = Number(value);
    const patch = {
      updated_at_ms: Date.now(),
      [field]: Number.isFinite(num) ? num : value,
    };

    setHits((prev) => mergeHitsByVendor(prev, [{ ...h, ...patch }]));
  };

  const parseParamId = (raw) => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return Number.NaN;
      if (/^0x/i.test(s)) return Number.parseInt(s.slice(2), 16);
      return Number.parseInt(s, 10);
    }
    return Number.NaN;
  };

  const syncRobstrideParamSnapshot = (h, op, payload, ret) => {
    if (String(h?.vendor) !== 'robstride') return;
    const data = ret?.data || {};
    const paramId = parseParamId(data?.param_id ?? payload?.param_id);
    if (!Number.isFinite(paramId)) return;

    let value = data?.value;
    if (op === 'robstride_write_param') {
      value = data?.verify?.value ?? data?.value ?? payload?.value;
    }
    const type = String(data?.type ?? payload?.type ?? '').toLowerCase();
    const fieldHex = `0x${paramId.toString(16).toUpperCase().padStart(4, '0')}`;
    const patch = {
      updated_at_ms: Date.now(),
      robstride_last_param_id: fieldHex,
      robstride_last_param_type: type || '-',
      robstride_last_param_value: value,
      [`rs_param_${fieldHex.slice(2)}`]: value,
    };

    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      if (paramId === 0x3016) patch.pos = numericValue;
      if (paramId === 0x3017) patch.vel = numericValue;
      if (paramId === 0x302C) patch.torq = numericValue;
      if (paramId === 0x3022) patch.status = numericValue;
    }

    setHits((prev) => mergeHitsByVendor(prev, [{ ...h, ...patch }]));
  };

  const verifyHit = (h) =>
    verifyHitOp({ h, vendors, setTargetFor, sendCmd, setHits, closeBusQuietly, pushLog });

  const setIdFor = async (h) => {
    const ok = await (askConfirm
      ? askConfirm({
          title: t('confirm_dialog_title'),
          message: t('confirm_set_id', { vendor: h.vendor, esc: toHex(h.esc_id), mst: toHex(h.mst_id) }),
          danger: true,
        })
      : Promise.resolve(true));
    if (!ok) return false;
    return setIdForOp({
      h,
      controls,
      vendors,
      setTargetFor,
      sendCmd,
      setHits,
      setControls,
      closeBusQuietly,
      pushLog,
    });
  };

  const controlMotor = (h, action, controlOverride = null, options = {}) => {
    if (armBulkBusy && !options.allowDuringBulk) {
      pushLog(`control ${action} blocked: robot-arm bulk operation in progress`, 'info');
      return Promise.resolve(false);
    }
    return controlMotorOp({
      h,
      action,
      controls,
      controlOverride,
      vendors,
      setTargetFor,
      sendCmd,
      setHits,
      setControls,
      closeBusQuietly,
      pushLog,
    });
  };

  const zeroMotor = (h) =>
    zeroMotorOp({
      h,
      controls,
      vendors,
      setTargetFor,
      sendCmd,
      setHits,
      closeBusQuietly,
      pushLog,
    });

  const refreshMotorState = (h) =>
    refreshMotorStateOp({ h, vendors, setTargetFor, sendCmd, setHits, pushLog });

  const probeMotor = (h, options = {}) =>
    probeMotorOp({ h, vendors, setTargetFor, sendCmd, setHits, closeBusQuietly, pushLog, options });

  const resetControlFor = (h) => {
    const key = motorKey(h);
    setControls((prev) => ({ ...prev, [key]: defaultControlsForHit(h) }));
  };

  const runMotorOp = async (
    h,
    op,
    payload = {},
    timeoutMs = 4000,
    options = { setTarget: true, closeBusAfter: true },
  ) => {
    try {
      if (options?.setTarget !== false) {
        await setTargetFor(h.vendor, modelForHit(h, vendors), h.esc_id, h.mst_id);
      }
      const ret = await sendCmd(op, payload, timeoutMs);
      if (!ret?.ok) throw new Error(ret?.error || `${op} failed`);
      if (op === 'get_register_u32' || op === 'get_register_f32') {
        syncDamiaoRegisterSnapshot(h, payload?.rid, getResponseValue(ret));
      }
      if (op === 'write_register_u32' || op === 'write_register_f32') {
        syncDamiaoRegisterSnapshot(h, payload?.rid, payload?.value);
      }
      if (op === 'robstride_read_param' || op === 'robstride_write_param') {
        syncRobstrideParamSnapshot(h, op, payload, ret);
      }
      pushLog(`${op} ${h.vendor} ${toHex(h.esc_id)} ok`, 'ok');
      return ret;
    } catch (e) {
      pushLog(`${op} ${h.vendor} ${toHex(h.esc_id)} failed: ${e.message || e}`, 'err');
      throw e;
    } finally {
      if (options?.closeBusAfter !== false) {
        await closeBusQuietly();
      }
    }
  };

  return {
    patchControl,
    verifyHit,
    setIdFor,
    controlMotor,
    zeroMotor,
    refreshMotorState,
    probeMotor,
    resetControlFor,
    runMotorOp,
  };
}
