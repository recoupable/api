import ast,json,re
from pathlib import Path
import numpy as np
s=Path(__file__).resolve().parent.parent.joinpath('verifiedAudioWorker.ts').read_text().split('String.raw`',1)[1].rsplit('`;',1)[0]
module=ast.parse(s)
helpers=ast.Module(body=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ('waveform_match','refine_match')],type_ignores=[])
exec(compile(helpers,'worker','exec'))
# A 30-second unchanged recording crop starts halfway between coarse samples.
def signal(t): return np.sin(2*np.pi*(251*t+5*t*t))+.6*np.sin(2*np.pi*(410*t+3*t*t))+.3*np.sin(2*np.pi*(137*t+2*t*t))
start=1.00025
x=signal(np.arange(33*2000)/2000)
y=signal(start+np.arange(30*2000)/2000)
o,c=waveform_match(x,y)
# Refine around the offset found by the actual coarse scan.
highx=signal(np.arange(33*16000)/16000)
highy=signal(start+np.arange(30*16000)/16000)
r,h=refine_match(highx,highy,o/2000)
assert c<.95,c
assert h>.999,(r,h)
rng=np.random.default_rng(104)
_,bad=refine_match(highx,rng.normal(size=len(highy)),start)
assert bad<.95,bad
print(json.dumps({'coarse_correlation':c,'aligned_correlation':h,'wrong_audio_correlation':bad,'offset_seconds':r}))
