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
  const liveMoveLoopRef = React.useRef(null);
  const latestTargetRef = React.useRef(null);
  const inFlightRef = React.useRef(false);
  const generationRef = React.useRef(0);

  const stopLiveMoveLoop = React.useCallback(() => {
    generationRef.current += 1;
    latestTargetRef.current = null;
    if (liveMoveLoopRef.current) {
      clearInterval(liveMoveLoopRef.current);
      liveMoveLoopRef.current = null;
    }
  }, []);

  React.useEffect(() => stopLiveMoveLoop, [stopLiveMoveLoop]);

  React.useEffect(() => {
    if (armBulkBusy || !connected || !liveMove) stopLiveMoveLoop();
  }, [armBulkBusy, connected, liveMove, stopLiveMoveLoop]);

  React.useEffect(() => {
    stopLiveMoveLoop();
  }, [activeRow?.key, activeRow?.control?.mode, stopLiveMoveLoop]);

  const clampTargetForRow = React.useCallback(
    (row, rawText) => {
      const lim = jointLimit(row.joint, limits);
      const raw = parseNum(rawText, 0);
      const clamped = clampByLimit(raw, lim);
      return { raw, clamped, clipped: Math.abs(raw - clamped) > 1e-9, lim };
    },
    [limits]
  );

  const flushLatestTarget = React.useCallback(async () => {
    if (inFlightRef.current) return;
    const pending = latestTargetRef.current;
    if (!pending) return;
    const gen = generationRef.current;
    inFlightRef.current = true;
    try {
      const checked = clampTargetForRow(pending.row, pending.targetText);
      if (generationRef.current !== gen) return;
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
      const sentVersion = pending.version;
      const ok = await controlMotor(
        pending.row.hit,
        'move',
        { target: checked.clamped },
        { shouldCancel: () => generationRef.current !== gen }
      );
      if (generationRef.current !== gen) return;
      if (ok) {
        const current = latestTargetRef.current;
        if (current?.version === sentVersion) {
          latestTargetRef.current = null;
          if (liveMoveLoopRef.current) {
            clearInterval(liveMoveLoopRef.current);
            liveMoveLoopRef.current = null;
          }
        }
        return;
      }
      const current = latestTargetRef.current;
      if (current?.version !== sentVersion) return;

      const refreshed =
        typeof refreshMotorState === 'function' ? await refreshMotorState(pending.row.hit) : null;
      if (generationRef.current !== gen) return;
      const actualPos = Number(refreshed?.pos);
      const fallbackTarget = Number.isFinite(actualPos) ? actualPos : pending.previousTarget;
      patchControl(pending.row.key, { target: fallbackTarget });
      const msg = t('arm_live_move_failed');
      setLimitWarn(msg);
      showLimitToast(msg);
    } finally {
      inFlightRef.current = false;
    }
  }, [
    clampTargetForRow,
    controlMotor,
    patchControl,
    refreshMotorState,
    setLimitWarn,
    showLimitToast,
    t,
  ]);

  const scheduleLiveMove = React.useCallback(
    (row, targetText) => {
      if (!liveMove || !connected || armBulkBusy) return;
      if (String(row?.control?.mode) === 'mit') return;
      const hit = row?.hit;
      if (!hit) return;
      latestTargetRef.current = {
        row,
        targetText,
        previousTarget: row?.control?.target,
        version: (latestTargetRef.current?.version || 0) + 1,
      };
      if (!liveMoveLoopRef.current) {
        flushLatestTarget();
        liveMoveLoopRef.current = setInterval(flushLatestTarget, 80);
      }
    },
    [armBulkBusy, connected, flushLatestTarget, liveMove]
  );

  const cancelLiveMove = React.useCallback(() => {
    stopLiveMoveLoop();
  }, [stopLiveMoveLoop]);

  const runExclusive = React.useCallback(
    (fn) => {
      cancelLiveMove();
      return fn();
    },
    [cancelLiveMove]
  );

  const moveOnce = React.useCallback(
    async (row) => {
      cancelLiveMove();
      const checked = clampTargetForRow(row, row.control.target);
      if (checked.clipped) {
        const msg = t('arm_limit_blocked', {
          joint: row.joint,
          req: checked.raw.toFixed(3),
          min: checked.lim.min.toFixed(3),
          max: checked.lim.max.toFixed(3),
          use: checked.clamped.toFixed(3),
        });
        setLimitWarn(msg);
        showLimitToast(msg);
        patchControl(row.key, { target: checked.clamped });
      } else {
        setLimitWarn('');
      }
      return controlMotor(row.hit, 'move', { target: checked.clamped });
    },
    [cancelLiveMove, clampTargetForRow, controlMotor, patchControl, setLimitWarn, showLimitToast, t]
  );

  const onSliderTargetChange = React.useCallback(
    (targetText) => {
      if (!activeRow) return;
      patchControl(activeRow.key, { target: parseNum(targetText, activeRow.control?.target ?? 0) });
      scheduleLiveMove(activeRow, targetText);
    },
    [activeRow, patchControl, scheduleLiveMove]
  );

  return children({
    cancelLiveMove,
    clampTargetForRow,
    moveOnce,
    onSliderTargetChange,
    runExclusive,
  });
}
