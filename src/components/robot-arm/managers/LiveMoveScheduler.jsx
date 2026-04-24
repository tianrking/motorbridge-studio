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
          patchControl(pending.row.key, { target: checked.clamped });
        } else {
          setLimitWarn('');
        }
        controlMotor(pending.row.hit, 'move', { target: checked.clamped });
      }, 80);
    },
    [armBulkBusy, clampTargetForRow, connected, controlMotor, liveMove, patchControl, setLimitWarn, showLimitToast, t],
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
