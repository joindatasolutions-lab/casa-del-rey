import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const require = createRequire(import.meta.url);
export async function setup() {
 const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
 const root = resolve('dist');
 const server = createServer(async (req,res) => {
  let path = resolve(root, '.' + new URL(req.url,'http://localhost').pathname), data;
  if (!path.startsWith(root)) path=resolve(root,'index.html');
  try {data=await readFile(path);} catch {path=resolve(root,'index.html');data=await readFile(path);}
  res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)] || 'application/octet-stream');res.end(data);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM});
 return {browser,base:`http://127.0.0.1:${server.address().port}`,close:async()=>{await browser.close();server.close();}};
}
