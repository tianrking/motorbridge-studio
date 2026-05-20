# MotorBridge Studio

基于 WebSocket 的电机控制 Studio 上位机（纯前端）。

- 前端：React + Vite
- 后端：`ws_gateway`
- 浏览器调用 WS 指令：`set_target` / `scan` / `set_id` / `verify` / `enable` / `disable` / `mit` / `pos_vel` / `vel` / `force_pos` / `stop`

## 配套仓库

- `motorbridge`：https://github.com/tianrking/motorbridge
  提供核心运行时、`motor_cli`、bindings、`ws_gateway` 与 `tools/reliability`。

## 1）安装依赖

```bash
pip install -U motorbridge
cd motorbridge-studio
npm install
```

安装后可直接使用 `motorbridge-gateway`（无需额外配置 `MOTORBRIDGE_WS_GATEWAY_BIN` 环境变量）。
若选择 CAN 路径（`auto/socketcan/socketcanfd`），命令行会在启动前做平台提示：
- Linux：提示 `canX/slcanX` 初始化与 `ip link up`
- Windows：提示安装 PEAK PCAN 驱动与 `PCANBasic.dll`
- macOS：提示安装 PCBUSB 运行时
`dm-serial` 路径不触发上述 CAN 依赖检查。

## 2）选择传输链路并启动 `ws_gateway`

以下示例统一使用：

```bash
--bind 127.0.0.1:9002
```

安全说明：

- 本地联调建议保持 `127.0.0.1:9002`。
- 若需暴露到局域网/公网（`0.0.0.0` 或具体网卡 IP），启动网关前必须设置 `MOTORBRIDGE_WS_TOKEN`。
- 浏览器原生 `WebSocket` 不能自定义握手 header。远程 token 部署请把 Studio 放在受控反向代理后，由代理注入 `x-motorbridge-token` / `Authorization`，或改用自定义非浏览器客户端。
- 没有反向代理时，Studio 只建议直连本机回环地址上的网关。

### A. Damiao 串口桥（`dm-serial`）

当适配器是 Damiao 串口桥时使用。

Ubuntu：

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport dm-serial \
  --serial-port /dev/ttyACM0 --serial-baud 921600 \
  --dt-ms 20
```

macOS：

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport dm-serial \
  --serial-port /dev/cu.usbmodemXXXX --serial-baud 921600 \
  --dt-ms 20
```

如果 macOS 报动态库加载错误，使用包内路径兜底：

```bash
GW="$(python3 -c "import motorbridge, pathlib; print(pathlib.Path(motorbridge.__file__).resolve().parent/'bin'/'ws_gateway')")"
PKG_DIR="$(python3 -c "import motorbridge, pathlib; print(pathlib.Path(motorbridge.__file__).resolve().parent)")"
DYLD_LIBRARY_PATH="$PKG_DIR/lib:${DYLD_LIBRARY_PATH:-}" "$GW" \
  --bind 127.0.0.1:9002 --vendor damiao --transport dm-serial \
  --serial-port /dev/cu.usbmodemXXXX --serial-baud 921600 \
  --dt-ms 20
```

Windows（PowerShell）：

```powershell
motorbridge-gateway -- `
  --bind 127.0.0.1:9002 `
  --vendor damiao --transport dm-serial `
  --serial-port COM3 --serial-baud 921600 `
  --dt-ms 20
```

串口名提示：

- Linux：在 `/dev` 下查看 `/dev/ttyACM0`、`/dev/ttyUSB0` 等设备。
- macOS：在 `/dev` 下查看 `/dev/tty.usbmodemXXXX`、`/dev/tty.usbserial-XXXX` 等设备。
- Windows：在设备管理器里查看新增加的 `COM` 端口，例如 `COM3`。

### B. PCAN / 标准 CAN 路径（`socketcan`/`pcan`）

当适配器是 PCAN 或标准 CAN 网卡时使用。

Ubuntu（SocketCAN）：

启动网关前，先把 SocketCAN 端口按 1Mbps 拉起。可以把这个 helper 加到 `~/.bashrc`，然后运行 `source ~/.bashrc && can_restart`：

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

macOS（PCBUSB 运行时）：

```bash
motorbridge-gateway -- \
  --bind 127.0.0.1:9002 \
  --vendor damiao --transport auto \
  --channel can0 \
  --dt-ms 20
```

Windows（PCAN 后端）：

```powershell
motorbridge-gateway -- `
  --bind 127.0.0.1:9002 `
  --vendor damiao --transport auto `
  --channel can0@1000000 `
  --dt-ms 20
```

## 3）启动前端

```bash
cd motorbridge-studio
npm run dev
```

打开：`http://127.0.0.1:18110`

UI 连接参数：

- WS URL：`ws://127.0.0.1:9002`
- Channel：与网关启动参数一致（例如 `can0`）

## 4）快速验证

- 通用页：点击 `Scan Damiao`。
- 机械臂页：选 profile，点击 `Prepare 7 Cards`，再点 `Scan All Joints`。

## 5）说明

- Linux SocketCAN 下通道写 `can0`，不要写 `can0@1000000`。
- `dm-serial` 只支持 Damiao。
- Studio 已对齐 MotorBridge `v0.3.5` WS 接口。连接后会尝试读取 `capabilities`；如果旧网关不支持该 op，UI 会使用内置的 `v0.3.5` 能力表兜底。
- RobStride 扫描默认 host_id 候选为 `0xFD,0xFF,0xFE`。如果是异常固件或现场恢复场景，可手动追加 `0x00,0xAA`。
- RobStride `pos_vel` 映射到原生 Position 模式。有效字段是目标位置、`vlim`、以及作为 `loc_kp` 使用的 `kp`；该模式下速度、`kd` 和力矩会被网关忽略。
- 日志里的 `ws disconnected` 常见于浏览器重连，不一定是网关故障；看网关是否仍在监听。

深入排障文档：

- `docs/zh/can_debugging.md`
