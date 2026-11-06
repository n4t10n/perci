from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
ROOT=Path(__file__).resolve().parents[1]
files=['src/brand.js','src/data/repository.js','src/data/migration-preflight.js','src/domain/initial-state.js','src/domain/startup-route.js','src/account.js','src/account-ui.js','src/app.js']
pieces=[]
for f in files:
 s=(ROOT/f).read_text()
 s=re.sub(r'^import .*?;\s*$', '', s, flags=re.MULTILINE)
 s=re.sub(r'^export \{.*?\};\s*$', '', s, flags=re.MULTILINE)
 s=re.sub(r'\bexport (const|function|async function)\b',r'\1',s)
 pieces.append(s)
bundle='\n'.join(pieces)
legacy={'version':2,'demo':True,'theme':'dark','focus':'both','onboardSeen':False,'routines':[{'id':'r1','name':'Demo','exercises':[]},{'id':'real1','name':'Dia 1 Full Body','exercises':[{'name':'Press banca','sets':3,'reps':10}]}],'records':[],'habits':[],'checks':{},'draft':None}
setup='''
let mem=new Map();
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}});
localStorage.setItem('perci_paso3_review_v2',JSON.stringify(%s));
let currentUser=1;
window.setUser = num=>{currentUser=num};
const users=[{id:'d7396485-4017-4caa-a4be-2e8f73681e6c',email:'valen@example.com',name:'Valentín'}, {id:'5b3e7ebf-884b-4f5f-857c-fc4982307db5',email:'martina@example.com',name:'Martina'}];
window.fetch=async (path,options={})=>{
 let response = null;
 if(path==='/api/auth/session')response={configured:true,authenticated:false,user:null};
 if(path==='/api/auth/signup')response={authenticated:false,message:'Confirmá tu correo.'};
 if(path==='/api/auth/login')response={authenticated:true,user:users[currentUser-1]};
 if(path==='/api/auth/logout')response={authenticated:false};
 if(path==='/api/cloud/sync')response={routines:1,records:0,habits:0};
 if(!response)throw Error('Unmocked '+path);
 return {ok:true,status:200,json:async()=>response};
};
''' % json.dumps(legacy)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 p=b.new_page(viewport={'width':390,'height':844})
 p.on('pageerror',lambda e:print('BROWSER ERROR',e))
 p.set_content('<!DOCTYPE html><html><head><meta name="theme-color" content="#111716"></head><body><div id="root"></div></body></html>')
 p.add_style_tag(content=re.sub(r'@import url\([^;]+;', '', (ROOT/'src/styles.css').read_text()))
 p.add_script_tag(content=setup)
 p.add_script_tag(content=bundle)
 p.wait_for_timeout(80)
 print('GATE?',p.locator('h2').first.inner_text())
 p.locator('[data-account-action="show-register"]').click()
 print('REGISTER?',p.locator('h2').first.inner_text())
 p.locator('#account-name').fill('Valentín')
 p.locator('#account-email').fill('valen@example.com')
 p.locator('#account-password').fill('password123')
 p.locator('#account-confirm').fill('password123')
 p.locator('#account-auth-form button[type="submit"]').click()
 p.wait_for_timeout(100)
 print('CONFIRM?',p.locator('h2').first.inner_text())
 p.locator('[data-account-action="show-login"]').click()
 p.locator('#account-email').fill('valen@example.com')
 p.locator('#account-password').fill('password123')
 p.locator('#account-auth-form button[type="submit"]').click()
 p.wait_for_timeout(150)
 print('CLAIM?',p.locator('h2').first.inner_text())
 p.locator('[data-account-action="claim-legacy"]').click()
 p.wait_for_timeout(100)
 p.locator('.mobile-nav [data-action="go"][data-value="activity"]').click(timeout=4000)
 print('ROUTINE?',p.locator('body').inner_text().find('Dia 1 Full Body'), 'avatar',p.locator('.avatar').inner_text())
 assert p.locator('body').inner_text().find('Dia 1 Full Body') >= 0
 p.locator('.avatar').click()
 p.locator('[data-account-action="logout"]').click()
 p.wait_for_timeout(80)
 print('LOGOUT?',p.locator('h2').first.inner_text())
 p.evaluate('window.setUser(2)')
 p.locator('#account-email').fill('martina@example.com')
 p.locator('#account-password').fill('password123')
 p.locator('#account-auth-form button[type="submit"]').click()
 p.wait_for_timeout(100)
 p.locator('.mobile-nav [data-action="go"][data-value="activity"]').click(timeout=4000)
 print('SECOND USER?',p.locator('body').inner_text().find('Dia 1 Full Body'), 'account:',p.locator('.avatar').inner_text())
 assert 'Dia 1 Full Body' not in p.locator('body').inner_text()
 print('BROWSER FLOWS PASS')
 b.close()
