/** Fixed runner code: screenshot-only masks of exact-source inline images; no positional selectors. */
export const coverHiddenRunner = `async function captureCoverHidden(page,ui,name,input){
 const unavailable=(reason,status='unverified')=>({status,reason,masked:[]});
 if(!input.artworkUrl)return unavailable(input.reason,input.status==='missing-input'?'missing-input':'unverified');
 try{
  const images=ui.locator('img');
  if(await images.count()>200)return unavailable('Inline image inspection exceeds the 200-image bound.');
  const inspect=()=>images.evaluateAll((nodes,url)=>nodes.flatMap((img,index)=>{
   const box=img.getBoundingClientRect();const style=getComputedStyle(img);
   if(img.getAttribute('src')!==url||img.hasAttribute('srcset')||img.closest('picture')||img.currentSrc!==url||!img.complete||!img.naturalWidth||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||box.width<=0||box.height<=0||box.right<=0||box.bottom<=0||box.x>=innerWidth||box.y>=innerHeight)return [];
   return [{index,src:img.currentSrc,box:{x:box.x,y:box.y,width:box.width,height:box.height}}];
  }),input.artworkUrl);
  const matched=await inspect();
  if(!matched.length)return unavailable('No loaded visible exact-source inline cover; CSS backgrounds, canvas, picture/srcset and transformed copies are unverified.');
  if(matched.length>8)return unavailable('More than eight visible cover images; bounded hiding not attempted.');
  // Hex-escape every URL character. No model-supplied selector or positional lookup.
  const escaped=Array.from(input.artworkUrl,c=>'\\\\'+c.codePointAt(0).toString(16)+' ').join('');
  const selector='img[src="'+escaped+'"]:not([srcset]):not(picture img):visible';
  const targets=ui.locator(selector);
  if(await targets.count()!==matched.length)return unavailable('Mask targets include unsupported, transparent, unloaded or offscreen cover images.');
  await page.screenshot({path:name+'-cover-hidden.png',mask:[targets],maskColor:'#808080',timeout:5000});
  if(await targets.count()!==matched.length||JSON.stringify(await inspect())!==JSON.stringify(matched))return unavailable('Cover elements or geometry changed during capture; screenshot not used.');
  return {status:'captured',reason:'Browser-level neutral masks suppress exact-source inline cover boxes regardless of author CSS. Overlapping pixels are masked too; other representations and later states are unverified.',masked:matched};
 }catch{return unavailable('Cover identification or bounded screenshot capture failed.');}
}`;
