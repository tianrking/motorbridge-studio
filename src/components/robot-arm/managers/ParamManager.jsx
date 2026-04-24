import React from 'react';
import { useI18n } from '../../../i18n';
import { DAMIAO_ARM_PARAM_DEFS } from '../../../lib/appConfig';
import { REBOT_ARM_DAMIAO_DEFAULT_TEMPLATE } from '../../../lib/robotArm';
import { parseNum } from '../../../lib/utils';
import { ParamTable } from '../ParamTable';

function createParamValueDefaults() {
  return Object.fromEntries(
    DAMIAO_ARM_PARAM_DEFS.map((def) => [def.key, String(def.defaultValue ?? '')]),
  );
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
