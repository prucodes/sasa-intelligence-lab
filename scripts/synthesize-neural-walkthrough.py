"""Generate the approved Indian English voice for the existing recording captions.

    python scripts/synthesize-neural-walkthrough.py --out <folder>

<folder> is a take recorded by record-current-walkthrough.mjs; its timeline.json is read and narration-neural/ is written there.
"""
import argparse
import asyncio
import json
import subprocess
import sys
from pathlib import Path

parser = argparse.ArgumentParser(description='Generate the Indian English neural voice for a recorded walkthrough.')
parser.add_argument('--out', required=True, help='folder holding the recorded take (its timeline.json); narration-neural/ is written inside it')
ROOT = Path(parser.parse_args().out).resolve()
if not (ROOT / 'timeline.json').exists():
    sys.exit(f'No timeline.json in {ROOT}. Record the take there first with record-current-walkthrough.mjs --out.')
# Imported after the argument check, so --help and argument errors work where edge-tts isn't installed.
import edge_tts

OUT = ROOT / 'narration-neural'
VOICE = 'en-IN-NeerjaExpressiveNeural'

async def main():
    OUT.mkdir(exist_ok=True)
    cues = json.loads((ROOT / 'timeline.json').read_text())['cues']
    for i, cue in enumerate(cues, 1):
        text = (cue['text'].replace('ULB’s', 'U L B’s').replace('ULBs', 'U L Bs')
                .replace('ULB', 'U L B').replace('May–August', 'May to August')
                .replace('12 August 2026', 'the twelfth of August, twenty twenty six')
                .replace('panchayat-day', 'panchayat day'))
        stem = OUT / f'{i:02}'
        stem.with_suffix('.txt').write_text(text)
        await asyncio.wait_for(edge_tts.Communicate(text, VOICE, rate='+8%').save(str(stem.with_suffix('.mp3'))), timeout=45)
        # Remove only the service's leading/trailing silence, preserving phrase pauses.
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(stem.with_suffix('.mp3')),
                        '-af', 'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB,areverse,apad=pad_dur=0.12',
                        '-ar', '48000', str(stem.with_suffix('.wav'))], check=True)
        print(f'Generated {i}/{len(cues)}: {cue["chapter"]}', flush=True)
    (OUT / 'voice.json').write_text(json.dumps({'voice': VOICE, 'locale': 'en-IN', 'rate': '+8%', 'synthetic': True}, indent=2))

asyncio.run(main())
