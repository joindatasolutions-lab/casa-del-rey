import {setup} from './browser-harness.mjs';
const h=await setup();
try {const p=await h.browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await p.goto(h.base+'/admin/login'); console.log(await p.evaluate(()=>({zoom:visualViewport.scale,title:getComputedStyle(document.querySelector('h1')).fontSize,form:document.querySelector('.login-panel').getBoundingClientRect().width})));} finally {await h.close();}
