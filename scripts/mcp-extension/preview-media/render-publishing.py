from PIL import Image, ImageDraw, ImageFont
import math, random, subprocess
from pathlib import Path
W,H,FPS=1280,720,24
out=Path('public/mcp/organize-publishing.mp4')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',84)
random.seed(14)
papers=[(random.uniform(-300,1500),random.uniform(-250,950),random.uniform(-65,65)) for _ in range(32)]
def ease(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
p=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','23','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for frame in range(FPS*8):
 t=frame/FPS;im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
 for y in range(H):d.line((0,y,W,y),fill=(12+int(y/60),25+int(y/32),40+int(y/25)))
 for j in range(6):
  pts=[(x, int(360+150*math.sin(x/210+t*1.2+j*.7))) for x in range(-20,W+20,8)]
  d.line(pts,fill=(35+j*8,72+j*9,91+j*9),width=3)
 q=ease((t-1.5)/3)
 for i,(sx,sy,angle) in enumerate(papers):
  dx=85+(i%8)*153;dy=70+(i//8)*160
  x=sx*(1-q)+dx*q+18*math.sin(t*2+i)*(1-q);y=sy*(1-q)+dy*q
  tile=Image.new('RGBA',(130,140),(240,223,181,255));td=ImageDraw.Draw(tile)
  for k in range(5):td.line((12,35+k*10,118,35+k*10),fill=(98,104,100,160),width=1)
  td.ellipse((45,45,72,64),fill=(30,49,58));td.line((71,52,71,24),fill=(30,49,58),width=3)
  rotated=tile.rotate(angle*(1-q),expand=True,resample=Image.Resampling.BICUBIC)
  im.paste(rotated,(int(x),int(y)),rotated)
 # Piano keys provide a musical foundation beneath the moving score.
 d=ImageDraw.Draw(im)
 for i in range(24):
  x=i*55-20;d.rounded_rectangle((x,645,x+51,740),radius=5,fill=(235,226,205))
  if i%7 not in [2,6]:d.rectangle((x+38,645,x+67,688),fill=(12,20,28))
 reveal=ease((t-4.25)/.7)
 if reveal:
  overlay=Image.new('RGBA',(W,H),(0,0,0,0));od=ImageDraw.Draw(overlay)
  od.rounded_rectangle((115,205,1165,510),radius=18,fill=(10,25,38,int(235*reveal)))
  for i,line in enumerate(['ORGANIZE MY','PUBLISHING']):
   width=od.textlength(line,font=font);yy=245+i*105+int(30*(1-reveal))
   od.text(((W-width)/2+3,yy+4),line,font=font,fill=(0,0,0,int(160*reveal)))
   od.text(((W-width)/2,yy),line,font=font,fill=(248,234,202,int(255*reveal)))
  im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
 p.stdin.write(im.tobytes())
p.stdin.close();assert p.wait()==0
print(out, out.stat().st_size)
