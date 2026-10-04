import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup } from './browser-harness.mjs';

// Pure date-contract checks, including Bogotá's boundary while UTC is already tomorrow.
const source = (await readFile('src/api/services.js', 'utf8')).replace('import api from "./api";', '').replaceAll('export ', '');
const { getLastCompletedEvent, eventTimingMessage } = new Function(`${source};return {getLastCompletedEvent,eventTimingMessage}`)();
const now = new Date('2026-10-05T02:00:00Z'); // Oct 4, 21:00 Bogotá
const closed = { id_evento: 1, estado: 'CERRADO', fecha_evento: '2026-10-04', hora_evento: '20:00:00' };
assert.equal(getLastCompletedEvent([{ ...closed, hora_evento: '22:00:00' }], now), null);
assert.equal(getLastCompletedEvent([{ ...closed, hora_evento: null }], now), null);
assert.equal(getLastCompletedEvent([{ ...closed, estado: 'ACTIVO' }], now), null);
assert.equal(getLastCompletedEvent([{ ...closed, estado: 'CANCELADO' }], now), null);
assert.equal(getLastCompletedEvent([], now), null);
assert.equal(getLastCompletedEvent([closed], now).id_evento, 1);
assert.equal(getLastCompletedEvent([{ ...closed, fecha_evento: '2026-10-03', hora_evento: null }], now).id_evento, 1);
assert.equal(eventTimingMessage(closed, now), 'Encuentro cerrado.');
console.log('PASS event status and Bogotá date boundaries');

const h = await setup();
const group = id => ({ id_grupo: id, nombre_grupo: `Grupo ${id}`, estado: 'ACTIVO' });
const event = (id, groupId = 1) => ({ id_evento: id, id_grupo: groupId, nombre_evento: `Evento ${id}`, estado: 'CERRADO', fecha_evento: '2020-01-01', hora_evento: '19:00:00', ofrenda_global: 0 });
const members = [1, 2].map(id => ({ id_miembro: id, id_grupo: 1, nombre: `Persona ${id}`, apellido: 'Prueba', celular: `300000000${id}`, genero: 'H', rio_de_dios: 'NUEVO', estado: 'ACTIVO', asistio: null }));
const detail = id => ({ event: event(id, id >= 20 ? 2 : 1), group: group(id >= 20 ? 2 : 1), members, metrics: { tasa_asistencia: 0, confirmaron: 0, confirmaron_no: 0, pendientes: 2, asistieron: 0, no_asistieron: 0, nuevos: 0, lideres: 0, llegaron_sin_confirmar: 0 } });
const pending = new Map();
let listGate = null, attendanceGate = null, holdWrites = false, failList = false, failDetail = false, failStatus = false, emptyEvents = false;
let writes = [], listCalls = 0;
const fulfill = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function fixture(role = 'SUPER_ADMIN', loggedIn = true) {
  const context = await h.browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const user = { id_usuario: 1, nombre: 'Admin', rol: role, id_grupo: role === 'LIDER_GRUPO' ? 1 : null };
  if (loggedIn) await context.addInitScript(user => localStorage.setItem('casa_del_rey_auth', JSON.stringify({ token: 'test', user })), user);
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => { throw error; });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    const method = route.request().method();
    if (path === '/auth/login') return fulfill(route, { access_token: 'test', user });
    if (path === '/auth/me') return fulfill(route, user);
    if (path === '/grupos') return fulfill(route, role === 'LIDER_GRUPO' ? [group(1)] : [group(1), group(2)]);
    if (path === '/miembros') return fulfill(route, members);
    if (/\/grupos\/\d+\/eventos$/.test(path)) {
      listCalls++;
      if (listGate) { pending.set(path, route); return; }
      return fulfill(route, failList ? { detail: 'Fallo de listado' } : emptyEvents ? [] : path.includes('/2/') ? [event(20, 2)] : [event(10), event(11)], failList ? 503 : 200);
    }
    if (/\/eventos\/\d+\/asistencia$/.test(path)) {
      if (attendanceGate) { pending.set(path, route); return; }
      return fulfill(route, failDetail ? { detail: 'Fallo de asistencia' } : detail(Number(path.split('/')[2])), failDetail ? 503 : 200);
    }
    if (method === 'PATCH' || method === 'POST') {
      const payload = route.request().postDataJSON(); writes.push({ path, payload });
      if (holdWrites) { pending.set(`${path}:${payload.id_miembro || ''}`, route); return; }
      if (path.endsWith('/estado') && failStatus) return fulfill(route, { detail: 'Fallo de estado' }, 503);
      return fulfill(route, { event: { ...event(10), ...payload }, attendance: payload });
    }
    return fulfill(route, { detail: 'No encontrado' }, 404);
  });
  return { page, context };
}
async function waitPending(key) {
  for (let i = 0; i < 100 && !pending.has(key); i++) await new Promise(r => setTimeout(r, 20));
  assert.ok(pending.has(key), `pending request ${key}`);
  const route = pending.get(key); pending.delete(key); return route;
}
const visible = locator => locator.waitFor({ state: 'visible' });
try {
  const { page, context } = await fixture();
  await page.goto(h.base + '/admin');
  await visible(page.getByText('0% de asistencia registrada', { exact: true }));
  await visible(page.getByText('Encuentro cerrado.', { exact: true }));
  assert.ok((await page.getByRole('link', { name: 'Gestionar pendientes' }).getAttribute('href')).includes('grupo=1&evento=10'));
  await page.getByRole('link', { name: 'Gestionar pendientes' }).click();
  await visible(page.getByRole('heading', { name: 'Evento 10', exact: true }));
  holdWrites = true;
  const cards = page.locator('.member-card');
  await cards.nth(0).getByRole('button', { name: 'Si asistio', exact: true }).click();
  await cards.nth(1).getByRole('button', { name: 'Si asistio', exact: true }).click();
  await fulfill(await waitPending('/asistencias/marcar:1'), {});
  await cards.nth(0).getByRole('button', { name: 'Si asistio', exact: true }).waitFor();
  assert.equal(await cards.nth(1).getByRole('button', { name: 'Si asistio', exact: true }).isDisabled(), true);
  attendanceGate = true;
  await page.getByLabel('Evento', { exact: true }).selectOption('11');
  assert.equal(await page.locator('.member-card').count(), 0);
  await fulfill(await waitPending('/asistencias/marcar:2'), {});
  await fulfill(await waitPending('/eventos/11/asistencia'), detail(11));
  await visible(page.getByRole('heading', { name: 'Evento 11', exact: true }));
  assert.equal(await page.getByText('Asistio: SI', { exact: true }).count(), 0);
  assert.deepEqual(writes.map(w => w.payload.id_evento), [10, 10]);
  await page.getByLabel('Evento', { exact: true }).selectOption('10');
  const old = await waitPending('/eventos/10/asistencia');
  await page.getByLabel('Evento', { exact: true }).selectOption('11');
  await fulfill(await waitPending('/eventos/11/asistencia'), detail(11));
  await fulfill(old, detail(10));
  await visible(page.getByRole('heading', { name: 'Evento 11', exact: true }));
  attendanceGate = null; holdWrites = false;
  holdWrites = true;
  await page.getByLabel('Ofrenda global').fill('75');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const oldOffering = await waitPending('/eventos/11/ofrenda:');
  await page.getByLabel('Grupo', { exact: true }).selectOption('2');
  await visible(page.getByRole('heading', { name: 'Evento 20', exact: true }));
  await fulfill(oldOffering, { success: true });
  assert.equal(await page.getByLabel('Ofrenda global').inputValue(), '0');
  assert.equal(await page.getByText('Ofrenda actualizada.', { exact: true }).count(), 0);
  holdWrites = false; failDetail = true;
  await page.getByLabel('Grupo', { exact: true }).selectOption('1');
  await visible(page.getByRole('alert').filter({ hasText: 'Fallo de asistencia' }));
  assert.equal(await page.locator('.member-card').count(), 0);
  failDetail = false;
  console.log('PASS concurrent saves, selection changes and stale attendance responses');

  await page.goto(h.base + '/admin/eventos');
  await visible(page.getByRole('heading', { name: 'Evento 10', exact: true }));
  listGate = true;
  await page.getByLabel('Grupo', { exact: true }).selectOption('2');
  const oldList = await waitPending('/grupos/2/eventos');
  await page.getByLabel('Grupo', { exact: true }).selectOption('1');
  await fulfill(await waitPending('/grupos/1/eventos'), [event(10), event(11)]);
  await fulfill(oldList, [event(20, 2)]);
  await visible(page.getByRole('heading', { name: 'Evento 10', exact: true }));
  assert.equal(await page.getByRole('heading', { name: 'Evento 20' }).count(), 0);
  listGate = null; failStatus = true;
  await page.locator('.member-card').first().getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await visible(page.getByRole('status').filter({ hasText: 'Los datos del evento se guardaron.' }));
  await visible(page.getByRole('alert').filter({ hasText: 'No se pudo actualizar el estado' }));
  failStatus = false; failList = true;
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await visible(page.getByRole('status').filter({ hasText: 'Evento actualizado.' }));
  await visible(page.getByRole('alert').filter({ hasText: 'No se pudo recargar el listado' }));
  failList = false;
  const writeCount = writes.length;
  await page.getByRole('button', { name: 'Recargar listado' }).click();
  await visible(page.getByRole('heading', { name: 'Evento 10', exact: true }));
  assert.equal(writes.length, writeCount);
  console.log('PASS stale event lists, partial save and reload recovery without duplicate writes');

  emptyEvents = true;
  await page.goto(h.base + '/admin');
  await page.getByText('Cargando metricas...').waitFor({ state: 'hidden' });
  assert.deepEqual(await page.locator('.summary-card strong').allTextContents(), ['—', '—', '—', '—', '—']);
  emptyEvents = false; failDetail = true;
  await page.reload();
  await visible(page.getByRole('alert').filter({ hasText: 'Fallo de asistencia' }));
  assert.deepEqual(await page.locator('.summary-card strong').allTextContents(), ['—', '—', '—', '—', '—']);
  failDetail = false;
  for (const path of ['/admin', '/admin/eventos', '/admin/miembros']) {
    await page.goto(h.base + path);
    if (path === '/admin') await visible(page.getByText('0% de asistencia registrada', { exact: true }));
    else if (path === '/admin/eventos') await visible(page.getByRole('heading', { name: 'Evento 10', exact: true }));
    else await visible(page.getByRole('button', { name: 'Actualizar etapa', exact: true }).first());
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} overflow ${width}`);
    }
  }
  await context.close();

  const leader = await fixture('LIDER_GRUPO');
  await leader.page.goto(h.base + '/admin/asistencia?grupo=2&evento=20');
  await visible(leader.page.getByRole('heading', { name: 'Evento 10', exact: true }));
  assert.equal(await leader.page.getByLabel('Grupo', { exact: true }).count(), 0);
  for (const width of [320, 375, 768, 1440]) {
    await leader.page.setViewportSize({ width, height: 1000 });
    assert.equal(await leader.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `attendance overflow ${width}`);
  }
  await leader.context.close();
  const login = await fixture('SUPER_ADMIN', false);
  await login.page.goto(h.base + '/admin/login');
  for (const width of [320, 375, 768, 1440]) {
    await login.page.setViewportSize({ width, height: 900 });
    assert.equal(await login.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `login overflow ${width}`);
    const sizes = await login.page.evaluate(() => ({ zoom: visualViewport.scale, title: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize), input: parseFloat(getComputedStyle(document.querySelector('input')).fontSize) }));
    assert.equal(sizes.zoom, 1); assert.ok(sizes.title >= 30 && sizes.title <= 36); assert.equal(sizes.input, 16);
  }
  await login.page.getByLabel('Correo electrónico', { exact: true }).fill('nombre@dominio.com');
  await login.page.locator('input[name=password]').fill('Password123!');
  await login.page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  assert.equal(await login.page.locator('input[name=password]').getAttribute('type'), 'text');
  await login.page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await visible(login.page.getByRole('heading', { name: 'Dashboard', exact: true }));
  await login.context.close();
  console.log('PASS missing/error metrics, leader scope, login, keyboard labels and responsive at 100% zoom');
} finally { await h.close(); }
