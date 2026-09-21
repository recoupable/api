/** Browser runner for a disposable, credential-free VM. Never executes model-supplied test code. */
export const journeyRunner = `const fs=require('node:fs');const {chromium:pw}=require('playwright-core');const chromium=require('@sparticuz/chromium');
(async()=>{const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!["--disable-web-security","--allow-running-insecure-content","--single-process"].includes(a)),headless:true});const results=[];
const plan=JSON.parse(fs.readFileSync('journey.json','utf8'));
for(const [name,width,height] of [['mobile',390,844],['desktop',1440,900]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',acceptDownloads:true});const errors=[];const steps=[];const artifacts=[];
 page.on('pageerror',e=>errors.push(e.message.slice(0,300)));
 const shares=[];
 await page.exposeFunction('__recordShare',payload=>shares.push(payload));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(navigator,'share',{value:async data=>{const files=[];for(const f of data.files||[]){files.push({name:f.name,type:f.type,bytes:Array.from(new Uint8Array(await f.arrayBuffer()))});}await window.__recordShare({files});},configurable:true});});
 await page.route('**/*',r=>r.request().resourceType()==='image'?r.continue():r.abort());
 // setContent does not run addInitScript, so navigate to the local document first.
 await page.goto('about:blank');
 const content=fs.readFileSync('experience.html','utf8');
 await page.setContent('<iframe title="Experience" sandbox="allow-scripts allow-downloads" allow="web-share *" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>');
 await page.locator('iframe').evaluate((frame,content)=>new Promise(resolve=>{frame.onload=()=>resolve();frame.srcdoc=content;}),content);
 const ui=page.frameLocator('iframe');await ui.locator('body').waitFor();
 await page.screenshot({path:name+'.png'});const before=await ui.locator('body').innerText();let interacted=false;
 async function verifyImage(bytes,label){
  if(bytes.length<100 || bytes.length>20000000)throw Error(label+': empty or oversized image');
  const encoded=Buffer.from(bytes).toString('base64');
  const info=await page.evaluate(async encoded=>{const img=new Image();img.src='data:image/png;base64,'+encoded;await img.decode();if(img.width<128||img.height<128)throw Error('Image too small');const c=document.createElement('canvas');c.width=32;c.height=32;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,32,32);const px=ctx.getImageData(0,0,32,32).data;const colors=new Set();for(let i=0;i<px.length;i+=4)colors.add([px[i],px[i+1],px[i+2],px[i+3]].join(','));if(colors.size<8)throw Error('Blank or nearly blank exported image');return {width:img.width,height:img.height};},encoded);
  artifacts.push({label,bytes:bytes.length,...info});
  // Reopen the delivered bytes in a separate browser page, independent of the experience DOM.
  const resultPage=await browser.newPage({viewport:{width:600,height:800}});await resultPage.setContent('<img style="max-width:100%" src="data:image/png;base64,'+encoded+'">');await resultPage.locator('img').evaluate(img=>img.decode());await resultPage.screenshot({path:name+'-result.png'});await resultPage.close();
 }
 for(const [index,step] of (plan?.steps||[]).entries()){
  try{
   if(step.action==='fill') await ui.getByLabel(step.target,{exact:true}).fill(step.value,{timeout:5000});
   else if(step.action==='press') await ui.getByLabel(step.target,{exact:true}).press(step.value,{timeout:5000});
   else if(step.action==='download'){
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:8000}),ui.getByRole('button',{name:step.target,exact:true}).click({timeout:5000})]);
    if(await download.failure())throw Error('Download failed');await verifyImage(fs.readFileSync(await download.path()),'download');
   }else if(step.action==='share'){
    const count=shares.length;await ui.getByRole('button',{name:step.target,exact:true}).click({timeout:5000});
    for(let n=0;n<40&&shares.length===count;n++)await page.waitForTimeout(100);
    const share=shares[count];if(!share?.files?.length)throw Error('Share did not deliver an image File');await verifyImage(share.files[0].bytes,'share payload (OS delivery not tested)');
   }else await ui.getByRole('button',{name:step.target,exact:true}).click({timeout:5000});
   interacted=true;
   if(step.expected)await ui.getByText(step.expected,{exact:false}).first().waitFor({state:'visible',timeout:5000});
   steps.push({index,checkpoint:step.checkpoint,passed:true});
  }catch(e){errors.push('Step '+(index+1)+' '+step.target+': '+e.message.slice(0,300));steps.push({index,checkpoint:step.checkpoint,passed:false});break;}
 }
 if(!plan?.steps?.length)errors.push('No complete fan journey contract');
 await page.screenshot({path:name+'-active.png'});
 results.push({name,errors,interacted,changed:before!==await ui.locator('body').innerText(),journeyPassed:!!plan?.steps?.length&&steps.length===plan.steps.length&&steps.every(s=>s.passed),steps,artifacts,overflow:await ui.locator('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth),text:(await ui.locator('body').innerText()).slice(0,4000)});await page.close();
}await browser.close();fs.writeFileSync('review.json',JSON.stringify(results));})().catch(e=>{console.error(e);process.exit(1)});`;
