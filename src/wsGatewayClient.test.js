import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WsGatewayClient } from './wsGatewayClient';

class FakeWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.OPEN;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  receive(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

FakeWebSocket.instances = [];

describe('WsGatewayClient', () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it('sends request ids and resolves matching responses', async () => {
    const client = new WsGatewayClient({});
    client.connect('ws://127.0.0.1:9002');
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();

    const pending = client.send('ping', { value: 42 }, 1000);
    expect(JSON.parse(ws.sent[0])).toEqual({ op: 'ping', req_id: 1, value: 42 });

    ws.receive({ ok: true, op: 'ping', req_id: 1, data: { pong: true } });
    await expect(pending).resolves.toMatchObject({ ok: true, data: { pong: true } });
  });

  it('rejects pending requests when the websocket closes', async () => {
    const client = new WsGatewayClient({});
    client.connect('ws://127.0.0.1:9002');
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();

    const pending = client.send('state_once', {}, 1000);
    ws.close();

    await expect(pending).rejects.toThrow('ws closed');
  });

  it('emits state messages without resolving request promises', () => {
    const onState = vi.fn();
    const client = new WsGatewayClient({ onState });
    client.connect('ws://127.0.0.1:9002');
    const ws = FakeWebSocket.instances[0];

    ws.receive({ type: 'state', data: { pos: 1.25 } });

    expect(onState).toHaveBeenCalledWith({ pos: 1.25 });
  });
});
