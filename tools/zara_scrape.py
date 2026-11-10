import json,time,urllib.request,os,sys
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
B="https://www.zara.com/us/en/"
cats=[("Платья",2420896),("Пальто",2419032),("Куртки и тренчи",2417772),("Пиджаки",2420942),("Трикотаж",2420306),("Брюки",2420795),("Джинсы",2419185),("Юбки",2420454),("Футболки",2420417),("Рубашки и блузки",2420369),("Топы и боди",2635766),("Комплекты",2420285),("Свитшоты",2467841),("Бельё и пижамы",2419807)]
N=int(sys.argv[1]) if len(sys.argv)>1 else 18
def get(u):
    return json.loads(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,'Accept':'application/json'}),timeout=60).read())
picked={}
for name,cid in cats:
    fn=f'zl/{cid}.json'
    if not os.path.exists(fn):
        json.dump(get(B+f'category/{cid}/products?ajax=true'),open(fn,'w')); time.sleep(1.5)
    d=json.load(open(fn)); n=0
    for g in d.get('productGroups',[]):
        for e in g.get('elements',[]):
            for c in e.get('commercialComponents',[]):
                if c.get('type')!='Product' or not c.get('seo') or c['id'] in picked: continue
                if 'PRE' in (c.get('subfamilyName') or '') : continue
                if n>=N: break
                picked[c['id']]={'cat':name,'list':c}; n+=1
    print(name,n,len(picked)); sys.stdout.flush()
det=json.load(open('zara_detail.json')) if os.path.exists('zara_detail.json') else {}
for i,(pid,p) in enumerate(picked.items()):
    if str(pid) in det: continue
    s=p['list']['seo']
    u=B+f"{s['keyword']}-p{s['seoProductId']}.html?v1={s['discernProductId']}&ajax=true"
    try:
        j=get(u); pr=j['product']
        det[str(pid)]={'cat':p['cat'],'product':{k:pr.get(k) for k in ('id','name','detail','familyName','subfamilyName','sizeGuide','sizeSystem','attributes')}}
    except Exception as e:
        print('ERR',pid,e); det[str(pid)]={'cat':p['cat'],'error':str(e)}
    if i%10==0: json.dump(det,open('zara_detail.json','w')); print('d',i); sys.stdout.flush()
    time.sleep(1.2)
json.dump(det,open('zara_detail.json','w')); print('DONE',len(det))
