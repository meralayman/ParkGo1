/**
 * Local E2E API audit — run: node scripts/e2e-local-audit.js
 * Requires backend on http://127.0.0.1:5000
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:5000';

const results = [];
function pass(name) {
  results.push({ name, ok: true });
  console.log(`  ✓ ${name}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}: ${detail}`);
}

async function json(method, path, body, token) {
  const headers = { Accept: 'application/json' };
  if (body != null) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 200) };
  }
  return { res, data, status: res.status };
}

function futureIso(hoursFromNow = 2, durationHours = 1) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function main() {
  console.log(`\nParkGo local E2E audit → ${BASE}\n`);

  const health = await json('GET', '/health');
  if (health.data?.ok) pass('GET /health');
  else fail('GET /health', JSON.stringify(health.data));

  const slotsPub = await json('GET', '/slots');
  if (slotsPub.data?.ok && Array.isArray(slotsPub.data.slots)) {
    pass('GET /slots (public)');
  } else fail('GET /slots', JSON.stringify(slotsPub.data));

  const ts = Date.now();
  const username = `e2e_${ts}`;
  const email = `e2e_${ts}@example.com`;
  const password = 'TestPass1!';

  const signup = await json('POST', '/auth/signup', {
    firstName: 'E2E',
    lastName: 'User',
    phoneNumber: '01012345678',
    nationalId: '29010123456789',
    username,
    email,
    password,
    role: 'user',
  });
  if (signup.data?.ok && signup.data.user?.id) pass('POST /auth/signup');
  else fail('POST /auth/signup', signup.data?.error || JSON.stringify(signup.data));

  const login = await json('POST', '/auth/login', { usernameOrEmail: username, password });
  const tokenA = login.data?.accessToken;
  const userA = login.data?.user;
  if (tokenA && userA?.id) pass('POST /auth/login (user A)');
  else {
    fail('POST /auth/login', login.data?.error || 'no token');
    console.log('\nAborting — login required for remaining tests.\n');
    process.exit(1);
  }

  const loginB = await json('POST', '/auth/login', {
    usernameOrEmail: `e2e_b_${ts}@example.com`,
    password,
  });
  let tokenB = loginB.data?.accessToken;
  let userB = loginB.data?.user;
  if (!tokenB) {
    await json('POST', '/auth/signup', {
      firstName: 'E2E',
      lastName: 'B',
      phoneNumber: '01098765432',
      nationalId: `290102${String(ts).padStart(9, '0').slice(-9)}`,
      username: `e2e_b_${ts}`,
      email: `e2e_b_${ts}@example.com`,
      password,
      role: 'user',
    });
    const lb = await json('POST', '/auth/login', {
      usernameOrEmail: `e2e_b_${ts}`,
      password,
    });
    tokenB = lb.data?.accessToken;
    userB = lb.data?.user;
  }
  if (tokenB && userB?.id) pass('User B login (ownership tests)');
  else fail('User B setup', loginB.data?.error || 'could not create second user');

  const me = await json('GET', '/auth/me', null, tokenA);
  if (me.data?.ok && String(me.data.user?.id) === String(userA.id)) pass('GET /auth/me');
  else fail('GET /auth/me', JSON.stringify(me.data));

  const noAuth = await json('GET', `/reservations/user/${userA.id}`);
  if (noAuth.status === 401) pass('GET /reservations/user/:id requires auth');
  else fail('GET /reservations/user/:id requires auth', `status ${noAuth.status}`);

  if (tokenB && userB?.id) {
    const wrongUser = await json('GET', `/reservations/user/${userB.id}`, null, tokenA);
    if (wrongUser.status === 403) pass('Cannot view another user bookings');
    else fail('Cannot view another user bookings', `status ${wrongUser.status}`);
  }

  const freeSlot =
    slotsPub.data.slots.find((s) => Number(s.state) === 0)?.slot_no || slotsPub.data.slots[0]?.slot_no;

  const { start, end } = futureIso(3, 1);
  const create = await json(
    'POST',
    '/reservations',
    {
      userId: userA.id,
      startTime: start,
      endTime: end,
      totalAmount: 50,
      paymentMethod: 'cash',
      slotNo: freeSlot,
    },
    tokenA
  );
  const resId = create.data?.reservation?.id;
  if (create.data?.ok && resId) pass('POST /reservations');
  else fail('POST /reservations', create.data?.error || JSON.stringify(create.data));

  const list = await json('GET', `/reservations/user/${userA.id}`, null, tokenA);
  const found = list.data?.reservations?.some((r) => String(r.id) === String(resId));
  if (found) pass('Reservation appears in user list');
  else fail('Reservation in list', 'not found');

  if (tokenB) {
    const cancelOther = await json('PATCH', `/reservations/${resId}/cancel`, null, tokenB);
    if (cancelOther.status === 403) pass('Cannot cancel another user booking');
    else fail('Cannot cancel another user booking', `status ${cancelOther.status}`);
  }

  const cancel = await json('PATCH', `/reservations/${resId}/cancel`, null, tokenA);
  if (cancel.data?.ok) pass('PATCH /reservations/:id/cancel');
  else fail('PATCH /reservations/:id/cancel', cancel.data?.error);

  const afterCancel = await json('GET', `/reservations/user/${userA.id}`, null, tokenA);
  const cancelledRow = afterCancel.data?.reservations?.find((r) => String(r.id) === String(resId));
  if (cancelledRow?.status === 'cancelled') pass('Cancelled booking kept with status cancelled');
  else fail('Cancelled status in history', cancelledRow?.status || 'missing');

  const { start: s2, end: e2 } = futureIso(4, 1);
  const c2 = await json(
    'POST',
    '/reservations',
    {
      userId: userA.id,
      startTime: s2,
      endTime: e2,
      totalAmount: 50,
      paymentMethod: 'cash',
      slotNo: freeSlot,
    },
    tokenA
  );
  const resId2 = c2.data?.reservation?.id;

  const { start: s3, end: e3 } = futureIso(5, 1);
  const c3 = await json(
    'POST',
    '/reservations',
    {
      userId: userA.id,
      startTime: s3,
      endTime: e3,
      totalAmount: 50,
      paymentMethod: 'cash',
      slotNo: freeSlot,
    },
    tokenA
  );

  const cancelAll = await json('PATCH', '/api/chat/bookings/cancel-all', {}, tokenA);
  if (cancelAll.data?.ok) pass('PATCH /api/chat/bookings/cancel-all');
  else fail('PATCH /api/chat/bookings/cancel-all', cancelAll.data?.error);

  const chatHist = await json('GET', '/api/chat/history', null, tokenA);
  if (chatHist.data?.ok && Array.isArray(chatHist.data.messages)) pass('GET /api/chat/history');
  else fail('GET /api/chat/history', JSON.stringify(chatHist.data));

  const chatMsg = await json(
    'POST',
    '/api/chat/message',
    { message: 'Show my bookings', context: {} },
    tokenA
  );
  if (chatMsg.data?.ok && chatMsg.data.reply) pass('POST /api/chat/message');
  else fail('POST /api/chat/message', chatMsg.data?.error || JSON.stringify(chatMsg.data));

  const hist2 = await json('GET', '/api/chat/history', null, tokenA);
  if ((hist2.data?.messages?.length || 0) >= 2) pass('Chat messages persisted');
  else fail('Chat persistence', `count ${hist2.data?.messages?.length}`);

  const badId = await json('PATCH', '/reservations/999999999/cancel', null, tokenA);
  if (badId.status === 404 || badId.data?.error) pass('Invalid booking ID returns error');
  else fail('Invalid booking ID', `status ${badId.status}`);

  const adminLogin = await json('POST', '/auth/login', {
    usernameOrEmail: process.env.ADMIN_EMAIL || 'admin@parkgo.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123',
    intendedRole: 'admin',
  });
  const adminToken = adminLogin.data?.accessToken;
  if (adminToken) pass('Admin login');
  else fail('Admin login', adminLogin.data?.error || 'no token — set ADMIN_EMAIL/ADMIN_PASSWORD in backend .env');

  if (adminToken) {
    const analytics = await json('GET', '/admin/analytics', null, adminToken);
    if (analytics.data?.ok) pass('GET /admin/analytics');
    else fail('GET /admin/analytics', analytics.data?.error);

    const alerts = await json(
      'GET',
      `/admin/security-alerts?userId=${adminLogin.data.user.id}&afterId=0`,
      null,
      adminToken
    );
    if (alerts.data?.ok) pass('GET /admin/security-alerts');
    else fail('GET /admin/security-alerts', `status ${alerts.status}`);
  }

  const logout = await json('POST', '/auth/logout', { refreshToken: login.data.refreshToken }, tokenA);
  if (logout.data?.ok !== false) pass('POST /auth/logout');

  console.log('\n--- Summary ---');
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok);
  console.log(`${ok}/${results.length} passed`);
  if (bad.length) {
    console.log('\nFailed:');
    bad.forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  console.log('\nAll API checks passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
