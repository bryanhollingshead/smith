// Smith — Messaging WS smoke test
// Connects as Diane, has Marcus send her a message via REST, and confirms
// Diane receives a real-time message:new event over the websocket.

import WebSocket from 'ws';

const API = 'http://localhost:4000/api';

async function post(path, token, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function signin(email) {
  const r = await fetch(API + '/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'framer-2024-mt' }),
  });
  return (await r.json()).token;
}

(async () => {
  const marcus = await signin('marcus.whitfield@smith.test');
  const diane  = await signin('diane.okafor@smith.test');

  // Ensure thread exists.
  const { thread_id } = await post('/messages/threads', marcus, { peer_id: 2 });
  console.log(`thread = ${thread_id}`);

  // Open Diane's socket.
  const ws = new WebSocket(`ws://localhost:4000/api/ws?token=${diane}`);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
    setTimeout(() => reject(new Error('open timeout')), 3000);
  });
  console.log('diane socket open');

  // Collect messages received.
  const received = [];
  ws.on('message', (data) => {
    const evt = JSON.parse(data.toString());
    received.push(evt);
    console.log('diane got:', evt.type, evt.thread_id || '', evt.message?.body || '');
  });

  // Wait for hello.
  await new Promise(r => setTimeout(r, 300));

  // Marcus sends — Diane should receive over the socket.
  await post(`/messages/threads/${thread_id}/messages`, marcus, { body: 'Real-time test ' + Date.now() });

  // Wait briefly for the broadcast.
  await new Promise(r => setTimeout(r, 500));

  if (!received.some(e => e.type === 'message:new')) {
    console.error('✗ did NOT receive message:new');
    process.exit(1);
  }
  console.log('✓ received message:new');

  // Bad-token connection should fail to open.
  const badWs = new WebSocket(`ws://localhost:4000/api/ws?token=bad`);
  await new Promise(resolve => {
    badWs.once('open', () => { console.error('✗ bad-token socket should NOT open'); process.exit(1); });
    badWs.once('error', () => { console.log('✓ bad token rejected'); resolve(); });
    badWs.once('unexpected-response', () => { console.log('✓ bad token rejected'); resolve(); });
    setTimeout(resolve, 2000);
  });

  ws.close();
  process.exit(0);
})();
