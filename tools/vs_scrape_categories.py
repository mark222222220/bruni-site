import re,json,time,urllib.request,sys,os
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
B="https://www.victoriassecret.com/us/"
cats={
 "Бюстгальтеры":["vs/bras/push-up","vs/bras/balconette","vs/bras/unlined","vs/bras/bralette","vs/bras/lounge-and-wireless","vs/bras/full-coverage","vs/bras/plunge"],
 "Трусики":["vs/panties/thongs-and-v-strings","vs/panties/cheekies-and-cheekinis","vs/panties/lace","vs/panties/briefs","vs/panties/hiphuggers"],
 "Бельё":["vs/lingerie/babydolls","vs/lingerie/teddies-and-bodysuits","vs/lingerie/corsets-and-bustiers","vs/lingerie/slips","vs/lingerie/stockings"],
 "Пижамы":["vs/sleepwear","vs/sleepwear/pajamas","vs/sleepwear/pajama-sets","vs/sleepwear/long-pajama-sets","vs/sleepwear/satin","vs/sleepwear/flannel","vs/sleepwear/sleepshirts","vs/sleepwear/robes-slippers-and-blankets","vs/sleepwear/camisoles"],
 "Домашняя одежда":["vs/loungewear/sweaters","vs/loungewear/tees-and-tank-tops","vs/loungewear/jackets","vs/sleepwear/loungewear"],
 "Ароматы":["vs/beauty/all-fragrance","vs/beauty/perfume","vs/beauty/mists","vs/beauty/the-mist-collection","vs/beauty/vanilla-perfume","vs/beauty/rollerballs-and-travel-size","vs/beauty/fragrances-bombshell-shop"],
 "Уход за телом":["vs/beauty/all-body-care","vs/beauty/body-lotions-and-moisturizers","vs/beauty/body-wash","vs/beauty/shimmer-shop"],
 "Косметика":["vs/beauty/lip","vs/beauty/trending-now"],
}
os.makedirs('vs',exist_ok=True)
out={}
for cat,paths in cats.items():
  for p in paths:
    fn='vs/'+p.replace('/','_')+'.html'
    if not os.path.exists(fn):
      try:
        r=urllib.request.urlopen(urllib.request.Request(B+p,headers={'User-Agent':UA}),timeout=40)
        open(fn,'wb').write(r.read()); time.sleep(1.5)
      except Exception as e:
        print('ERR',p,e); continue
    s=open(fn,encoding='utf8').read()
    m=re.search(r'id="clientProps" type="application/json">(.*?)</script>',s,re.S)
    if not m: print('noprops',p); continue
    j=json.loads(m.group(1)); n=0
    for q in (j.get('reactQueryState') or {}).get('queries',[]):
      if q['queryKey'][0]=='collectionStacks':
        for st in (q['state'].get('data') or {}).get('stacks',[]):
          for it in st.get('list',[]):
            k=it['id'].split('|')[0]
            if k not in out: out[k]={'cat':cat,'src':p,'item':it}; n+=1
    print(cat,p,'new',n,'total',len(out)); sys.stdout.flush()
json.dump(out,open('vs_raw.json','w'))
