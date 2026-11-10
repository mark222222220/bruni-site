import re,json,time,urllib.request,os,sys,html as H
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
raw=json.load(open('vs_raw.json'))
done={k:v for k,v in (json.load(open('vs_detail.json')) if os.path.exists('vs_detail.json') else {}).items() if 'error' not in v}
def strip(h): 
    t=re.sub(r'<li>\s*','• ',h or ''); t=re.sub(r'</(p|li|ul)>','\n',t); t=re.sub(r'<[^>]+>','',t)
    return re.sub(r'\n\s*\n+','\n',H.unescape(t)).strip()
for i,(g,r) in enumerate(raw.items()):
    if g in done: continue
    u=r['item']['url']; it=r['item']; gid,cid0=it['id'].split('|')
    url="https://www.victoriassecret.com"+u.split('?')[0]+f"?genericId={gid}&choice={cid0}"
    try:
        s=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=60).read().decode('utf8')
        j=json.loads(re.search(r'id="clientProps" type="application/json">(.*?)</script>',s,re.S).group(1))
        ppi=(j.get('apiData') or {}).get('productPageInstance')
        if not ppi:
            for q in (j.get('reactQueryState') or {}).get('queries',[]):
                dd=q['state'].get('data')
                if isinstance(dd,dict) and 'product' in dd and 'productData' in (dd['product'] or {}): ppi=dd
        if not ppi: raise Exception('noppi '+str(list((j.get('apiData') or {}).keys()))[:80])
        pd=ppi['product']['productData']
        p=pd.get(g) or next(iter(pd.values()))
        ch=[]
        for cid,c in p['choices'].items():
            sizes=list((c.get('availableSizes') or {}).keys()); un=list((c.get('unavailableSizes') or {}).keys())
            prices=[v.get('originalPriceNumerical') for v in (c.get('availableSizes') or {}).values() if v.get('originalPriceNumerical')]
            sale=[v.get('salePriceNumerical') for v in (c.get('availableSizes') or {}).values() if v.get('salePriceNumerical')]
            imgs=[x['image'] for x in c.get('images',[]) if x.get('type')!='video' and x.get('image')]
            ch.append({'id':cid,'label':c.get('label'),'color':c.get('color'),'swatch':c.get('swatchImage'),'images':imgs,'sizes':sizes,'unavailable':un,'price':max(prices) if prices else None,'sale':min(sale) if sale else None})
        done[g]={'desc':strip(p.get('longDescription')),'short':p.get('shortDescription'),'choices':ch}
    except Exception as e:
        print('ERR',g,e); done[g]={'error':str(e)}
    if i%10==0:
        json.dump(done,open('vs_detail.json','w')); print(i,len(done)); sys.stdout.flush()
    time.sleep(3.0)
json.dump(done,open('vs_detail.json','w')); print('DONE',len(done))
