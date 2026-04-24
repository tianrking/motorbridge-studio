import React from 'react';

const StudioContext = React.createContext(null);
const ConnectionContext = React.createContext(null);
const ScanContext = React.createContext(null);
const ControlContext = React.createContext(null);
const RobotArmContext = React.createContext(null);
const PreferencesContext = React.createContext(null);
const LogsContext = React.createContext(null);
const WorkspaceContext = React.createContext(null);

function requireContext(value, name) {
  if (!value) {
    throw new Error(`${name} must be used inside MotorStudioProvider`);
  }
  return value;
}

export function MotorStudioProvider({ value, children }) {
  return React.createElement(
    StudioContext.Provider,
    { value },
    React.createElement(
      ConnectionContext.Provider,
      { value: value.connection },
      React.createElement(
        ScanContext.Provider,
        { value: value.scan },
        React.createElement(
          ControlContext.Provider,
          { value: value.control },
          React.createElement(
            RobotArmContext.Provider,
            { value: value.robotArm },
            React.createElement(
              PreferencesContext.Provider,
              { value: value.preferences },
              React.createElement(
                LogsContext.Provider,
                { value: value.logs },
                React.createElement(WorkspaceContext.Provider, { value: value.workspace }, children),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function useStudioDomains() {
  return requireContext(React.useContext(StudioContext), 'useStudioDomains');
}

export function useConnectionContext() {
  return requireContext(React.useContext(ConnectionContext), 'useConnectionContext');
}

export function useScanContext() {
  return requireContext(React.useContext(ScanContext), 'useScanContext');
}

export function useControlContext() {
  return requireContext(React.useContext(ControlContext), 'useControlContext');
}

export function useRobotArmContext() {
  return requireContext(React.useContext(RobotArmContext), 'useRobotArmContext');
}

export function usePreferencesContext() {
  return requireContext(React.useContext(PreferencesContext), 'usePreferencesContext');
}

export function useLogsContext() {
  return requireContext(React.useContext(LogsContext), 'useLogsContext');
}

export function useWorkspaceContext() {
  return requireContext(React.useContext(WorkspaceContext), 'useWorkspaceContext');
}

export function useMotorStudioContext() {
  const studio = useStudioDomains();
  return React.useMemo(
    () => ({
      ...studio.connection,
      ...studio.scan,
      ...studio.control,
      ...studio.robotArm,
      ...studio.preferences,
      ...studio.logs,
      ...studio.workspace,
    }),
    [studio],
  );
}
