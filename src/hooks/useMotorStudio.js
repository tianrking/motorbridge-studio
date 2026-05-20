import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motorKey, normalizeControlForHit, ts } from '../lib/utils';
import { mapResponseToHit } from '../lib/motorStudioOps';
import { usePersistedState } from './usePersistedState';
import { useI18n } from '../i18n';
import { useConnectionState } from './useConnectionState';
import { usePreferences } from './usePreferences';
import { useScanState } from './useScanState';
import { useMotorControl } from './useMotorControl';
import { useRobotArmOps } from './useRobotArmOps';

const LS_HITS_KEY = 'motorbridge_studio_hits_v1';
const LS_CONTROLS_KEY = 'motorbridge_studio_controls_v1';
const LS_ACTIVE_MOTOR_KEY = 'motorbridge_studio_active_motor_v1';

export function useMotorStudio() {
  const { t } = useI18n();

  const [hits, setHits] = usePersistedState(LS_HITS_KEY, [], (cached) =>
    Array.isArray(cached) ? cached : []
  );
  const [controls, setControls] = usePersistedState(LS_CONTROLS_KEY, {}, (cached) =>
    cached && typeof cached === 'object' ? cached : {}
  );
  const [activeMotorKey, setActiveMotorKey] = usePersistedState(
    LS_ACTIVE_MOTOR_KEY,
    '',
    (cached) => (typeof cached === 'string' ? cached : '')
  );

  const [selected, setSelected] = useState(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [stateSnapshot, setStateSnapshot] = useState('(no state yet)');
  const [logs, setLogs] = useState([]);
  const telemetryTargetRef = useRef('');

  const pushLog = (msg, level = 'info') => {
    setLogs((prev) => [...prev, { t: ts(), msg, level }].slice(-500));
  };

  const handleGatewayState = useCallback(
    (state) => {
      setHits((prev) => {
        if (!activeMotorKey) return prev;
        const index = prev.findIndex((h) => motorKey(h) === activeMotorKey);
        if (index < 0) return prev;
        const current = prev[index];
        if (state?.vendor && String(state.vendor) !== String(current.vendor)) return prev;
        const next = [...prev];
        next[index] = mapResponseToHit(current, state);
        return next;
      });
    },
    [activeMotorKey, setHits]
  );

  const connectionState = useConnectionState({
    pushLog,
    setStateSnapshot,
    onGatewayState: handleGatewayState,
  });
  const preferences = usePreferences();

  const scanState = useScanState({
    t,
    connected: connectionState.connected,
    scanTimeoutMs: connectionState.scanTimeoutMs,
    activeMotorKey,
    setActiveMotorKey,
    setHits,
    setControls,
    pushLog,
    closeBusQuietly: connectionState.closeBusQuietly,
    setTargetFor: connectionState.setTargetFor,
    sendCmd: connectionState.sendCmd,
  });

  const [armBulkBusyForControl, setArmBulkBusyForControl] = useState(false);
  const motorControl = useMotorControl({
    t,
    vendors: scanState.vendors,
    controls,
    setHits,
    setControls,
    pushLog,
    setTargetFor: connectionState.setTargetFor,
    sendCmd: connectionState.sendCmd,
    closeBusQuietly: connectionState.closeBusQuietly,
    armBulkBusy: armBulkBusyForControl,
    askConfirm: scanState.askConfirm,
  });

  const robotArmState = useRobotArmOps({
    connected: connectionState.connected,
    vendors: scanState.vendors,
    hits,
    setHits,
    controls,
    setControls,
    activeMotorKey,
    setActiveMotorKey,
    pushLog,
    controlMotor: motorControl.controlMotor,
    zeroMotor: motorControl.zeroMotor,
    probeMotor: motorControl.probeMotor,
    setTargetFor: connectionState.setTargetFor,
    sendCmd: connectionState.sendCmd,
    closeBusQuietly: connectionState.closeBusQuietly,
  });

  useEffect(() => {
    setArmBulkBusyForControl(robotArmState.armBulkBusy);
  }, [robotArmState.armBulkBusy]);

  useEffect(() => {
    if (!activeMotorKey) return;
    const exists = hits.some((h) => motorKey(h) === activeMotorKey);
    if (!exists) setActiveMotorKey('');
  }, [hits, activeMotorKey, setActiveMotorKey]);

  const selectedHits = useMemo(
    () => hits.filter((h) => selected.has(motorKey(h))),
    [hits, selected]
  );
  const activeMotor = useMemo(
    () => hits.find((h) => motorKey(h) === activeMotorKey) || null,
    [hits, activeMotorKey]
  );
  const activeControl = activeMotor
    ? normalizeControlForHit(activeMotor, controls[motorKey(activeMotor)])
    : null;

  useEffect(() => {
    if (!connectionState.connected) {
      telemetryTargetRef.current = '';
      return;
    }
    if (!activeMotor) return;
    const key = `${motorKey(activeMotor)}:${activeMotor.model || activeMotor.model_guess || ''}`;
    if (telemetryTargetRef.current === key) return;
    telemetryTargetRef.current = key;
    connectionState
      .setTargetFor(
        activeMotor.vendor,
        activeMotor.model || scanState.vendors?.[activeMotor.vendor]?.model || activeMotor.vendor,
        activeMotor.esc_id,
        activeMotor.mst_id
      )
      .catch((e) => {
        telemetryTargetRef.current = '';
        pushLog(`telemetry target setup failed: ${e.message || e}`, 'err');
      });
  }, [activeMotor, connectionState, scanState.vendors]);

  const clearLogs = () => setLogs([]);
  const clearOfflineMotors = useCallback(
    () => scanState.clearOfflineMotors(hits, setSelected),
    [hits, scanState]
  );
  const removeMotorCard = useCallback(
    (hit) => scanState.removeMotorCard(hit, setSelected),
    [scanState]
  );
  const clearDevices = useCallback(async () => {
    const cleared = await scanState.clearDevices();
    if (cleared) setSelected(new Set());
  }, [scanState]);

  const canAction = connectionState.connected && !scanState.scanBusy && !robotArmState.armBulkBusy;

  const connection = useMemo(
    () => ({
      wsUrl: connectionState.wsUrl,
      setWsUrl: connectionState.setWsUrl,
      channel: connectionState.channel,
      setChannel: connectionState.setChannel,
      scanTimeoutMs: connectionState.scanTimeoutMs,
      setScanTimeoutMs: connectionState.setScanTimeoutMs,
      connText: connectionState.connText,
      connected: connectionState.connected,
      targetTransport: connectionState.targetTransport,
      targetSerialPort: connectionState.targetSerialPort,
      gatewayCapabilities: connectionState.gatewayCapabilities,
      capabilitiesSource: connectionState.capabilitiesSource,
      connectWs: connectionState.connectWs,
      disconnectWs: connectionState.disconnectWs,
      sendCmd: connectionState.sendCmd,
      canAction,
    }),
    [connectionState, canAction]
  );

  const scan = useMemo(
    () => ({
      scanBusy: scanState.scanBusy,
      scanProgress: scanState.scanProgress,
      scanFoundFx: scanState.scanFoundFx,
      vendors: scanState.vendors,
      setVendors: scanState.setVendors,
      hits,
      selectedHits,
      activeMotor,
      activeControl,
      activeMotorKey,
      setActiveMotorKey,
      newCardKeys: scanState.newCardKeys,
      manualDraft: scanState.manualDraft,
      setManualDraft: scanState.setManualDraft,
      cardRefs: scanState.cardRefs,
      confirmDialog: scanState.confirmDialog,
      closeConfirmDialog: scanState.closeConfirmDialog,
      runScan: scanState.runScan,
      removeMotorCard,
      moveMotorCard: scanState.moveMotorCard,
      addManualCard: scanState.addManualCard,
      clearDevices,
      clearOfflineMotors,
    }),
    [
      activeControl,
      activeMotor,
      activeMotorKey,
      clearDevices,
      clearOfflineMotors,
      hits,
      removeMotorCard,
      scanState,
      selectedHits,
      setActiveMotorKey,
    ]
  );

  const control = useMemo(
    () => ({
      controls,
      patchControl: motorControl.patchControl,
      controlMotor: motorControl.controlMotor,
      zeroMotor: motorControl.zeroMotor,
      verifyHit: motorControl.verifyHit,
      setIdFor: motorControl.setIdFor,
      refreshMotorState: motorControl.refreshMotorState,
      runMotorOp: motorControl.runMotorOp,
      probeMotor: motorControl.probeMotor,
    }),
    [controls, motorControl]
  );

  const robotArm = useMemo(
    () => ({
      robotArmModel: robotArmState.robotArmModel,
      armScanBusy: robotArmState.armScanBusy,
      armScanProgress: robotArmState.armScanProgress,
      armBulkBusy: robotArmState.armBulkBusy,
      armSelfCheckBusy: robotArmState.armSelfCheckBusy,
      armSelfCheckProgress: robotArmState.armSelfCheckProgress,
      armSelfCheckReport: robotArmState.armSelfCheckReport,
      setRobotArmModel: robotArmState.setRobotArmModel,
      robotArmJointRows: robotArmState.robotArmJointRows,
      ensureRobotArmCards: robotArmState.ensureRobotArmCards,
      scanRobotArmJoint: robotArmState.scanRobotArmJoint,
      scanRobotArmAll: robotArmState.scanRobotArmAll,
      runRobotArmSelfCheck: robotArmState.runRobotArmSelfCheck,
      enableAllRobotArm: robotArmState.enableAllRobotArm,
      disableAllRobotArm: robotArmState.disableAllRobotArm,
      zeroAllRobotArm: robotArmState.zeroAllRobotArm,
      resetPoseRobotArm: robotArmState.resetPoseRobotArm,
      readRobotArmControlParams: robotArmState.readRobotArmControlParams,
      writeRobotArmControlParams: robotArmState.writeRobotArmControlParams,
    }),
    [robotArmState]
  );

  const logsDomain = useMemo(
    () => ({
      stateSnapshot,
      logs,
      clearLogs,
    }),
    [stateSnapshot, logs]
  );

  const workspace = useMemo(
    () => ({
      menuOpen,
      setMenuOpen,
    }),
    [menuOpen]
  );

  return useMemo(
    () => ({
      connection,
      scan,
      control,
      robotArm,
      preferences,
      logs: logsDomain,
      workspace,
    }),
    [connection, control, logsDomain, preferences, robotArm, scan, workspace]
  );
}
