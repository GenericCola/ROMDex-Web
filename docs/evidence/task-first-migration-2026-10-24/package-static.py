import pathlib,hashlib,json,zipfile,re,subprocess
root=pathlib.Path('out')
files=sorted((p for p in root.rglob('*') if p.is_file() and p.name not in ('sw.js','_headers')),key=lambda p:str(p))
assets=['/'+p.relative_to(root).as_posix() for p in files]
template=pathlib.Path('scripts/service-worker.js').read_bytes()
h=hashlib.sha256(template)
entries={}
for p,a in zip(files,assets):
 assert not p.is_symlink()
 data=p.read_bytes();h.update(a.encode());h.update(data);entries[a[1:]]=data
version=h.hexdigest()[:20]
expected=re.search(r'PWA shell: ([a-f0-9]+)',pathlib.Path('artifacts/task-first-migration/build-portable.txt').read_text(encoding='utf-8-sig')).group(1)
assert version==expected,(version,expected)
entries['sw.js']=template.decode().replace('__VERSION__',version).replace('__ASSETS__',json.dumps(assets,separators=(',',':'))).encode()
entries['_headers']=pathlib.Path('public/_headers').read_bytes()
config=json.loads(pathlib.Path('vercel.json').read_text())
config.update(installCommand='',buildCommand='',outputDirectory='.')
assert not any(k in config for k in ('functions','env','rewrites','builds'))
entries['vercel.json']=(json.dumps(config,indent=2)+'\n').encode()
for n in entries:
 assert not n.startswith('/') and '..' not in pathlib.PurePosixPath(n).parts
 assert not any(x in n.split('/') for x in ('.env','.git','Data','artifacts','docs','tests','node_modules'))
base=pathlib.Path('artifacts/task-first-migration')
archive=base/('romdex-web-shell-'+version+'.zip')
assert not archive.exists()
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
 for name,data in sorted(entries.items()):
  info=zipfile.ZipInfo(name,(2026,10,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
 assert set(z.namelist())==set(entries)
 for name,data in entries.items(): assert z.read(name)==data
receipt={'format':'ROMDexStaticDeployment/1','sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'workerVersion':version,'archive':archive.name,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':{n:hashlib.sha256(b).hexdigest() for n,b in sorted(entries.items())},'containsDesktopData':False,'containsCredentials':False,'backend':'YouTrack only; no proxy or application server','installedAcceptanceAppChanged':False}
(base/'deployment-artifact.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='files'}));print('Verified entries:',len(entries),'ZIP bytes:',archive.stat().st_size)
