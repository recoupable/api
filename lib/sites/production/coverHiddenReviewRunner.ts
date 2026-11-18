import { coverHiddenRunner } from "./coverHiddenRunner";

/** Supplemental fresh initial views in the existing isolated VM; normal journey bytes stay fixed. */
export const coverHiddenReviewRunner = `const fs=require('node:fs');const {chromium:pw}=require('playwright-core');const chromium=require('@sparticuz/chromium');
const captureCoverHidden=${coverHiddenRunner};
// Hard wall-clock bound within the existing Sandbox lifetime; no internal extension or retry. The existing journey correction may invoke this runner again.
const deadline=setTimeout(()=>process.exit(1),30000);
(async()=>{let browser;const reports=[];try{
 const input=JSON.parse(fs.readFileSync('cover-review.json','utf8'));
 if(!input.artworkUrl){for(const name of ['mobile','desktop'])reports.push({name,status:input.status==='missing-input'?'missing-input':'unverified',reason:input.reason,masked:[]});return;}
 browser=await pw.launch({timeout:10000,executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!["--disable-web-security","--allow-running-insecure-content","--single-process"].includes(a)),headless:true});
 for(const [name,width,height] of [['mobile',390,844],['desktop',1440,900]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});page.setDefaultTimeout(5000);
  await page.route('**/*',r=>['image','media'].includes(r.request().resourceType())?r.continue():r.abort());
  await page.goto('about:blank');
  await page.setContent('<iframe title="Experience" sandbox="allow-scripts" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>');
  await page.locator('iframe').evaluate((frame,content)=>new Promise(resolve=>{frame.onload=()=>resolve();frame.srcdoc=content;}),fs.readFileSync('experience.html','utf8'));
  const ui=page.frameLocator('iframe');await ui.locator('body').waitFor();
  reports.push({name,...await captureCoverHidden(page,ui,name,input)});await page.close();
 }
}finally{if(browser)await browser.close();fs.writeFileSync('cover-review-report.json',JSON.stringify(reports));clearTimeout(deadline);}})().catch(e=>{console.error(e);process.exit(1)});`;
