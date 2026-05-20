import React from 'react';
import { ArmUrdfViewer } from '../../components/ArmUrdfViewer';

const NAV_ITEMS = [
  { key: 'plan', label: 'Plan' },
  { key: 'manual', label: 'Manual' },
  { key: 'view', label: 'View' },
];

function waypointColor(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 78% 54%)`;
}

function hslToRgbInt(h, s, l) {
  const hp = h / 360;
  const sp = s / 100;
  const lp = l / 100;
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r = lp;
  let g = lp;
  let b = lp;
  if (sp !== 0) {
    const q = lp < 0.5 ? lp * (1 + sp) : lp + sp - lp * sp;
    const p = 2 * lp - q;
    r = hue2rgb(p, q, hp + 1 / 3);
    g = hue2rgb(p, q, hp);
    b = hue2rgb(p, q, hp - 1 / 3);
  }
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)) >>> 0;
}

const VIEWER_Y_OFFSET = 0.02;
const PLAN_BOUNDS = {
  xMin: -0.45, xMax: 0.45,
  yMin: 0.02, yMax: 0.55,
  zMin: -0.45, zMax: 0.45,
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function backendToViewerPose(p) {
  const x = Number(p?.x || 0);
  const y = Number(p?.y || 0);
  const z = Number(p?.z || 0);
  return {
    ...p,
    x,
    y: z + VIEWER_Y_OFFSET,
    z: -y,
  };
}

function viewerToBackendPose(p) {
  const x = Number(p?.x || 0);
  const y = Number(p?.y || 0);
  const z = Number(p?.z || 0);
  return {
    ...p,
    x,
    y: -z,
    z: y - VIEWER_Y_OFFSET,
  };
}

function clampViewerPose(p) {
  return {
    ...p,
    x: clamp(Number(p?.x || 0), PLAN_BOUNDS.xMin, PLAN_BOUNDS.xMax),
    y: clamp(Number(p?.y || 0), PLAN_BOUNDS.yMin, PLAN_BOUNDS.yMax),
    z: clamp(Number(p?.z || 0), PLAN_BOUNDS.zMin, PLAN_BOUNDS.zMax),
    roll: Number(p?.roll || 0),
    pitch: Number(p?.pitch || 0),
    yaw: Number(p?.yaw || 0),
  };
}

function validationTone(validation) {
  const grade = validation?.grade;
  if (grade === 'ok' || validation?.reachable) return 'ok';
  if (grade === 'near') return 'near';
  if (grade === 'out_of_reach') return 'bad';
  return 'idle';
}

export function SimuLeftNav({ state }) {
  return (
    <aside className="simu-left-nav">
      <div className="simu-brand">
        <span className="simu-brand-mark">M</span>
        <span>
          <strong>MotorBridge</strong>
          <small>Simulation</small>
        </span>
      </div>
      <div className="simu-nav-list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`simu-nav-btn ${state.activeSection === item.key ? 'active' : ''}`}
            onClick={() => state.setActiveSection(item.key)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="simu-nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function SimuViewport({ state }) {
  const normalizedMarkers = React.useMemo(() => state.waypointList.map((wp) => {
    const s = String(wp.id || '');
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) hash = (hash * 33 + s.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    const pv = backendToViewerPose(wp);
    return {
      id: wp.id,
      label: wp.label || wp.id,
      x: pv.x,
      y: pv.y,
      z: pv.z,
      color: hslToRgbInt(hue, 78, 54),
    };
  }), [state.waypointList]);
  const previewMarker = React.useMemo(() => {
    if (state.activeSection !== 'plan') return null;
    const p = clampViewerPose(state.editPose);
    return { id: 'preview', x: p.x, y: p.y, z: p.z, color: 0xffb020 };
  }, [state.activeSection, state.editPose]);
  const plannedPath = React.useMemo(() => {
    const byId = new Map(normalizedMarkers.map((wp) => [wp.id, wp]));
    return (state.sequenceIds || []).map((id) => byId.get(id)).filter(Boolean);
  }, [normalizedMarkers, state.sequenceIds]);
  return (
    <main className="simu-center">
      <div className="simu-stage-panel">
        <div className="simu-center-toolbar">
          <div className="simu-toolbar-title">
            <strong>Trajectory Workspace</strong>
            <span>{state.waypointList.length} points / {state.sequenceIds.length} queued</span>
          </div>
          <div className="simu-toolbar-actions">
            <button className="ghostBtn small" onClick={() => state.setResetViewSeq((x) => x + 1)}>Reset View</button>
            <button className="ghostBtn small" onClick={() => state.setClearTrailSeq((x) => x + 1)}>Clear Trail</button>
          </div>
        </div>
        <div className="simu-view-host">
          <div className="simu-view-fill">
            <ArmUrdfViewer
              jointTargets={state.targets}
              simMode="trajectory"
              resetViewSeq={state.resetViewSeq}
              clearTrailSeq={state.clearTrailSeq}
              exportTrailSeq={state.exportTrailSeq}
              replaySeq={state.replaySeq}
              replayStopSeq={state.replayStopSeq}
              replayFinishSeq={state.replayFinishSeq}
              replaySpeed={state.replaySpeed}
              importedTrail={state.importedTrail}
              trailColor={state.trailColor}
              trailVisible={state.trailVisible}
              waypointMarkers={normalizedMarkers}
              plannedPath={plannedPath}
              pickEnabled={state.pickMode}
              pickPlaneY={clamp(Number(state.pickPlaneY || 0.18), PLAN_BOUNDS.yMin, PLAN_BOUNDS.yMax)}
              pickBounds={PLAN_BOUNDS}
              previewMarker={previewMarker}
              onMarkerSelect={(id) => {
                const wp = state.waypointList.find((x) => x.id === id);
                if (wp) state.selectWaypoint(wp);
              }}
              onViewportClick={(p) => {
                if (!state.pickMode) return;
                state.setEditPose((prev) => ({
                  ...prev,
                  x: clamp(Number(p.x || 0), PLAN_BOUNDS.xMin, PLAN_BOUNDS.xMax),
                  y: clamp(Number(p.y || 0), PLAN_BOUNDS.yMin, PLAN_BOUNDS.yMax),
                  z: clamp(Number(p.z || 0), PLAN_BOUNDS.zMin, PLAN_BOUNDS.zMax),
                }));
              }}
              onPreviewDrag={(p) => {
                if (!state.pickMode) return;
                state.setEditPose((prev) => ({
                  ...prev,
                  x: clamp(Number(p.x ?? prev.x), PLAN_BOUNDS.xMin, PLAN_BOUNDS.xMax),
                  y: clamp(Number(p.y ?? prev.y), PLAN_BOUNDS.yMin, PLAN_BOUNDS.yMax),
                  z: clamp(Number(p.z ?? prev.z), PLAN_BOUNDS.zMin, PLAN_BOUNDS.zMax),
                }));
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function SimuBridgeDock({ state, bridge }) {
  return (
    <section className="simu-bridge-dock">
      <div className="simu-bridge-head">
        <span className={`simu-bridge-dot ${bridge.connected ? 'online' : ''}`} />
        <strong>{bridge.phaseLabel}</strong>
      </div>
      <input
        className="simu-ws-input"
        value={bridge.url}
        onChange={(e) => bridge.setUrl(e.target.value)}
        placeholder="ws://127.0.0.1:9011/ws or wss://your-backend/ws"
      />
      <div className="simu-bridge-actions">
        <button className="ghostBtn small" onClick={bridge.connectWs}>Connect</button>
        <button className="ghostBtn small" onClick={bridge.disconnectWs}>Disconnect</button>
        <button className="ghostBtn small" onClick={bridge.ping}>Ping</button>
        <button className="ghostBtn small" onClick={bridge.fetchBusSnapshot}>Bus</button>
      </div>
      <div className="simu-toggle-row">
        <label className="simu-field-check compact">
          <input type="checkbox" checked={state.syncToWs} onChange={(e) => state.setSyncToWs(e.target.checked)} />
          <span>Sync drag</span>
        </label>
        <label className="simu-field-check compact">
          <input type="checkbox" checked={state.followWsState} onChange={(e) => state.setFollowWsState(e.target.checked)} />
          <span>Follow state</span>
        </label>
      </div>
    </section>
  );
}

function JointPanel({ state }) {
  const jointValues = Array.from({ length: 7 }, (_, i) => Number(state.targets[`joint${i + 1}`] || 0));
  return (
    <>
      <div className="simu-panel-title">Joint Control</div>
      <section className="simu-card compact-card">
      <div className="simu-panel-actions">
        <button className="ghostBtn" onClick={state.setHome}>Home</button>
        <button className="ghostBtn" onClick={state.randomPose}>Random</button>
        <button className="ghostBtn" onClick={state.savePreset}>Save Preset</button>
        <button className="ghostBtn" onClick={state.resetWorkspace}>Reset Workspace</button>
        <button className="ghostBtn" onClick={state.clearPresets}>Clear Presets</button>
      </div>
      {state.presets.length > 0 && (
        <div className="simu-preset-list">
          {state.presets.map((p, i) => (
            <div className="simu-preset-item" key={`${p.name}-${i}`}>
              <button className="ghostBtn small" onClick={() => state.loadPreset(i)}>{p.name}</button>
              <button className="ghostBtn small" onClick={() => state.deletePreset(i)}>Del</button>
            </div>
          ))}
        </div>
      )}
      </section>
      {jointValues.map((v, i) => (
        <div key={`j-${i + 1}`} className="simu-joint-row simu-card">
          <div className="simu-joint-head">
            <span>J{i + 1}</span>
            <span>{v.toFixed(3)} rad</span>
          </div>
          <input
            className="simu-range"
            type="range"
            min={-3.14}
            max={3.14}
            step={0.001}
            value={v}
            onChange={(e) => state.setJoint(i, e.target.value)}
          />
          <div className="simu-inline-actions">
            <button className="ghostBtn small" onClick={() => state.nudgeJoint(i, -0.05)}>-0.05</button>
            <button className="ghostBtn small" onClick={() => state.nudgeJoint(i, 0.05)}>+0.05</button>
          </div>
        </div>
      ))}
    </>
  );
}

function TrajectoryPanel({ state }) {
  return (
    <>
      <div className="simu-panel-title">Trajectory</div>
      <section className="simu-card compact-card">
      <div className="simu-panel-actions">
        <button className="ghostBtn" onClick={() => state.setReplaySeq((x) => x + 1)}>Replay</button>
        <button className="ghostBtn" onClick={() => state.setReplayStopSeq((x) => x + 1)}>Stop</button>
        <button className="ghostBtn" onClick={() => state.setReplayFinishSeq((x) => x + 1)}>Jump End</button>
        <button className="ghostBtn" onClick={() => state.setClearTrailSeq((x) => x + 1)}>Clear Trail</button>
        <button className="ghostBtn" onClick={() => state.setExportTrailSeq((x) => x + 1)}>Export Trail</button>
      </div>
      <label className="simu-field dense">
        <span>Replay Speed ({state.replaySpeed.toFixed(2)}x)</span>
        <input
          className="simu-range"
          type="range"
          min={0.2}
          max={3}
          step={0.05}
          value={state.replaySpeed}
          onChange={(e) => state.setReplaySpeed(Number(e.target.value))}
        />
      </label>
      <label className="simu-field dense">
        <span>Import Trail JSON</span>
        <input type="file" accept=".json,application/json" onChange={(e) => state.importTrailFile(e.target.files?.[0])} />
      </label>
      <label className="simu-field dense">
        <span>Trail Color</span>
        <input type="color" value={state.trailColor} onChange={(e) => state.setTrailColor(e.target.value)} />
      </label>
      <label className="simu-field-check">
        <input type="checkbox" checked={state.trailVisible} onChange={(e) => state.setTrailVisible(e.target.checked)} />
        <span>Trail Visible</span>
      </label>
      </section>
    </>
  );
}

function ScenePanel({ state }) {
  return (
    <>
      <div className="simu-panel-title">Scene & View</div>
      <section className="simu-card compact-card">
      <div className="simu-panel-actions">
        <button className="ghostBtn" onClick={() => state.setResetViewSeq((x) => x + 1)}>Reset View</button>
        <button className="ghostBtn" onClick={() => state.setClearTrailSeq((x) => x + 1)}>Clear Trail</button>
        <button className="ghostBtn" onClick={state.captureScreenshot}>Screenshot</button>
      </div>
      </section>
    </>
  );
}

function PlanPanel({ state, bridge }) {
  const [busy, setBusy] = React.useState(false);
  const [validation, setValidation] = React.useState({ grade: 'idle', message: 'Connect WS to validate reachability.' });
  const [validationBusy, setValidationBusy] = React.useState(false);
  const { connected, latestState, taskEvent, validateWaypoint } = bridge;
  const pose = latestState?.pose || {};
  const poseViewer = backendToViewerPose(pose);
  const motion = latestState?.motion || {};
  const activeMotionId = motion?.current_id || taskEvent?.data?.task?.current_id || '';
  const labelById = React.useMemo(() => {
    const out = new Map();
    state.waypointList.forEach((wp) => out.set(wp.id, wp.label || wp.id));
    return out;
  }, [state.waypointList]);

  const makeCandidatePoint = React.useCallback(() => {
    const id = String(state.waypointId || '').trim();
    const bounded = clampViewerPose(state.editPose);
    return {
      id,
      viewerPose: bounded,
      point: {
        ...viewerToBackendPose(bounded),
        label: String(state.waypointLabel || id).trim() || id,
      },
    };
  }, [state.editPose, state.waypointId, state.waypointLabel]);

  const validateCandidate = React.useCallback(async ({ silent = false } = {}) => {
    const { point } = makeCandidatePoint();
    if (!connected) {
      const local = { grade: 'idle', message: 'WS disconnected: local preview only, reachability unknown.' };
      if (!silent) setValidation(local);
      return { ok: true, data: local, point };
    }
    setValidationBusy(true);
    try {
      const ret = await validateWaypoint(point);
      if (!ret?.ok) {
        const next = { grade: 'bad', message: `Validation failed: ${ret?.error || 'unknown error'}` };
        setValidation(next);
        return { ok: false, data: next, point };
      }
      const data = ret.data || {};
      const err = Number(data.error_mm || 0);
      const grade = validationTone(data);
      const next = {
        ...data,
        grade,
        message:
          grade === 'ok'
            ? `Reachable, IK error ${err.toFixed(2)} mm.`
            : grade === 'near'
              ? `Near target, IK error ${err.toFixed(2)} mm. Saving will use the nearest solved pose.`
              : `Out of reach, IK error ${err.toFixed(2)} mm. Move the point closer before saving.`,
      };
      setValidation(next);
      return { ok: grade === 'ok' || grade === 'near', data: next, point };
    } catch (e) {
      const next = { grade: 'bad', message: `Validation error: ${e?.message || e}` };
      setValidation(next);
      return { ok: false, data: next, point };
    } finally {
      setValidationBusy(false);
    }
  }, [connected, validateWaypoint, makeCandidatePoint]);

  React.useEffect(() => {
    if (!connected) {
      setValidation({ grade: 'idle', message: 'WS disconnected: local preview only, reachability unknown.' });
      return undefined;
    }
    const timer = window.setTimeout(() => {
      validateCandidate({ silent: true }).catch(() => {});
    }, 280);
    return () => window.clearTimeout(timer);
  }, [connected, validateCandidate]);

  const nextWaypointDraft = React.useCallback((usedIds) => {
    const ids = new Set(usedIds.map((id) => String(id || '').trim()).filter(Boolean));
    for (let i = 1; i < 1000; i += 1) {
      const nextId = `P${i}`;
      if (!ids.has(nextId)) return { id: nextId, label: `Point ${i}` };
    }
    return { id: `P${Date.now()}`, label: 'Point' };
  }, []);

  const setBoundedField = (k, v) => {
    const raw = Number(v);
    let next = Number.isFinite(raw) ? raw : 0;
    if (k === 'x') next = clamp(next, PLAN_BOUNDS.xMin, PLAN_BOUNDS.xMax);
    if (k === 'y') next = clamp(next, PLAN_BOUNDS.yMin, PLAN_BOUNDS.yMax);
    if (k === 'z') next = clamp(next, PLAN_BOUNDS.zMin, PLAN_BOUNDS.zMax);
    state.setEditPoseField(k, next);
  };

  const addPoint = async () => {
    const id = String(state.waypointId || '').trim();
    if (!id) return;
    setBusy(true);
    try {
      const checked = await validateCandidate({ silent: true });
      if (!checked.ok) return;
      let point = checked.point;
      if (checked.data?.grade === 'near' && checked.data?.solved_pose) {
        point = { ...checked.data.solved_pose, label: point.label };
        state.setEditPose(backendToViewerPose(point));
      } else {
        state.setEditPose(clampViewerPose(state.editPose));
      }
      if (bridge.connected) {
        const ret = await bridge.addWaypoint(id, point, point.label);
        if (!ret?.ok) return;
      }
      state.addLocalWaypoint(id, point);
      state.setSelectedWaypointId(id);
      state.addToSequence(id);
      const next = nextWaypointDraft([...state.waypointList.map((wp) => wp.id), id]);
      state.setWaypointId(next.id);
      state.setWaypointLabel(next.label);
    } finally {
      setBusy(false);
    }
  };

  const updatePoint = async () => {
    const id = String(state.waypointId || '').trim();
    if (!id) return;
    setBusy(true);
    try {
      const checked = await validateCandidate({ silent: true });
      if (!checked.ok) return;
      let point = checked.point;
      if (checked.data?.grade === 'near' && checked.data?.solved_pose) {
        point = { ...checked.data.solved_pose, label: point.label };
        state.setEditPose(backendToViewerPose(point));
      } else {
        state.setEditPose(clampViewerPose(state.editPose));
      }
      if (bridge.connected) {
        const ret = await bridge.updateWaypoint(id, point, point.label);
        if (!ret?.ok) return;
      }
      state.addLocalWaypoint(id, point);
    } finally {
      setBusy(false);
    }
  };

  const deletePoint = async (idRaw = state.selectedWaypointId || state.waypointId) => {
    const id = String(idRaw || '').trim();
    if (!id) return;
    setBusy(true);
    try {
      if (bridge.connected) {
        const ret = await bridge.removeWaypoint(id);
        if (!ret?.ok) return;
      }
      state.removeLocalWaypoint(id);
      state.removeFromSequence(id);
      if (state.selectedWaypointId === id) state.setSelectedWaypointId('');
    } finally {
      setBusy(false);
    }
  };

  const clearPoints = async () => {
    setBusy(true);
    try {
      if (bridge.connected) {
        const ret = await bridge.clearWaypoints();
        if (!ret?.ok) return;
      }
      state.clearLocalWaypoints();
    } finally {
      setBusy(false);
    }
  };

  const runSequence = async () => {
    if (!state.sequenceIds || state.sequenceIds.length < 2) return;
    const compactIds = state.sequenceIds.filter((id, idx, arr) => idx === 0 || id !== arr[idx - 1]);
    if (compactIds.length < 2) return;
    const pointById = new Map(state.waypointList.map((wp) => [wp.id, wp]));
    const selectedPoints = compactIds.map((id) => pointById.get(id)).filter(Boolean);
    if (selectedPoints.length < 2) return;
    setBusy(true);
    try {
      if (bridge.connected) {
        state.setClearTrailSeq((x) => x + 1);
        await bridge.runSequence(compactIds, Number(state.runDuration || 2.0), state.runProfile || 'min_jerk');
        return;
      }
      const frames = [];
      const stepsPerLeg = Math.max(12, Math.round(Number(state.runDuration || 2) * 18));
      selectedPoints.forEach((from, idx) => {
        const to = selectedPoints[idx + 1];
        if (!to) return;
        const fromViewer = backendToViewerPose(from);
        const toViewer = backendToViewerPose(to);
        for (let step = 0; step <= stepsPerLeg; step += 1) {
          if (idx > 0 && step === 0) continue;
          const u = step / stepsPerLeg;
          const t = state.runProfile === 'linear' ? u : smoothStep(u);
          frames.push({
            x: fromViewer.x + (toViewer.x - fromViewer.x) * t,
            y: fromViewer.y + (toViewer.y - fromViewer.y) * t,
            z: fromViewer.z + (toViewer.z - fromViewer.z) * t,
          });
        }
      });
      if (frames.length >= 2) {
        state.setImportedTrail({ points: frames });
        state.setClearTrailSeq((x) => x + 1);
        window.setTimeout(() => state.setReplaySeq((x) => x + 1), 50);
      }
      if (bridge.connected) {
        await bridge.runSequence(compactIds, Number(state.runDuration || 2.0), state.runProfile || 'min_jerk');
      }
    } finally {
      setBusy(false);
    }
  };

  const validationClass = validationTone(validation);
  const canSavePoint = !bridge.connected || validationClass === 'ok' || validationClass === 'near';

  return (
    <>
      <div className="simu-panel-title">Plan Points</div>
      <section className="simu-card compact-card">
        <div className="simu-panel-actions">
          <button className={`ghostBtn small ${state.pickMode ? 'active' : ''}`} onClick={() => state.setPickMode(!state.pickMode)}>
            {state.pickMode ? 'Picking On' : 'Enter Pick Mode'}
          </button>
          <button className="ghostBtn small" onClick={() => state.setEditPoseFromCurrent(poseViewer)}>Use Current Pose</button>
          <button className="ghostBtn small" onClick={() => state.setClearTrailSeq((x) => x + 1)}>Clear Trail</button>
        </div>
        <label className="simu-field dense">
          <span>Pick Y {Number(state.pickPlaneY || 0).toFixed(3)}</span>
          <input className="simu-range" type="range" min={PLAN_BOUNDS.yMin} max={PLAN_BOUNDS.yMax} step={0.005} value={state.pickPlaneY} onChange={(e) => state.setPickPlaneY(Number(e.target.value))} />
        </label>
      </section>
      <section className="simu-card">
        <div className={`simu-validation-card ${validationClass}`}>
          <span className="simu-validation-dot" />
          <div>
            <strong>{validationBusy ? 'Checking reachability...' : 'Reachability'}</strong>
            <small>{validation.message}</small>
          </div>
          <button className="simu-mini-action queue" disabled={validationBusy} onClick={() => validateCandidate()}>
            Validate
          </button>
        </div>
        <div className="simu-point-meta-grid">
          <label className="simu-field dense">
            <span>ID</span>
            <input className="simu-ws-input" value={state.waypointId} onChange={(e) => state.setWaypointId(e.target.value)} placeholder="P1" />
          </label>
          <label className="simu-field dense">
            <span>Name</span>
            <input className="simu-ws-input" value={state.waypointLabel} onChange={(e) => state.setWaypointLabel(e.target.value)} placeholder="Pick/place point" />
          </label>
        </div>
        <div className="simu-field-group-title">XYZ</div>
        <div className="simu-grid3">
          {['x', 'y', 'z'].map((k) => (
            <label className="simu-field compact" key={k}>
              <span>{k.toUpperCase()}</span>
              <input className="simu-ws-input compact" type="number" step="0.001" value={state.editPose[k]} onChange={(e) => setBoundedField(k, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="simu-field-group-title">RPY</div>
        <div className="simu-grid3">
          {['roll', 'pitch', 'yaw'].map((k) => (
            <label className="simu-field" key={k}>
              <span>{k}</span>
              <input className="simu-ws-input compact" type="number" step="0.001" value={state.editPose[k]} onChange={(e) => setBoundedField(k, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="simu-panel-actions">
          <button className="ghostBtn small primary" disabled={busy || !canSavePoint} onClick={addPoint}>Add Point</button>
          <button className="ghostBtn small" disabled={busy || !canSavePoint} onClick={updatePoint}>Update Point</button>
          <button className="ghostBtn small" disabled={busy} onClick={() => deletePoint()}>Delete Point</button>
          <button className="ghostBtn small danger" disabled={busy} onClick={clearPoints}>Clear All Points</button>
        </div>
      </section>
      <section className="simu-card">
        <div className="simu-panel-title">Point List</div>
        <div className="simu-waypoint-list">
          {state.waypointList.map((wp) => (
            <div
              key={wp.id}
              className={`simu-waypoint-item ${state.selectedWaypointId === wp.id ? 'active' : ''} ${activeMotionId === wp.id ? 'running' : ''}`}
              onClick={() => state.selectWaypoint(wp)}
              role="button"
              tabIndex={0}
            >
              <span className="simu-waypoint-dot" style={{ background: waypointColor(wp.id) }} />
              <span className="simu-waypoint-label">
                <strong>{wp.id}</strong>
                <small>{wp.label || wp.id}</small>
              </span>
              <span className="simu-waypoint-coords">{wp.x.toFixed(3)}, {wp.y.toFixed(3)}, {wp.z.toFixed(3)}</span>
              <span className="simu-waypoint-actions">
                <button className="simu-mini-action queue" onClick={(e) => { e.stopPropagation(); state.addToSequence(wp.id); }}>Queue</button>
                <button className="simu-mini-action danger" disabled={busy} onClick={(e) => { e.stopPropagation(); deletePoint(wp.id); }}>Del</button>
              </span>
            </div>
          ))}
          {state.waypointList.length === 0 && <div className="simu-empty">No points yet</div>}
        </div>
      </section>
      <section className="simu-card">
        <div className="simu-panel-title">Execution Order</div>
        <label className="simu-field dense">
          <span>Duration</span>
          <input className="simu-ws-input" type="number" min={0.2} step={0.1} value={state.runDuration} onChange={(e) => state.setRunDuration(Number(e.target.value))} />
        </label>
        <label className="simu-field dense">
          <span>Profile</span>
          <select className="simu-ws-input" value={state.runProfile} onChange={(e) => state.setRunProfile(e.target.value)}>
            <option value="min_jerk">min_jerk</option>
            <option value="linear">linear</option>
            <option value="geodesic">geodesic</option>
          </select>
        </label>
        <div className="simu-waypoint-list">
          {state.sequenceIds.map((id, idx) => (
            <div className={`simu-waypoint-item seq-item active ${activeMotionId === id ? 'running' : ''}`} key={`seq-${id}-${idx}`}>
              <span className="simu-waypoint-dot" style={{ background: waypointColor(id) }} />
              <span className="simu-waypoint-label">
                <strong>{id}</strong>
                <small>{labelById.get(id) || id}</small>
              </span>
              <div className="simu-inline-actions">
                <button className="ghostBtn small" onClick={() => state.moveSequenceUp(id)}>Up</button>
                <button className="ghostBtn small" onClick={() => state.moveSequenceDown(id)}>Down</button>
                <button className="ghostBtn small" onClick={() => state.removeFromSequence(id)}>Del</button>
              </div>
            </div>
          ))}
          {state.sequenceIds.length === 0 && <div className="simu-empty">Add points to build a run</div>}
        </div>
        <div className="simu-panel-actions">
          <button className="ghostBtn small" disabled={busy} onClick={runSequence}>Start Sequence</button>
          <button className="ghostBtn small" disabled={busy} onClick={bridge.stopMotion}>Stop</button>
        </div>
      </section>
    </>
  );
}

function BridgePanel({ bridge }) {
  const motion = bridge.latestState?.motion || {};
  return (
    <>
      <div className="simu-panel-title">WS Bridge</div>
      <section className="simu-card">
        <div className="simu-kv">
          <span>Status</span><strong>{bridge.phaseLabel}</strong>
          <span>Motion</span><strong>{motion?.running ? `running (${motion?.name || 'task'})` : (motion?.name || 'idle')}</strong>
          <span>Event</span><strong>{bridge.taskEvent ? 'received' : 'none'}</strong>
        </div>
        <div className="simu-panel-actions">
          <button className="ghostBtn small" onClick={bridge.clearHistory}>Clear WS History</button>
          <button className="ghostBtn small" onClick={bridge.fetchBusSnapshot}>Bus Snapshot</button>
        </div>
      </section>
      {Array.isArray(bridge.history) && bridge.history.length > 0 && (
        <pre className="simu-state-box">{JSON.stringify(bridge.history.slice(-20), null, 2)}</pre>
      )}
      {bridge.latestState && <pre className="simu-state-box">{JSON.stringify(bridge.latestState, null, 2)}</pre>}
      {bridge.busSnapshot && <pre className="simu-state-box">{JSON.stringify(bridge.busSnapshot, null, 2)}</pre>}
    </>
  );
}

function ViewPanel({ state, bridge }) {
  return (
    <>
      <div className="simu-panel-title">View & Diagnostics</div>
      <ScenePanel state={state} />
      <TrajectoryPanel state={state} />
      <BridgePanel bridge={bridge} />
    </>
  );
}

export function SimuRightPanel({ state, bridge }) {
  return (
    <aside className="simu-right-panel">
      <div className="simu-panel-backdrop">
        <SimuBridgeDock state={state} bridge={bridge} />
        {state.activeSection === 'plan' && <PlanPanel state={state} bridge={bridge} />}
        {state.activeSection === 'manual' && <JointPanel state={state} />}
        {state.activeSection === 'view' && <ViewPanel state={state} bridge={bridge} />}
      </div>
    </aside>
  );
}
