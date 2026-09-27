/** Runs in an isolated VM without application credentials. Input is server-resolved Spotify metadata. */
export const verifiedAudioWorker = String.raw`
import json, subprocess, sys, pathlib, re, wave, hashlib, urllib.request
import numpy as np
import imageio_ffmpeg
r=json.load(open('input.json'))
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
def run(args,timeout=90):
    return subprocess.check_output(args,timeout=timeout,stderr=subprocess.PIPE)
def yt(args):
    return run([sys.executable,'-m','yt_dlp','--ignore-config','--js-runtimes','node','--socket-timeout','20','--retries','0','--extractor-retries','0',*args])
def norm(s): return re.sub(r'[^\w]+',' ',s.lower()).strip()
preview=r['previewUrl']
# Preview URL has already been validated by the caller; disallow redirects here.
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
with urllib.request.build_opener(NoRedirect).open(preview,timeout=25) as response:
    data=response.read(4000001)
    if len(data)>4000000: raise ValueError('Preview exceeds size limit')
pathlib.Path('preview.mp3').write_bytes(data)
def pcm(path):
    return np.frombuffer(run([ffmpeg,'-v','error','-i',str(path),'-t','1200','-ac','1','-ar','2000','-f','f32le','-']),dtype='<f4').astype(np.float64)
y=pcm('preview.mp3'); y=y-y.mean()
if len(y)<30000 or np.dot(y,y)<1e-8: raise ValueError('Insufficient preview for waveform match')
search=json.loads(yt(['--flat-playlist','--skip-download','--dump-single-json','--','ytsearch5:'+r['title']+' '+' '.join(r['artists'])+' audio']))
title=norm(re.sub(r'\s*\((?:feat\.?|ft\.?).*?\)','',r['title'],flags=re.I))
decisions=[]
for c in search.get('entries',[])[:5]:
    vid=c.get('id',''); duration=c.get('duration') or 0
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}',vid): continue
    text=norm(c.get('title','')+' '+(c.get('channel') or ''))
    if title not in text or abs(duration-r['durationSeconds'])>2: continue
    if not all(norm(a) in text for a in r['artists']): continue
    alternatives=['live','remix','acoustic','instrumental','karaoke','cover','sped up','slowed','clean']
    if any(v in text.split() and v not in norm(r['title']).split() for v in alternatives): continue
    path=pathlib.Path('candidate.m4a');path.unlink(missing_ok=True)
    try:
        yt(['--no-playlist','--no-progress','--max-filesize','40M','--match-filter','duration <= 1200','-f','bestaudio[ext=m4a]','-o',str(path),'--','https://www.youtube.com/watch?v='+vid])
        if path.stat().st_size>40000000: raise ValueError('Audio exceeds size limit')
        x=pcm(path)
        if len(x)<len(y) or abs(len(x)/2000-r['durationSeconds'])>2: continue
        n=len(y); L=1<<(len(x)+n-2).bit_length()
        corr=np.fft.irfft(np.fft.rfft(x,L)*np.fft.rfft(y[::-1],L),L)[n-1:len(x)]
        sums=np.concatenate(([0.],np.cumsum(x)));squares=np.concatenate(([0.],np.cumsum(x*x)))
        energy=np.maximum(squares[n:]-squares[:-n]-(sums[n:]-sums[:-n])**2/n,0)
        score=corr/np.sqrt(np.maximum(energy*np.dot(y,y),1e-20))
        offset=int(np.argmax(score)); confidence=float(np.clip(score[offset],-1,1))
        decisions.append({'videoId':vid,'correlation':confidence})
        if confidence<0.95: continue
        run([ffmpeg,'-v','error','-y','-i',str(path),'-t','1200','-ac','1','-ar','16000','-c:a','pcm_s16le','audio.wav'])
        with wave.open('audio.wav','rb') as w: seconds=w.getnframes()/w.getframerate()
        if abs(seconds-r['durationSeconds'])>2: raise ValueError('Normalized duration mismatch')
        b=pathlib.Path('audio.wav').read_bytes()
        json.dump({'youtubeUrl':'https://www.youtube.com/watch?v='+vid,'sha256':hashlib.sha256(b).hexdigest(),'durationSeconds':seconds,'verification':{'method':'waveform-cross-correlation','correlation':confidence,'previewSeconds':n/2000,'offsetSeconds':offset/2000},'decisions':decisions},open('result.json','w'))
        break
    except (subprocess.SubprocessError,OSError,ValueError):
        decisions.append({'videoId':vid,'unavailable':True})
else:
    raise ValueError('No full recording passed preview waveform verification')
`;
