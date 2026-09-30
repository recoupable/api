/** Runs in an isolated VM without application credentials. Input is server-resolved Spotify metadata. */
export const verifiedAudioWorker = String.raw`
import json, subprocess, sys, pathlib, re, wave, hashlib, urllib.request
import numpy as np
import imageio_ffmpeg
stage='initialization'
decisions=[]
def diagnostic(kind, value, tb):
    message=str(value)
    if isinstance(value, subprocess.CalledProcessError):
        message=(value.stderr or b'').decode('utf-8','replace')
    message=re.sub(r'https?://\S+', '[URL]', message)[-1600:]
    print(json.dumps({'stage':stage,'error':kind.__name__,'message':message,'candidates':decisions}),file=sys.stderr)
sys.excepthook=diagnostic
r=json.load(open('input.json'))
mode=sys.argv[1]
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
def run(args,timeout=90):
    return subprocess.check_output(args,timeout=timeout,stderr=subprocess.PIPE)
def yt(args):
    return run([sys.executable,'-m','yt_dlp','--ignore-config','--js-runtimes','node','--socket-timeout','20','--retries','0','--extractor-retries','0',*args])
def norm(s): return re.sub(r'[^\w]+',' ',s.lower()).strip()
stage='verification preview'
preview=r['previewUrl']
# Preview URL has already been validated by the caller; disallow redirects here.
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
if mode=='discover':
    with urllib.request.build_opener(NoRedirect).open(preview,timeout=25) as response:
        data=response.read(4000001)
        if len(data)>4000000: raise ValueError('Preview exceeds size limit')
    pathlib.Path('preview.mp3').write_bytes(data)
def pcm(path, rate=2000):
    return np.frombuffer(run([ffmpeg,'-v','error','-i',str(path),'-t','1200','-ac','1','-ar',str(rate),'-f','f32le','-']),dtype='<f4').astype(np.float64)
def waveform_match(x,y):
    y=y-y.mean()
    n=len(y)
    if len(x)<n or n<2 or np.dot(y,y)<1e-8: raise ValueError('Insufficient waveform for match')
    L=1<<(len(x)+n-2).bit_length()
    corr=np.fft.irfft(np.fft.rfft(x,L)*np.fft.rfft(y[::-1],L),L)[n-1:len(x)]
    sums=np.concatenate(([0.],np.cumsum(x)));squares=np.concatenate(([0.],np.cumsum(x*x)))
    energy=np.maximum(squares[n:]-squares[:-n]-(sums[n:]-sums[:-n])**2/n,0)
    score=corr/np.sqrt(np.maximum(energy*np.dot(y,y),1e-20))
    offset=int(np.argmax(score))
    return offset,float(np.clip(score[offset],-1,1))
def refine_match(x,y,coarse_seconds,rate=16000):
    # Search a small neighborhood at higher resolution; keep the same whole-preview threshold.
    start=max(0,int(coarse_seconds*rate)-32)
    end=min(len(x),int(coarse_seconds*rate)+len(y)+33)
    offset,confidence=waveform_match(x[start:end],y)
    return (start+offset)/rate,confidence
y=pcm('preview.mp3'); y=y-y.mean()
if len(y)<30000 or np.dot(y,y)<1e-8: raise ValueError('Insufficient preview for waveform match')
def matches_metadata(candidate, recording):
    title=norm(re.sub(r'\s*\((?:feat\.?|ft\.?).*?\)','',recording['title'],flags=re.I))
    text=norm(candidate.get('title','')+' '+(candidate.get('channel') or ''))
    # Upload titles often censor a word while the provider spells it out.
    words=re.findall(r'[\w*]+',candidate.get('title','').lower())
    if not all(any(re.fullmatch(re.escape(word).replace(r'\*',r'\w*'), expected) for word in words) for expected in title.split()): return False
    if abs((candidate.get('duration') or 0)-recording['durationSeconds'])>2: return False
    # Featured credits may have renamed since release (e.g. GOLDN / Joshua Golden).
    # Lead-artist metadata screens candidates; the waveform establishes recording identity.
    if norm(recording['artists'][0]).replace(' ','') not in text.replace(' ',''): return False
    alternatives=['live','remix','acoustic','instrumental','karaoke','cover','sped up','slowed','clean']
    return not any((' '+v+' ') in (' '+text+' ') and (' '+v+' ') not in (' '+norm(recording['title'])+' ') for v in alternatives)
def discover_candidates(recording):
    # Exact names prevent the search engine from substituting popular unrelated artists.
    artist=recording['artists'][0].replace('"',' ').strip()
    title=recording['title'].replace('"',' ').strip()
    queries=['"'+artist+'" "'+title+'"',title+' '+artist+' audio']
    for query in queries:
        search=json.loads(yt(['--flat-playlist','--skip-download','--dump-single-json','--','ytsearch10:'+query]))
        eligible=[c for c in (search.get('entries') or [])[:10] if c and re.fullmatch(r'[A-Za-z0-9_-]{11}',c.get('id','')) and matches_metadata(c,recording)]
        if eligible: return eligible[:3]
    return []
stage='YouTube search' if mode=='discover' else 'candidate matching'
if mode=='discover':
    json.dump(discover_candidates(r),open('candidates.json','w'))
    sys.exit(0)
candidate=json.load(open('candidate.json'))
candidates=[candidate] if matches_metadata(candidate,r) else []
for c in candidates:
    vid=c['id']
    path=pathlib.Path('candidate.mp3')
    try:
        if path.stat().st_size>40000000: raise ValueError('Audio exceeds size limit')
        stage='waveform verification'
        x=pcm(path)
        if len(x)<len(y) or abs(len(x)/2000-r['durationSeconds'])>2: continue
        n=len(y)
        offset,confidence=waveform_match(x,y)
        offset_seconds=offset/2000
        if confidence<0.95:
            precise_y=pcm('preview.mp3',16000)
            precise_x=pcm(path,16000)
            offset_seconds,confidence=refine_match(precise_x,precise_y,offset_seconds)
        decisions.append({'videoId':vid,'correlation':confidence})
        if confidence<0.95: continue
        run([ffmpeg,'-v','error','-y','-i',str(path),'-t','1200','-ac','1','-ar','16000','-c:a','pcm_s16le','audio.wav'])
        with wave.open('audio.wav','rb') as w: seconds=w.getnframes()/w.getframerate()
        if abs(seconds-r['durationSeconds'])>2: raise ValueError('Normalized duration mismatch')
        b=pathlib.Path('audio.wav').read_bytes()
        json.dump({'youtubeUrl':'https://www.youtube.com/watch?v='+vid,'sha256':hashlib.sha256(b).hexdigest(),'durationSeconds':seconds,'verification':{'method':'waveform-cross-correlation','correlation':confidence,'previewSeconds':n/2000,'offsetSeconds':offset_seconds},'decisions':decisions},open('result.json','w'))
        break
    except (subprocess.SubprocessError,OSError,ValueError) as error:
        detail=(error.stderr or b'').decode('utf-8','replace') if isinstance(error,subprocess.CalledProcessError) else str(error)
        decisions.append({'videoId':vid,'stage':stage,'error':type(error).__name__,'detail':re.sub(r'https?://\S+','[URL]',detail)[-500:]})
else:
    raise ValueError('No full recording passed preview waveform verification')
`;
