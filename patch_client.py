"""Create a new ASAR; never overwrite the source or weaken runtime checks."""
import argparse, copy, hashlib, json, shutil, struct
from pathlib import Path

MAIN = '.vite/build/main-CP9z2iYn.js'
PRELOAD = '.vite/build/preload.js'
HASHES = {MAIN:'9a4d60010bcceb6310ef6a357cae924db06df1babe3c4dd91310da2b5f39cf1f', PRELOAD:'e9e6bb0d8c781368f5fb177c30b2832587b9881be3eff03b1550a669fba599c0'}

def header(f):
    a,b,c,d = struct.unpack('<4I', f.read(16))
    if a != 4 or b != c+4 or d > c-4 or b > 64000000: raise ValueError('Invalid ASAR header')
    return json.loads(f.read(d)), 8+b

def entry(h, name):
    for part in name.split('/'): h=h['files'][part]
    return h

def read(f,h,start,name):
    e=entry(h,name)
    f.seek(start+int(e['offset']))
    data=f.read(e['size'])
    if len(data)!=e['size']:raise ValueError('Truncated entry')
    return data

def prepare(source,output):
    source,output=Path(source),Path(output)
    if source.resolve()==output.resolve() or output.exists(): raise ValueError('Output must be a new file')
    root=Path(__file__).resolve().parent
    with source.open('rb') as f:
        h,start=header(f)
        package=json.loads(read(f,h,start,'package.json'))
        if package.get('version')!='26.1023.50603':raise ValueError('Unsupported client version')
        originals={name:read(f,h,start,name) for name in HASHES}
        for name,data in originals.items():
            if hashlib.sha256(data).hexdigest()!=HASHES[name]:raise ValueError('Unsupported or modified source: '+name)
        anchor=b'z=new k.BrowserWindow(R);r&&'
        if originals[MAIN].count(anchor)!=1:raise ValueError('Ambiguous main window hook')
        changes={MAIN:originals[MAIN].replace(anchor,b"z=new k.BrowserWindow(R);d===`primary`&&!r&&require('./chatgpt-pin-main.cjs').attach(z);r&&"),
                 PRELOAD:originals[PRELOAD]+b'\n// JASEN_INTERNAL_PIN_V1\n'+(root/'pin-preload.js').read_bytes(),
                 '.vite/build/chatgpt-pin-main.cjs':(root/'pin-main.cjs').read_bytes()}
        offset=source.stat().st_size-start
        for name,data in changes.items():
            node=h
            parts=name.split('/')
            for part in parts[:-1]:node=node['files'][part]
            e=copy.deepcopy(node['files'].get(parts[-1],{}))
            block=4194304
            e.update(size=len(data),offset=str(offset),integrity={'algorithm':'SHA256','hash':hashlib.sha256(data).hexdigest(),'blockSize':block,'blocks':[hashlib.sha256(data[i:i+block]).hexdigest() for i in range(0,len(data),block)]})
            node['files'][parts[-1]]=e
            offset+=len(data)
        raw=json.dumps(h,separators=(',',':'),ensure_ascii=False).encode('utf-8')
        padded=raw+b'\0'*((-len(raw))%4)
        prefix=struct.pack('<4I',4,8+len(padded),4+len(padded),len(raw))
        with output.open('xb') as out:
            out.write(prefix);out.write(padded)
            f.seek(start);shutil.copyfileobj(f,out,1024*1024)
            for data in changes.values():out.write(data)
    with output.open('rb') as f:
        h,start=header(f)
        for name,data in changes.items():
            if read(f,h,start,name)!=data:raise ValueError('Roundtrip validation failed')
    return {'changed_entries':list(changes),'output_bytes':output.stat().st_size,'source_unchanged':True}

def sync_executable(source_archive, patched_archive, source_exe, output_exe):
    def digest(archive):
        with Path(archive).open('rb') as f:
            a,b,c,d=struct.unpack('<4I',f.read(16))
            if a!=4 or b!=c+4 or d>c-4: raise ValueError('Invalid ASAR header')
            return hashlib.sha256(f.read(d)).hexdigest().encode('ascii')
    output=Path(output_exe)
    if output.exists(): raise ValueError('Executable output must be a new file')
    old,new=digest(source_archive),digest(patched_archive)
    data=Path(source_exe).read_bytes()
    if data[:2]!=b'MZ' or data.count(old)!=1: raise ValueError('Unsupported executable integrity record')
    output.write_bytes(data.replace(old,new))
    return {'executable_bytes':len(data),'asar_header_hash':new.decode()}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True);p.add_argument('--output',required=True)
    p.add_argument('--exe-source');p.add_argument('--exe-output')
    a=p.parse_args()
    if bool(a.exe_source)!=bool(a.exe_output): p.error('Both executable options are required together')
    result=prepare(a.source,a.output)
    if a.exe_source: result.update(sync_executable(a.source,a.output,a.exe_source,a.exe_output))
    print(json.dumps(result,indent=2))
