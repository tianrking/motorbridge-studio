import React from 'react';
import { useI18n } from '../../i18n';
import { DAMIAO_ARM_PARAM_DEFS } from '../../lib/appConfig';
import { sleep } from '../../lib/async';
import {
  REBOT_ARM_DAMIAO_DEFAULT_TEMPLATE,
  ZERO_SAFE_EPS_RAD,
} from '../../lib/robotArm';
import { parseNum } from '../../lib/utils';
import { usePersistedState } from '../../hooks/usePersistedState';
import { ZeroConfirmDialog } from './ZeroConfirmDialog';
import { ParamTable } from './ParamTable';

export function jointLimit(joint, limits) {
  return limits[Number(joint)] || { min: -3.14, max: 3.14 };
}

export function clampByLimit(value, lim) {
  return Math.max(lim.min, Math.min(lim.max, value));
}

export function armPreferredMode() {
  return 'pos_vel';
}

function createParamValueDefaults() {
  return Object.fromEntries(
    DAMIAO_ARM_PARAM_DEFS.map((def) => [def.key, String(def.defaultValue ?? '')]),
  );
}

export function ToastManager({ limitToast, demoToast, children }) {
  return (
    <>
      {limitToast.visible && (
        <div key={limitToast.seq} className="armLimitToast" role="status" aria-live="polite">
          {limitToast.message}
        </div>
      )}
      {demoToast.visible && (
        <div
          key={demoToast.seq}
          className={`armDemoToast ${demoToast.tone}`}
          role="status"
          aria-live="polite"
        >
          <div className="armDemoToastTitle">{demoToast.title}</div>
          {demoToast.detail && <div className="armDemoToastDetail">{demoToast.detail}</div>}
        </div>
      )}
      {children}
    </>
  );
}

export function ZeroDialogManager({
  robotArmJointRows,
  refreshMotorState,
  zeroAllRobotArm,
  setLimitWarn,
  showLimitToast,
  limits,
  children,
}) {
  const { t } = useI18n();
  const [zeroCheckBusy, setZeroCheckBusy] = React.useState(false);
  const [zeroConfirm, setZeroConfirm] = React.useState({
    open: false,
    title: '',
    message: '',
    danger: false,
  });
  const zeroConfirmResolverRef = React.useRef(null);
  const rowsRef = React.useRef(robotArmJointRows);

  React.useEffect(() => {
    rowsRef.current = robotArmJointRows;
  }, [robotArmJointRows]);

  const computeZeroSafety = React.useCallback(
    (rows) => {
      const notReady = (rows || [])
        .map((row) => {
          const p = Number(row?.hit?.pos);
          if (!Number.isFinite(p)) return { joint: row.joint, pos: null };
          return Math.abs(p) <= ZERO_SAFE_EPS_RAD ? null : { joint: row.joint, pos: p };
        })
        .filter(Boolean);

      return {
        ok: notReady.length === 0,
        notReady,
      };
    },
    [],
  );

  const zeroSafety = React.useMemo(
    () => computeZeroSafety(robotArmJointRows),
    [computeZeroSafety, robotArmJointRows],
  );

  const askZeroConfirm = React.useCallback((cfg) => {
    return new Promise((resolve) => {
      zeroConfirmResolverRef.current = resolve;
      setZeroConfirm({
        open: true,
        title: cfg?.title || '',
        message: cfg?.message || '',
        danger: Boolean(cfg?.danger),
      });
    });
  }, []);

  const closeZeroConfirm = React.useCallback((accepted) => {
    const done = zeroConfirmResolverRef.current;
    zeroConfirmResolverRef.current = null;
    setZeroConfirm((prev) => ({ ...prev, open: false }));
    if (done) done(Boolean(accepted));
  }, []);

  React.useEffect(() => {
    return () => {
      if (zeroConfirmResolverRef.current) {
        zeroConfirmResolverRef.current(false);
        zeroConfirmResolverRef.current = null;
      }
    };
  }, []);

  const onZeroAllSafe = React.useCallback(async () => {
    if (zeroCheckBusy) return;
    setZeroCheckBusy(true);
    try {
      const preRows = rowsRef.current || [];
      for (const row of preRows) {
        if (!row?.hit) continue;
        await refreshMotorState(row.hit);
        await sleep(20);
      }
      await sleep(80);

      const freshSafety = computeZeroSafety(rowsRef.current || []);
      if (!freshSafety.ok) {
        const short = freshSafety.notReady
          .slice(0, 4)
          .map((x) => `J${x.joint}${x.pos == null ? '(?)' : `(${x.pos.toFixed(2)})`}`)
          .join(', ');
        const more = freshSafety.notReady.length > 4 ? ` +${freshSafety.notReady.length - 4}` : '';
        const msg = t('arm_zero_all_blocked', { joints: `${short}${more}`, eps: ZERO_SAFE_EPS_RAD.toFixed(2) });
        setLimitWarn(msg);
        showLimitToast(msg);
        const forceConfirm = await askZeroConfirm({
          title: t('arm_zero_all_force_title'),
          message: `${msg}\n\n${t('arm_zero_all_force_hint')}`,
          danger: true,
        });
        if (!forceConfirm) return;
      }

      const c1 = await askZeroConfirm({
        title: t('arm_zero_all_confirm_title'),
        message: t('arm_zero_all_confirm_1'),
        danger: true,
      });
      if (!c1) return;
      const c2 = await askZeroConfirm({
        title: t('arm_zero_all_confirm_title'),
        message: t('arm_zero_all_confirm_2'),
        danger: true,
      });
      if (!c2) return;
      await zeroAllRobotArm();
    } finally {
      setZeroCheckBusy(false);
    }
  }, [
    askZeroConfirm,
    computeZeroSafety,
    refreshMotorState,
    setLimitWarn,
    showLimitToast,
    t,
    zeroAllRobotArm,
    zeroCheckBusy,
  ]);

  return (
    <>
      <ZeroConfirmDialog
        open={zeroConfirm.open}
        title={zeroConfirm.title}
        message={zeroConfirm.message}
        danger={zeroConfirm.danger}
        onCancel={() => closeZeroConfirm(false)}
        onConfirm={() => closeZeroConfirm(true)}
      />
      {children({
        askZeroConfirm,
        zeroCheckBusy,
        zeroSafety,
        onZeroAllSafe,
        jointLimit: (joint) => jointLimit(joint, limits),
        clampByLimit,
      })}
    </>
  );
}

export function LiveMoveScheduler({
  activeRow,
  liveMove,
  connected,
  armBulkBusy,
  controlMotor,
  patchControl,
  setLimitWarn,
  showLimitToast,
  limits,
  children,
}) {
  const { t } = useI18n();
  const liveMoveTimerRef = React.useRef(null);
  const pendingLiveMoveRef = React.useRef(null);

  React.useEffect(() => () => {
    if (liveMoveTimerRef.current) clearTimeout(liveMoveTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (!armBulkBusy) return;
    pendingLiveMoveRef.current = null;
    if (liveMoveTimerRef.current) {
      clearTimeout(liveMoveTimerRef.current);
      liveMoveTimerRef.current = null;
    }
  }, [armBulkBusy]);

  const clampTargetForRow = React.useCallback(
    (row, rawText) => {
      const lim = jointLimit(row.joint, limits);
      const raw = parseNum(rawText, 0);
      const clamped = clampByLimit(raw, lim);
      return { raw, clamped, clipped: Math.abs(raw - clamped) > 1e-9, lim };
    },
    [limits],
  );

  const scheduleLiveMove = React.useCallback(
    (row, targetText) => {
      if (!liveMove || !connected || armBulkBusy) return;
      if (String(row?.control?.mode) === 'mit') return;
      const hit = row?.hit;
      if (!hit) return;
      pendingLiveMoveRef.current = { row, targetText };
      if (liveMoveTimerRef.current) return;
      liveMoveTimerRef.current = setTimeout(() => {
        liveMoveTimerRef.current = null;
        const pending = pendingLiveMoveRef.current;
        if (!pending) return;
        const checked = clampTargetForRow(pending.row, pending.targetText);
        if (checked.clipped) {
          const msg = t('arm_limit_blocked', {
            joint: pending.row.joint,
            req: checked.raw.toFixed(3),
            min: checked.lim.min.toFixed(3),
            max: checked.lim.max.toFixed(3),
            use: checked.clamped.toFixed(3),
          });
          setLimitWarn(msg);
          showLimitToast(msg);
          patchControl(pending.row.key, { target: String(checked.clamped) });
        } else {
          setLimitWarn('');
        }
        controlMotor(pending.row.hit, 'move', { target: String(checked.clamped) });
      }, 80);
    },
    [armBulkBusy, clampTargetForRow, connected, controlMotor, liveMove, patchControl, setLimitWarn, showLimitToast, t],
  );

  const onSliderTargetChange = React.useCallback(
    (targetText) => {
      if (!activeRow) return;
      patchControl(activeRow.key, { target: targetText });
      scheduleLiveMove(activeRow, targetText);
    },
    [activeRow, patchControl, scheduleLiveMove],
  );

  return children({ clampTargetForRow, onSliderTargetChange });
}

export function ParamManager({
  robotArmJointRows,
  readRobotArmControlParams,
  writeRobotArmControlParams,
  askZeroConfirm,
  canAction,
  armToolbarBusy,
  children,
}) {
  const { t } = useI18n();
  const [paramPanelOpen, setParamPanelOpen] = React.useState(false);
  const [paramBusy, setParamBusy] = React.useState(false);
  const [paramRows, setParamRows] = React.useState([]);
  const [paramInfo, setParamInfo] = React.useState('');
  const [paramProgress, setParamProgress] = React.useState({
    active: false,
    done: 0,
    total: 0,
    label: '',
    percent: 0,
  });
  const damiaoParamDefs = React.useMemo(() => DAMIAO_ARM_PARAM_DEFS, []);
  const writableParamDefs = React.useMemo(() => damiaoParamDefs.filter((x) => x.writable !== false), [damiaoParamDefs]);
  const riskyParamDefs = React.useMemo(() => writableParamDefs.filter((x) => x.risky), [writableParamDefs]);

  React.useEffect(() => {
    setParamRows((prev) =>
      robotArmJointRows.map((row) => {
        const old = prev.find((x) => x.key === row.key);
        return (
          old || {
            key: row.key,
            joint: row.joint,
            hit: row.hit,
            loaded: false,
            error: '',
            values: createParamValueDefaults(),
          }
        );
      }),
    );
  }, [robotArmJointRows]);

  const patchParam = React.useCallback((key, field, value) => {
    setParamRows((prev) =>
      prev.map((x) => (x.key === key ? { ...x, values: { ...x.values, [field]: value } } : x)),
    );
  }, []);

  const closeEnough = React.useCallback((a, b, eps = 1e-6) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= eps;
  }, []);

  const applyReadResultToRows = React.useCallback((result) => {
    setParamRows((prev) =>
      prev.map((x) => {
        const r = result?.[x.key];
        if (!r) return x;
        if (!r.ok) return { ...x, loaded: false, error: r.error || 'read failed' };
        const v = r.values || {};
        return {
          ...x,
          loaded: true,
          error: '',
          values: Object.fromEntries(
            damiaoParamDefs.map((def) => [def.key, String(v[def.key] ?? x.values?.[def.key] ?? '')]),
          ),
        };
      }),
    );
  }, [damiaoParamDefs]);

  const readParams = React.useCallback(async () => {
    setParamPanelOpen(true);
    setParamBusy(true);
    setParamInfo('');
    try {
      const result = await readRobotArmControlParams({ onProgress: setParamProgress });
      const matched = paramRows.filter((x) => Boolean(result?.[x.key])).length;
      applyReadResultToRows(result);
      setParamInfo(matched > 0 ? t('arm_params_read_done') : t('arm_params_damiao_only'));
    } catch (e) {
      setParamInfo(`${t('arm_params_read_failed')}: ${e.message || e}`);
    } finally {
      setParamBusy(false);
    }
  }, [applyReadResultToRows, paramRows, readRobotArmControlParams, t]);

  const writeParams = React.useCallback(async () => {
    setParamPanelOpen(true);
    setParamBusy(true);
    setParamInfo('');
    try {
      const blockedRows = paramRows.filter((x) => String(x?.hit?.vendor) === 'damiao' && (!x.loaded || x.error));
      if (blockedRows.length > 0) {
        throw new Error(`read parameters first for joints: ${blockedRows.map((x) => `J${x.joint}`).join(', ')}`);
      }

      const rows = paramRows.map((x) => ({
        key: x.key,
        joint: x.joint,
        hit: x.hit,
        values: Object.fromEntries(
          writableParamDefs.map((def) => {
            const fallback = def.defaultValue === '' ? 0 : Number(def.defaultValue);
            let parsed = parseNum(x.values?.[def.key], fallback);
            if (def.key === 'ctrlMode') parsed = Math.max(1, Math.min(4, Math.round(parsed)));
            if (def.dataType === 'u32') parsed = Math.max(0, Math.round(parsed));
            return [def.key, parsed];
          }),
        ),
      }));
      const riskyKeys = riskyParamDefs.map((def) => def.key);
      const changedRisky = rows.some((row) =>
        riskyKeys.some(
          (key) => String(row.values?.[key] ?? '') !== String(paramRows.find((x) => x.key === row.key)?.values?.[key] ?? ''),
        ),
      );
      if (changedRisky) {
        const confirmed = await askZeroConfirm({
          title: 'Confirm risky parameter write',
          message: 'About to write ESC_ID / MST_ID / TIMEOUT / can_br for all loaded joints.\n\nOnly continue if IDs and bus settings are confirmed.',
          danger: true,
        });
        if (!confirmed) return;
      }
      const writeResult = await writeRobotArmControlParams(rows, { onProgress: setParamProgress });
      const readBack = await readRobotArmControlParams({ onProgress: setParamProgress });
      applyReadResultToRows(readBack);

      const targetByKey = new Map(rows.map((x) => [x.key, x.values]));
      let mismatch = 0;
      let checked = 0;
      Object.entries(readBack || {}).forEach(([key, item]) => {
        const target = targetByKey.get(key);
        if (!target || !item?.ok) return;
        const actual = item.values || {};
        checked += 1;
        const same = writableParamDefs.every((def) => {
          const lhs = Number(actual[def.key]);
          const rhs = Number(target[def.key]);
          return def.dataType === 'u32'
            ? Math.round(lhs) === Math.round(rhs)
            : closeEnough(lhs, rhs, 1e-6);
        });
        if (!same) mismatch += 1;
      });

      const writeFailed = Object.values(writeResult || {}).filter((x) => x?.ok === false).length;
      if (writeFailed > 0) {
        setParamInfo(`${t('arm_params_write_failed')}: ${writeFailed}`);
      } else if (checked > 0 && mismatch === 0) {
        setParamInfo(t('arm_params_verify_ok'));
      } else if (checked > 0) {
        setParamInfo(`${t('arm_params_verify_mismatch')}: ${mismatch}`);
      } else {
        setParamInfo(t('arm_params_write_done'));
      }
    } catch (e) {
      setParamInfo(`${t('arm_params_write_failed')}: ${e.message || e}`);
    } finally {
      setParamBusy(false);
    }
  }, [
    applyReadResultToRows,
    askZeroConfirm,
    closeEnough,
    paramRows,
    readRobotArmControlParams,
    riskyParamDefs,
    t,
    writableParamDefs,
    writeRobotArmControlParams,
  ]);

  const applyDefaultTemplate = React.useCallback(() => {
    setParamPanelOpen(true);
    setParamRows((prev) =>
      prev.map((row) => {
        const tpl = REBOT_ARM_DAMIAO_DEFAULT_TEMPLATE[row.joint];
        if (!tpl) return row;
        return {
          ...row,
          values: {
            ...row.values,
            ...tpl,
          },
        };
      }),
    );
    setParamInfo(t('arm_params_template_applied'));
  }, [t]);

  const canWriteParams = React.useMemo(
    () => paramRows.length > 0 && paramRows.every((row) => String(row?.hit?.vendor) !== 'damiao' || (row.loaded && !row.error)),
    [paramRows],
  );

  const manager = {
    paramPanelOpen,
    paramBusy,
    readParams,
    writeParams,
    applyDefaultTemplate,
    paramTable: (
      <ParamTable
        open={paramPanelOpen}
        canAction={canAction}
        armToolbarBusy={armToolbarBusy}
        paramBusy={paramBusy}
        paramInfo={paramInfo}
        paramProgress={paramProgress}
        paramRows={paramRows}
        paramDefs={damiaoParamDefs}
        canWriteParams={canWriteParams}
        patchParam={patchParam}
        readParams={readParams}
        writeParams={writeParams}
        applyDefaultTemplate={applyDefaultTemplate}
        onClose={() => setParamPanelOpen(false)}
      />
    ),
  };

  return children(manager);
}

const SAFE_DEMO_TARGETS = {
  1: 0.4,
  2: -0.3,
  3: -0.4,
  4: -0.2,
  5: -0.5,
  6: 0.5,
  7: -2.0,
};

export function SequenceManager({
  rowsRef,
  demoToast,
  setDemoToast,
  scanRobotArmAll,
  enableAllRobotArm,
  patchControl,
  controlMotor,
  limits,
  children,
}) {
  const { t } = useI18n();
  const [demoAction, setDemoAction] = React.useState('safe_seq');
  const [demoBusy, setDemoBusy] = React.useState(false);

  React.useEffect(() => {
    if (!demoToast.visible || demoBusy) return undefined;
    const timer = setTimeout(() => {
      setDemoToast((prev) => ({ ...prev, visible: false }));
    }, 2600);
    return () => clearTimeout(timer);
  }, [demoToast, demoBusy, setDemoToast]);

  const showDemoToast = React.useCallback((tone, title, detail = '') => {
    setDemoToast((prev) => ({
      visible: true,
      seq: prev.seq + 1,
      tone,
      title,
      detail,
    }));
  }, [setDemoToast]);

  const runDemo = React.useCallback(async () => {
    if (demoBusy) return;

    const getOnlineRows = () => {
      const rows = rowsRef.current || [];
      const onlineRows = rows.filter((row) => Boolean(row?.hit?.online));
      return onlineRows.length > 0 ? onlineRows : [];
    };

    setDemoBusy(true);
    try {
      if (demoAction === 'safe_seq_scan') {
        showDemoToast('info', t('arm_demo_running', { name: t('arm_demo_safe_seq_scan') }), t('arm_demo_scan'));
        await scanRobotArmAll();
        await sleep(120);
        await enableAllRobotArm();
      }

      const onlineRows = getOnlineRows();
      if (onlineRows.length === 0) {
        showDemoToast('warn', t('arm_demo_failed'), t('arm_demo_no_online'));
        return;
      }
      const targets = [...onlineRows].sort((a, b) => Number(a.joint) - Number(b.joint)).slice(0, 7);
      const seq = [];
      targets.forEach((row) => {
        seq.push({
          row,
          target: Number(SAFE_DEMO_TARGETS[row.joint] ?? 0.25),
          phase: 'forward',
        });
      });
      [...targets].reverse().forEach((row) => {
        seq.push({ row, target: 0, phase: 'reset' });
      });

      const namedSeq = seq.map((step, idx) => ({
        ...step,
        note: t(`arm_demo_phase_${step.phase}`),
        index: idx + 1,
      }));
      let okCount = 0;
      const demoName = demoAction === 'safe_seq_scan' ? t('arm_demo_safe_seq_scan') : t('arm_demo_safe_seq');
      for (const step of namedSeq) {
        const lim = jointLimit(step.row.joint, limits);
        const target = clampByLimit(Number(step.target), lim);
        const mode = armPreferredMode();
        patchControl(step.row.key, { mode, target: String(target) });
        showDemoToast(
          'info',
          t('arm_demo_running', { name: demoName }),
          t('arm_demo_step_phase', {
            step: step.index,
            total: namedSeq.length,
            joint: `J${step.row.joint}`,
            phase: step.note,
            target: target.toFixed(3),
          }),
        );
        const ok = await controlMotor(step.row.hit, 'move', {
          mode,
          target: String(target),
        });
        if (ok) okCount += 1;
        await sleep(300);
      }

      showDemoToast(
        okCount === namedSeq.length ? 'ok' : 'warn',
        okCount === namedSeq.length ? t('arm_demo_done') : t('arm_demo_failed'),
        t('arm_demo_result', { ok: okCount, total: namedSeq.length }),
      );
    } catch (e) {
      showDemoToast('warn', t('arm_demo_failed'), e?.message || String(e));
    } finally {
      setDemoBusy(false);
    }
  }, [
    controlMotor,
    demoAction,
    demoBusy,
    enableAllRobotArm,
    limits,
    patchControl,
    rowsRef,
    scanRobotArmAll,
    showDemoToast,
    t,
  ]);

  return children({ demoAction, setDemoAction, demoBusy, runDemo });
}

export function TrailManager({ children }) {
  const { t } = useI18n();
  const [urdfResetSeq, setUrdfResetSeq] = React.useState(0);
  const [urdfClearTrailSeq, setUrdfClearTrailSeq] = React.useState(0);
  const [urdfExportTrailSeq, setUrdfExportTrailSeq] = React.useState(0);
  const [urdfReplaySeq, setUrdfReplaySeq] = React.useState(0);
  const [urdfReplayStopSeq, setUrdfReplayStopSeq] = React.useState(0);
  const [urdfReplayFinishSeq, setUrdfReplayFinishSeq] = React.useState(0);
  const [urdfReplayBusy, setUrdfReplayBusy] = React.useState(false);
  const [urdfReplaySpeed, setUrdfReplaySpeed] = React.useState(1);
  const [urdfTrailStyle, setUrdfTrailStyle] = React.useState('multi');
  const [urdfTrailColor, setUrdfTrailColor] = React.useState('#ff2d55');
  const [urdfTrailVisible, setUrdfTrailVisible] = React.useState(true);
  const [urdfImportedTrail, setUrdfImportedTrail] = React.useState(null);
  const [urdfImportInfo, setUrdfImportInfo] = React.useState('');
  const [urdfSeqLibrary, setUrdfSeqLibrary] = usePersistedState(
    'motorbridge_studio_arm_seq_library_v1',
    [],
    (cached) => (Array.isArray(cached) ? cached.filter((x) => x && Array.isArray(x.points) && x.points.length >= 2) : []),
  );
  const [urdfSeqPick, setUrdfSeqPick] = React.useState('');
  const importTrailInputRef = React.useRef(null);

  const openImportTrailDialog = React.useCallback(() => {
    importTrailInputRef.current?.click();
  }, []);

  const onImportTrailFile = React.useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const rawPoints = Array.isArray(json?.points)
          ? json.points
          : Array.isArray(json?.sequence)
            ? json.sequence
            : Array.isArray(json?.waypoints)
              ? json.waypoints
              : [];
        const points = rawPoints
          .map((p) => {
            if (Array.isArray(p) && p.length >= 3) {
              return { x: Number(p[0]), y: Number(p[1]), z: Number(p[2]) };
            }
            if (p && typeof p === 'object') {
              const joints = p.joints && typeof p.joints === 'object' ? p.joints : undefined;
              if (p.pos && typeof p.pos === 'object') {
                return { x: Number(p.pos.x), y: Number(p.pos.y), z: Number(p.pos.z), ...(joints ? { joints } : {}) };
              }
              return { x: Number(p.x), y: Number(p.y), z: Number(p.z), ...(joints ? { joints } : {}) };
            }
            return null;
          })
          .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
        if (points.length < 2) throw new Error('invalid trajectory points');
        setUrdfImportedTrail({
          name: file.name,
          points,
          at: Date.now(),
        });
        setUrdfImportInfo(t('arm_traj_import_ok', { count: points.length }));
        setUrdfTrailVisible(true);
      } catch (err) {
        setUrdfImportInfo(`${t('arm_traj_import_fail')}: ${err?.message || String(err)}`);
      } finally {
        if (e.target) e.target.value = '';
      }
    },
    [t],
  );

  const replayImportedTrail = React.useCallback(() => {
    if (!urdfImportedTrail?.points?.length) {
      setUrdfImportInfo(t('arm_traj_replay_need_import'));
      return;
    }
    setUrdfReplaySeq((v) => v + 1);
  }, [urdfImportedTrail, t]);

  React.useEffect(() => {
    if (!urdfSeqLibrary.length) {
      if (urdfSeqPick) setUrdfSeqPick('');
      return;
    }
    const exists = urdfSeqLibrary.some((x) => x.id === urdfSeqPick);
    if (!exists) setUrdfSeqPick(urdfSeqLibrary[0].id);
  }, [urdfSeqLibrary, urdfSeqPick]);

  const saveCurrentSequenceToLibrary = React.useCallback(() => {
    if (!urdfImportedTrail?.points?.length) {
      setUrdfImportInfo(t('arm_seq_save_need_import'));
      return;
    }
    const now = Date.now();
    const base = String(urdfImportedTrail.name || '').replace(/\.json$/i, '').trim();
    const name = base || `seq_${new Date(now).toLocaleTimeString()}`;
    const item = {
      id: `seq_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      at: now,
      points: urdfImportedTrail.points,
    };
    setUrdfSeqLibrary((prev) => [item, ...prev].slice(0, 64));
    setUrdfSeqPick(item.id);
    setUrdfImportInfo(t('arm_seq_saved', { name: item.name }));
  }, [setUrdfSeqLibrary, t, urdfImportedTrail]);

  const loadSelectedSequence = React.useCallback(
    (opts = { replay: false }) => {
      const item = urdfSeqLibrary.find((x) => x.id === urdfSeqPick);
      if (!item) {
        setUrdfImportInfo(t('arm_seq_load_need_select'));
        return;
      }
      setUrdfImportedTrail({
        name: `${item.name}.json`,
        points: item.points,
        at: Date.now(),
      });
      setUrdfTrailVisible(true);
      setUrdfImportInfo(t('arm_seq_loaded', { name: item.name, count: item.points.length }));
      if (opts?.replay) setUrdfReplaySeq((v) => v + 1);
    },
    [t, urdfSeqLibrary, urdfSeqPick],
  );

  const deleteSelectedSequence = React.useCallback(() => {
    const item = urdfSeqLibrary.find((x) => x.id === urdfSeqPick);
    if (!item) return;
    setUrdfSeqLibrary((prev) => prev.filter((x) => x.id !== item.id));
    setUrdfImportInfo(t('arm_seq_deleted', { name: item.name }));
  }, [setUrdfSeqLibrary, t, urdfSeqLibrary, urdfSeqPick]);

  const manager = {
    urdfResetSeq,
    urdfClearTrailSeq,
    urdfExportTrailSeq,
    urdfReplaySeq,
    urdfReplayStopSeq,
    urdfReplayFinishSeq,
    urdfReplayBusy,
    urdfReplaySpeed,
    urdfSimMode: 'trajectory',
    urdfTrailStyle,
    urdfTrailColor,
    urdfTrailVisible,
    urdfImportedTrail,
    urdfImportInfo,
    urdfSeqLibrary,
    urdfSeqPick,
    setUrdfResetSeq,
    setUrdfClearTrailSeq,
    setUrdfExportTrailSeq,
    setUrdfReplayStopSeq,
    setUrdfReplayFinishSeq,
    setUrdfReplaySpeed,
    setUrdfTrailStyle,
    setUrdfTrailColor,
    setUrdfTrailVisible,
    setUrdfSeqPick,
    setUrdfReplayBusy,
    openImportTrailDialog,
    replayImportedTrail,
    saveCurrentSequenceToLibrary,
    loadSelectedSequence,
    deleteSelectedSequence,
  };

  return (
    <>
      {children(manager)}
      <input
        ref={importTrailInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onImportTrailFile}
      />
    </>
  );
}
