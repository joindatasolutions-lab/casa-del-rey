// Run after npm run build. Uses an existing Playwright installation; no app dependencies added.
// PLAYWRIGHT_MODULE may point to playwright-core; PLAYWRIGHT_CHROMIUM may point to Chromium.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('dist');
const server = createServer(async (req, res) => {
  let path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(root + '/') && !path.startsWith(root + '\\')) path = resolve(root, 'index.html');
  let data;
  try { data = await readFile(path); } catch { path = resolve(root, 'index.html'); data = await readFile(path); }
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream');
  res.end(data);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
  for (const hasEvent of [true, false]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const group = { id_grupo: 4, slug: 'grupo-4', nombre_grupo: 'Grupo de amistad', estado: 'ACTIVO', dia_semana: 4, hora: '19:00:00', ubicacion: 'Calle 100 # 20-30, Bogotá' };
    const member = { id_miembro: 12, nombre: 'Ana', apellido: 'Rey' };
    let created = false, creates = 0, refreshes = 0, confirmations = [], failRefresh = true, failCreate = true, failConfirm = true;
    const visitor = () => ({ celular: '3001234567', exists: created, id_grupo: created ? 4 : null, member: created ? member : null });
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let status = 200, body;
      if (path.endsWith('/identificar')) body = { access_token: 'test', user: visitor() };
      else if (path.endsWith('/me')) { refreshes++; status = failRefresh ? 503 : 200; body = failRefresh ? { detail: 'Temporal' } : visitor(); }
      else if (path.endsWith('/eventos/proximo')) { status = hasEvent ? 200 : 404; body = hasEvent ? { id_evento: 8, id_grupo: 4, nombre_evento: 'Encuentro semanal', fecha_evento: '2026-10-08', hora_evento: '19:00:00' } : { detail: 'Sin evento' }; }
      else if (path.endsWith('/grupos/grupo-4')) body = group;
      else if (path.endsWith('/grupos')) body = [group];
      else if (path.endsWith('/miembros')) {
        creates++;
        if (failCreate) { status = 503; body = { detail: 'No se pudo guardar' }; }
        else {
          const payload = route.request().postDataJSON();
          assert.equal(payload.nombre, 'Ana'); assert.equal(payload.apellido, 'Rey');
          assert.equal(payload.genero, 'M'); assert.equal(payload.celular, '3001234567');
          created = true; body = { success: true, exists: false, member };
        }
      } else if (path.endsWith('/asistencias/confirmar')) {
        const payload = route.request().postDataJSON();
        assert.equal(payload.id_miembro, 12); assert.equal(payload.id_evento, 8);
        confirmations.push(payload.confirmacion);
        status = failConfirm ? 503 : 200;
        body = failConfirm ? { detail: 'No se pudo confirmar' } : { success: true, attendance: payload };
      } else throw new Error(`Unexpected API request: ${path}`);
      await new Promise(done => setTimeout(done, 80));
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(base);
    await page.getByRole('textbox', { name: 'Celular', exact: true }).fill('3001234567');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('link', { name: /Ver detalles/ }).click();
    await page.getByRole('button', { name: 'Registrarme en este grupo' }).click();
    assert.equal(await page.locator('[name=genero]').inputValue(), '');
    assert.equal(await page.locator('details').evaluate(el => el.open), false);
    assert.equal(await page.locator('[name=celular]').evaluate(el => el.readOnly), true);
    await page.locator('[name=nombre]').fill('   ');
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    assert.equal(await page.evaluate(() => document.activeElement.name), 'nombre');
    assert.equal(creates, 0);
    await page.locator('[name=nombre]').fill(' Ana ');
    await page.locator('[name=apellido]').fill(' Rey ');
    await page.locator('[name=genero]').selectOption('M');
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `registration overflow ${width}`);
      assert.equal(await page.locator('[name=nombre]').evaluate(el => getComputedStyle(el).fontSize), '16px');
    }
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await page.getByRole('alert').filter({ hasText: 'No se pudo guardar' }).waitFor();
    failCreate = false;
    await page.getByRole('button', { name: 'Guardar y continuar' }).dblclick();
    await page.getByText('Registro guardado correctamente.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reintentar actualización' }).waitFor();
    assert.equal(creates, 2); assert.equal(confirmations.length, 0);
    failRefresh = false;
    await page.getByRole('button', { name: 'Reintentar actualización' }).click();
    await page.getByText('Actualizando sesión...', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(creates, 2); assert.equal(refreshes, 2);
    await page.getByText('Registro guardado correctamente.', { exact: true }).waitFor();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `result overflow ${width}`);
    }
    if (hasEvent) {
      await page.getByRole('button', { name: 'Si, asistire' }).click();
      await page.getByRole('alert').filter({ hasText: 'No se pudo confirmar' }).waitFor();
      failConfirm = false;
      await page.getByRole('button', { name: 'Si, asistire' }).dblclick();
      await page.getByText(/Tu asistencia quedo confirmada/).waitFor();
      assert.deepEqual(confirmations, ['ASISTIRA', 'ASISTIRA']);
      await page.goto(`${base}/grupo/grupo-4`);
      await page.getByRole('button', { name: 'No podre asistir' }).click();
      await page.getByText(/Gracias por avisarnos/).waitFor();
      assert.equal(confirmations.at(-1), 'NO_ASISTIRA');
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `confirmation overflow ${width}`);
      }
    } else {
      assert.equal(await page.getByRole('button', { name: /asistire|No podre asistir|Confirmar asistencia/ }).count(), 0);
    }
    await page.goto(base);
    await page.goto(`${base}/gracias`);
    await page.getByText('No hay una confirmación para mostrar.', { exact: false }).waitFor();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await page.getByRole('link', { name: /Ver detalles/ }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `home overflow ${width}`);
      const bar = await page.locator('.public-session-bar').boundingBox();
      assert.equal(bar.width, width);
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS registration ${hasEvent ? 'with' : 'without'} event, refresh recovery, validation, routing, responsive`);
  }
} finally {
  await browser?.close();
  server.close();
}
