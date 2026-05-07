# /simu WebSocket Protocol

This document is scoped to `src/third_page/simu`.

## Quick Start

`/simu` is the MotorBridge Studio simulation page. The page lives in this
repository, but its WebSocket simulation backend lives in the separate
`motorbridge-arm` repository.

Clone or enter the frontend repository:
```bash
git clone https://github.com/motorbridge/motorbridge-studio.git
cd motorbridge-studio
npm run dev
```

If you already have the repository locally, just `cd` to your existing
`motorbridge-studio` checkout instead of cloning again.

Open:
```text
http://localhost:18110/simu
```

If Vite chooses another port, open the `/simu` route on the printed port.

Clone or enter the backend repository:
```bash
git clone https://github.com/motorbridge/motorbridge-arm.git
cd motorbridge-arm
uv sync --extra web --extra kinematics
uv run python scripts/verify_env.py --require-pinocchio
uv run python scripts/run_simu_ws_gateway.py --host 127.0.0.1 --port 9011
```

If you already have the repository locally, just `cd` to your existing
`motorbridge-arm` checkout instead of cloning again.

Keep the backend terminal running. If the command exits or the terminal is
closed, the Studio page will show a disconnected/reconnecting WebSocket state.

Check whether the backend is alive:
```bash
cd motorbridge-arm
uv run python scripts/simu_ws_cli.py --url ws://127.0.0.1:9011/ws state
```

If port `9011` is already in use, a backend is probably already running:
```bash
ss -ltnp | grep 9011
```

Stop an existing backend:
```bash
pkill -f run_simu_ws_gateway.py
```

Default URL:
- `ws://127.0.0.1:9011/ws`

For a deployed Studio frontend, configure the default WebSocket endpoint with
the Vite environment variable:
```bash
VITE_SIMU_WS_URL=wss://your-public-motorbridge-arm-host/ws
```

Important deployment note:
- `http://localhost:18110/simu` works locally because the Vite dev server serves
  the SPA fallback automatically.
- Vercel needs `vercel.json` rewrites so direct `/simu` visits load
  `index.html`.
- `ws://127.0.0.1:9011/ws` only works on the same machine running
  `motorbridge-arm`. From Vercel, `127.0.0.1` means the visitor/browser machine,
  not your backend. Use a public `wss://.../ws` backend URL for cloud access.

## Modes
- Local mode: no WS connection. The page can still edit points and preview a browser-side path.
- WS mode: connect to `motorbridge-arm` at `ws://127.0.0.1:9011/ws`.
- Follow state: enabled by default. The viewer follows backend `joint_targets`.
- Sync drag: optional. Pushes manual joint slider edits to the backend.

## Current /simu Behavior

- The visual robot uses the `arm02` URDF with gripper:
  `/public/resources/arm02/reBot_B601_DM_with_gripper/urdf/reBot_B601_DM_with_gripper.urdf`
- The backend should use the matching `motorbridge-arm` `arm02` simulation profile.
- `joint1..joint6` are arm joints.
- `joint7` is a Studio UI compatibility alias for the gripper.
- Backend state also exposes `gripper_joint1` and `gripper_joint2`.
- Plan point markers are shown as colored point labels.
- The planned execution order is shown as a blue translucent line.
- The actual executed/replayed trajectory is shown as the trail color, normally red.
- When WS is connected, `Start Sequence` asks the backend to move point-by-point and the viewer follows backend state.
- When WS is disconnected, `Start Sequence` uses local browser-side preview/replay.

## Plan Points Workflow

1. Start the backend from `motorbridge-arm`.
2. Open `/simu` in `motorbridge-studio`.
3. Confirm the bridge status is `Connected`.
4. Enable `Follow state` so the viewer follows backend motion.
5. Use `Enter Pick Mode` and click/drag in the viewport, or type XYZ/RPY manually.
6. Click `Add Point`. The form auto-advances from `P1` to `P2`, etc.
7. Add multiple points.
8. Check `Execution Order`; use `+Seq`, `Up`, `Down`, and `Del` to adjust order.
9. Click `Start Sequence`.
10. Use `Stop` to cancel a running sequence.

Delete behavior:
- Use the row-level `Del` button in `Point List` when possible.
- The top `Delete Point` button deletes the selected point, or the ID currently typed in the ID field.
- `Clear Points` clears local and backend waypoints.

## Request/Response Envelope
Request:
```json
{ "op": "<name>", "req_id": 1, "...": "payload" }
```
Response:
```json
{ "ok": true, "op": "<name>", "req_id": 1, "data": {} }
```
Error:
```json
{ "ok": false, "op": "<name>", "req_id": 1, "error": "..." }
```

## State Push
Server pushes periodic state:
```json
{
  "type": "state",
  "data": {
    "q": [],
    "joint_targets": {
      "joint1": 0.0,
      "joint2": 0.0,
      "joint3": 0.0,
      "joint4": 0.0,
      "joint5": 0.0,
      "joint6": 0.0,
      "gripper_joint1": 0.0,
      "gripper_joint2": 0.0,
      "joint7": 0.0
    },
    "pose": {},
    "waypoints": {
      "P1": {"label":"Pick point","x":0.3,"y":0.0,"z":0.2,"roll":0.0,"pitch":0.0,"yaw":0.0}
    },
    "motion": { "running": false, "name": "idle" },
    "ts": 0.0
  }
}
```

## Operations
- `ping`
- `state`
- `sim_set_joint_targets`
  - payload: `{ "targets": {"joint1": 0.1, "joint2": -0.2, "joint7": 0.02, ...} }`
  - `joint7` is mapped by the backend/viewer to `gripper_joint1` and `gripper_joint2`.
- `sim_move_l`
  - payload:
```json
{
  "target_pose": {"x":0.2,"y":0.0,"z":0.2,"roll":0.0,"pitch":0.0,"yaw":0.0},
  "duration_s": 2.0
}
```
- `bus_config`
  - payload: `{ "tx_buffer_size": 1024, "rx_buffer_size": 1024, "channels": {"websocket": true, "sim": true, "ros": false} }`
- `bus_snapshot`
  - payload: `{ "limit": 100 }`
- `waypoint_add`
  - payload:
```json
{
  "id": "P1",
  "label": "Pick point",
  "pose": {"x":0.3,"y":0.0,"z":0.2,"roll":0.0,"pitch":0.0,"yaw":0.0}
}
```
- `waypoint_remove`
  - payload: `{ "id": "P1" }`
- `waypoint_update`
  - payload:
```json
{
  "id": "P1",
  "label": "Adjusted pick point",
  "pose": {"x":0.31,"y":0.00,"z":0.22,"roll":0.0,"pitch":0.0,"yaw":0.0}
}
```
- `waypoint_clear`
- `waypoint_list`
- `sim_run_waypoints`
  - payload: `{ "from_id": "P1", "to_id": "P2", "duration_s": 2.0, "profile": "min_jerk|linear|geodesic" }`
- `sim_run_sequence`
  - payload: `{ "ids": ["P1","P3","P2"], "duration_s": 2.0, "profile": "min_jerk|linear|geodesic" }`
- `sim_stop`
  - immediate stop for currently running waypoint motion

## Event Push
- `{"type":"waypoint","data":{"event":"added|updated|removed|cleared", ...}}`
- `{"type":"task","data":{"event":"accepted|done|stopped|error","task":{...}}}`

## Extensibility
The backend bus is designed for multi-protocol bridging (`websocket`, `motorbridge_py`, `ros`, etc.).
You can later add protocol adapters and switch channels on/off via `bus_config`.
