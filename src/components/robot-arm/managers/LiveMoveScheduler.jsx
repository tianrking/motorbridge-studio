import React from 'react';
import { useI18n } from '../../../i18n';
import { parseNum } from '../../../lib/utils';
import { clampByLimit, jointLimit } from './armMotionUtils';

export function LiveMoveScheduler({
  activeRow,
  liveMove,
  connected,
  armBulkBusy,
  controlMotor,
  refreshMotorState,
  patchControl,
  setLimitWarn,
  showLimitToast,
  limits,
  children,
}) {
  const { t } = useI18n();
  const liveMoveTimerRef = React.useRef(null);
  const pendingLiveMoveRef = React.useRef(null);
  const moveSeqRef = React.useRef(0);

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
      const seq = moveSeqRef.current + 1;
      moveSeqRef.current = seq;
      pendingLiveMoveRef.current = { row, targetText, previousTarget: row?.control?.target, seq };
      if (liveMoveTimerRef.current) return;
      liveMoveTimerRef.current = setTimeout(async () => {
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
          patchControl(pending.row.key, { target: checked.clamped });
        } else {
          setLimitWarn('');
        }
        const ok = await controlMotor(pending.row.hit, 'move', { target: checked.clamped });
        if (ok || pending.seq !== moveSeqRef.current) return;

        const refreshed = typeof refreshMotorState === 'function'
          ? await refreshMotorState(pending.row.hit)
          : null;
        const actualPos = Number(refreshed?.pos);
        const fallbackTarget = Number.isFinite(actualPos) ? actualPos : pending.previousTarget;
        patchControl(pending.row.key, { target: fallbackTarget });
        const msg = t('arm_live_move_failed');
        setLimitWarn(msg);
        showLimitToast(msg);
      }, 80);
    },
    [
      armBulkBusy,
      clampTargetForRow,
      connected,
      controlMotor,
      liveMove,
      patchControl,
      refreshMotorState,
      setLimitWarn,
      showLimitToast,
      t,
    ],
  );

  const onSliderTargetChange = React.useCallback(
    (targetText) => {
      if (!activeRow) return;
      patchControl(activeRow.key, { target: parseNum(targetText, activeRow.control?.target ?? 0) });
      scheduleLiveMove(activeRow, targetText);
    },
    [activeRow, patchControl, scheduleLiveMove],
  );

  return children({ clampTargetForRow, onSliderTargetChange });
}
