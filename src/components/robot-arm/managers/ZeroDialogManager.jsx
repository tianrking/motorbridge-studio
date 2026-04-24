import React from 'react';
import { useI18n } from '../../../i18n';
import { sleep } from '../../../lib/async';
import { ZERO_SAFE_EPS_RAD } from '../../../lib/robotArm';
import { ZeroConfirmDialog } from '../ZeroConfirmDialog';
import { clampByLimit, jointLimit } from './armMotionUtils';

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
  const zeroCheckBusyRef = React.useRef(false);

  React.useEffect(() => {
    rowsRef.current = robotArmJointRows;
  }, [robotArmJointRows]);

  const computeZeroSafety = React.useCallback((rows) => {
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
  }, []);

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
    if (zeroCheckBusyRef.current) return;
    zeroCheckBusyRef.current = true;
    setZeroCheckBusy(true);
    try {
      const preRows = rowsRef.current || [];
      const refreshedRows = [];
      for (const row of preRows) {
        if (!row?.hit) {
          refreshedRows.push(row);
          continue;
        }
        const refreshedHit = await refreshMotorState(row.hit);
        refreshedRows.push({ ...row, hit: refreshedHit || { ...row.hit, pos: Number.NaN, online: false } });
        await sleep(20);
      }
      await sleep(80);

      const freshSafety = computeZeroSafety(refreshedRows);
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
      zeroCheckBusyRef.current = false;
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
