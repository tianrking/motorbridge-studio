# MotorBridge Studio

WebSocket-based motor control studio UI (frontend only).

- Frontend: React + Vite
- Backend: `ws_gateway`
- Browser calls WS operations: `set_target` / `scan` / `set_id` / `verify` / `enable` / `disable` / `mit` / `pos_vel` / `vel` / `force_pos` / `stop`

## Companion Repo

- `motorbridge`: https://github.com/tianrking/motorbridge
  Core runtime, `motor_cli`, bindings, `ws_gateway`, and `tools/reliability`.

## 1) Install Prerequisites

```bash
pip install -U motorbridge
cd motorbridge-studio
npm install
```

## 2) Choose Transport and Start `ws_gateway`

Default WS bind in all examples:

```bash
--bind 127.0.0.1:9002
```

Security note:

- Keep `127.0.0.1:9002` for local setup.
- If you must expose `ws_gateway` on LAN/WAN (`0.0.0.0` or a host IP), set `MOTORBRIDGE_WS_TOKEN` before starting gateway.
- Browser-native `WebSocket` cannot set custom handshake headers. For token-protected remote deployments, put Studio behind a controlled reverse proxy that injects `x-motorbridge-token` / `Authorization`, or use a custom non-browser client.
- Studio is intended to connect directly only to local loopback gateways unless such a proxy is in place.

### A. Damiao over `dm-serial`

Use this when the adapter is Damiao serial bridge.

Ubuntu:

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport dm-serial \
  --serial-port /dev/ttyACM0 --serial-baud 921600 \
  --dt-ms 20
```

macOS:

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport dm-serial \
  --serial-port /dev/cu.usbmodemXXXX --serial-baud 921600 \
  --dt-ms 20
```

If macOS reports dynamic-library loading errors, use package-local fallback:

```bash
GW="$(python3 -c "import motorbridge, pathlib; print(pathlib.Path(motorbridge.__file__).resolve().parent/'bin'/'ws_gateway')")"
PKG_DIR="$(python3 -c "import motorbridge, pathlib; print(pathlib.Path(motorbridge.__file__).resolve().parent)")"
DYLD_LIBRARY_PATH="$PKG_DIR/lib:${DYLD_LIBRARY_PATH:-}" "$GW" \
  --bind 127.0.0.1:9002 --vendor damiao --transport dm-serial \
  --serial-port /dev/cu.usbmodemXXXX --serial-baud 921600 \
  --dt-ms 20
```

Windows (PowerShell):

```powershell
motorbridge-gateway -- `
  --bind 127.0.0.1:9002 `
  --vendor damiao --transport dm-serial `
  --serial-port COM3 --serial-baud 921600 `
  --dt-ms 20
```

Serial port tips:

- Linux: check `/dev` for ports such as `/dev/ttyACM0` or `/dev/ttyUSB0`.
- macOS: check `/dev` for ports such as `/dev/tty.usbmodemXXXX` or `/dev/tty.usbserial-XXXX`.
- Windows: check Device Manager for the newly added `COM` port, for example `COM3`.

### B. PCAN / Standard CAN path (`socketcan`/`pcan`)

Use this when the adapter is PCAN or other standard CAN interface.

Ubuntu (SocketCAN):

Before starting the gateway, bring SocketCAN interfaces up at 1Mbps. You can add this helper to `~/.bashrc`, then run `source ~/.bashrc && can_restart`:

```bash
alias can_restart='if ip link show can0 >/dev/null 2>&1; then echo "[can_restart] restarting can0"; sudo ip link set can0 down 2>/dev/null || true; sudo ip link set can0 type can bitrate 1000000 restart-ms 100 loopback off 2>/dev/null || sudo ip link set can0 type can bitrate 1000000 loopback off; sudo ip link set can0 up; ip -details link show can0; fi; if ip link show can1 >/dev/null 2>&1; then echo "[can_restart] restarting can1"; sudo ip link set can1 down 2>/dev/null || true; sudo ip link set can1 type can bitrate 1000000 restart-ms 100 loopback off 2>/dev/null || sudo ip link set can1 type can bitrate 1000000 loopback off; sudo ip link set can1 up; ip -details link show can1; fi'
```

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport auto \
  --channel can0 \
  --dt-ms 20
```

macOS (PCBUSB runtime):

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport auto \
  --channel can0 \
  --dt-ms 20
```

Windows (PCAN backend):

```powershell
motorbridge-gateway -- `
  --bind 127.0.0.1:9002 `
  --vendor damiao --transport auto `
  --channel can0@1000000 `
  --dt-ms 20
```

## 3) Start Frontend

```bash
cd motorbridge-studio
npm run dev
```

Open: `http://127.0.0.1:18110`

In UI connection panel:

- WS URL: `ws://127.0.0.1:9002`
- Channel: same as gateway channel (for example `can0`)

## 4) Verify Quickly

- General page: run `Scan Damiao`.
- Robot Arm page: select profile, click `Prepare 7 Cards`, then `Scan All Joints`.

## 5) Notes

- Linux SocketCAN channel should be `can0` (do not use `can0@1000000`).
- `dm-serial` is Damiao-only transport.
- Studio aligns with the MotorBridge `v0.3.5` WS interface. On connect it tries `capabilities`; if an older gateway does not expose that op, the UI falls back to the built-in `v0.3.5` capability table.
- RobStride scan defaults to host ID candidates `0xFD,0xFF,0xFE`. Add `0x00,0xAA` manually if you are recovering unusual firmware settings.
- RobStride `pos_vel` maps to native Position mode. Effective fields are target position, `vlim`, and `kp` as `loc_kp`; velocity, `kd`, and torque are ignored by the gateway for this mode.
- `ws disconnected` in logs is often browser reconnect behavior; check whether gateway is still listening.

For detailed CAN troubleshooting, see:

- `docs/en/can_debugging.md`
