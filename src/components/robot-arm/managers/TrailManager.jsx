import React from 'react';
import { useI18n } from '../../../i18n';
import { usePersistedState } from '../../../hooks/usePersistedState';

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
