import React from 'react';
import './simu.css';
import { SimuLeftNav, SimuRightPanel, SimuViewport } from './components';
import { useSimuBridge, useSimuState } from './hooks';

const VIEWER_Y_OFFSET = 0.02;
function backendToViewerPose(p) {
  const x = Number(p?.x || 0);
  const y = Number(p?.y || 0);
  const z = Number(p?.z || 0);
  return { ...p, x, y: z + VIEWER_Y_OFFSET, z: -y };
}

function naturalWaypointCompare(a, b) {
  const ax = String(a?.id || '');
  const bx = String(b?.id || '');
  const am = ax.match(/^([A-Za-z]+)(\d+)$/);
  const bm = bx.match(/^([A-Za-z]+)(\d+)$/);
  if (am && bm && am[1] === bm[1]) return Number(am[2]) - Number(bm[2]);
  return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: 'base' });
}

export function SimuPage() {
  const state = useSimuState();
  const bridge = useSimuBridge();
  const {
    followWsState,
    localWaypoints,
    setEditPose,
    setSelectedWaypointId,
    setSequenceIds,
    setTargets,
    setWaypointId,
    setWaypointLabel,
    syncToWs,
    targets,
  } = state;
  const { connected, latestState, send } = bridge;
  const waypointsSig = React.useMemo(
    () => JSON.stringify(latestState?.waypoints || {}),
    [latestState?.waypoints],
  );
  const waypointList = React.useMemo(() => {
    const remote = JSON.parse(waypointsSig || '{}');
    const w = { ...(localWaypoints || {}), ...remote };
    return Object.entries(w).map(([id, p]) => ({
      id,
      label: String(p?.label || p?.name || id),
      x: Number(p?.x || 0),
      y: Number(p?.y || 0),
      z: Number(p?.z || 0),
      roll: Number(p?.roll || 0),
      pitch: Number(p?.pitch || 0),
      yaw: Number(p?.yaw || 0),
    })).sort(naturalWaypointCompare);
  }, [waypointsSig, localWaypoints]);
  const enhancedState = {
    ...state,
    waypointList,
    selectWaypoint: (wp) => {
      setSelectedWaypointId(wp.id);
      setWaypointId(wp.id);
      setWaypointLabel(wp.label || wp.id);
      const pv = backendToViewerPose(wp);
      setEditPose({
        x: pv.x, y: pv.y, z: pv.z, roll: wp.roll, pitch: wp.pitch, yaw: wp.yaw,
      });
    },
  };

  React.useEffect(() => {
    const ids = waypointList.map((w) => w.id);
    setSequenceIds((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const append = ids.filter((id) => !kept.includes(id));
      return [...kept, ...append];
    });
  }, [setSequenceIds, waypointList]);

  React.useEffect(() => {
    if (!syncToWs || !connected) return;
    const t = setTimeout(() => {
      send('sim_set_joint_targets', { targets }, 1200).catch(() => {});
    }, 80);
    return () => clearTimeout(t);
  }, [connected, send, syncToWs, targets]);

  React.useEffect(() => {
    if (!followWsState || !latestState?.joint_targets) return;
    const jt = latestState.joint_targets;
    setTargets((prev) => ({
      ...prev,
      joint1: Number(jt.joint1 ?? prev.joint1),
      joint2: Number(jt.joint2 ?? prev.joint2),
      joint3: Number(jt.joint3 ?? prev.joint3),
      joint4: Number(jt.joint4 ?? prev.joint4),
      joint5: Number(jt.joint5 ?? prev.joint5),
      joint6: Number(jt.joint6 ?? prev.joint6),
      joint7: Number(jt.joint7 ?? prev.joint7),
    }));
  }, [followWsState, latestState, setTargets]);

  return (
    <div className="simu-root">
      <SimuLeftNav state={state} />
      <SimuViewport state={enhancedState} />
      <SimuRightPanel state={enhancedState} bridge={bridge} />
    </div>
  );
}
