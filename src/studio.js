'use strict';
(()=>{const A=window.APP;if(!A)return;const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),esc=A.esc,toast=A.toast;
const LS=k=>{try{return JSON.parse(localStorage[k]||'null')}catch(e){return null}},SV=(k,v)=>{try{localStorage[k]=JSON.stringify(v)}catch(e){}};
// ---------- 服务商 ----------
const SDCPP='sdcpp';
const PROV={openai:{name:'OpenAI',base:'https://api.openai.com/v1',model:'gpt-image-1',models:['gpt-image-1','gpt-image-1-mini','gpt-image-2','dall-e-2'],proto:'edits',keyMode:'bearer'},
 gemini:{name:'Gemini',base:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-2.5-flash-image',models:['gemini-2.5-flash-image','gemini-3-pro-image-preview','gemini-3.1-flash-image'],proto:'gemini',keyMode:'google',rootMode:'v1beta'},
 seedream:{name:'豆包 Seedream',base:'https://ark.cn-beijing.volces.com/api/v3',model:'doubao-seedream-5-5-261028',models:['doubao-seedream-5-5-261028','doubao-seedream-5-0-flash-260915','doubao-seedream-4-5-251128','doubao-seedream-4-0-250828'],proto:'seedream',keyMode:'bearer',rootMode:'plain',forcedProxy:true,sizeTable:'SEEDREAM'},
 custom:{name:'自定义中转',base:'',model:'gpt-image-1',models:['gpt-image-1','gpt-image-2','grok-imagine-image-2.0','gemini-2.5-flash-image','flux-kontext-pro','qwen-image-edit','doubao-seedream-4-0-250828'],custom:true,keyMode:'bearer'},
 [SDCPP]:{name:'本地 sd.cpp',base:'http://127.0.0.1:1234/v1',model:'sd-cpp-local',proto:SDCPP,keyMode:'none',needsKey:false,proxy:false,local:true,b64Only:true,fallback:'strict',field:'image[]'}};
const provInfo=p=>PROV[p]||{},isLocal=p=>!!provInfo(p).local,needsKey=p=>provInfo(p).needsKey!==false,proxyAllowed=p=>provInfo(p).proxy!==false,keyMode=p=>provInfo(p).keyMode||'bearer',rootMode=p=>provInfo(p).rootMode||'v1',isCustom=p=>!!provInfo(p).custom,forcesProxy=p=>!!provInfo(p).forcedProxy,fallbackMode=p=>provInfo(p).fallback||'tolerant',b64OnlyMode=p=>!!provInfo(p).b64Only;
const cfg=Object.assign({prov:'openai',base:'',key:'',model:'',field:'image[]',proto:'edits',proxy:false},LS('wbCfg')||{});
// ---------- 预设 ----------
const CHARS=[['asia','东亚女性','an adult East Asian woman in her mid-20s, long black hair, natural makeup, slim build','一位二十多岁的成年东亚女性，黑色长发，自然淡妆，身材纤细'],
 ['west','欧美女性','an adult Caucasian woman in her late 20s, wavy light-brown hair, natural makeup, athletic build','一位二十多岁的成年欧美女性，浅棕色波浪长发，自然妆容，匀称身材'],
 ['man','男性模特','an adult East Asian man in his late 20s, short black hair, clean-shaven, tall and lean','一位二十多岁的成年东亚男性，黑色短发，干净面容，高瘦身材'],
 ['anime','动漫角色','an adult anime-style girl, long silver hair, large expressive eyes, adult proportions, clean cel-shaded illustration','一位成年动漫风格女性角色，银色长发，大眼睛，成人身材比例，干净的赛璐璐上色插画'],
 ['custom','自定义','','']];
const STYLES=[['keep','照片质感','photorealistic, matching the original photo quality','写实摄影质感，与原照片画质一致'],['studio','影棚大片','clean high-end fashion studio, soft key light, seamless light-grey backdrop, editorial lookbook photo','高端时尚影棚，柔和主光，浅灰无缝背景，杂志画册质感'],
 ['street','城市街拍','candid city street-style photo, natural daylight, shallow depth of field','城市街拍抓拍，自然日光，浅景深'],['ecom','电商白底','e-commerce product-model photo, pure white background, even lighting, full body','电商模特图，纯白背景，均匀布光，全身构图'],
 ['film','胶片氛围','35mm film photograph, warm tones, subtle grain, golden hour light','35mm 胶片摄影，暖色调，轻微颗粒，黄金时刻光线'],['anime','动漫插画','high-quality anime illustration, clean line art, soft cel shading','高质量动漫插画，干净线稿，柔和赛璐璐上色']];
const ANG_EN={'正面':'front view','斜侧':'three-quarter view','侧面':'side profile','俯拍':'high-angle shot looking down','仰拍':'low-angle shot looking up','背面':'back view','下から':'low angle'};
const W={mode:LS('wbMode')||'tryon',persons:[],garments:[],poses:[],exprs:[],char:LS('wbChar')||'asia',charTxt:LS('wbCharTxt')||'',style:LS('wbStyle')||'keep',bm:LS('wbBm')||'each',pl:LS('wbPl')||'en',keepBg:LS('wbKeepBg')??true,busy:null,dirty:false,results:[],ri:0,cmp:true};
// item: {kind:'lib',k,ai?} | {kind:'file',blob,url,name}
const g0=LS('wbSel')||{};
// ---------- 工具 ----------
const normBase=b=>(b||'').trim().replace(/\/+$/,'');
function root(){let b=normBase(cfg.base)||provInfo(cfg.prov).base,mode=rootMode(cfg.prov);if(mode=='v1beta')return/\/v1(beta|alpha)?$/.test(b)?b:b+'/v1beta';if(mode=='plain')return b;return/\/v\d+$/.test(b)?b:b+'/v1'}
const modelOf=()=>(cfg.model||'').trim()||provInfo(cfg.prov).model;
const proto=()=>provInfo(cfg.prov).proto||cfg.proto;
function provName(){return PROV[cfg.prov].name}
function provLabel(){const ok=!needsKey(cfg.prov)||!!cfg.key;if(!ok)return'未配置 API';return isLocal(cfg.prov)?provName()+(sdLoadedName()?' · '+sdLoadedName():''):provName()+' · '+modelOf()}
function loadImg(src){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>j(Error('图片读取失败'));i.src=src})}
async function toJpeg(src,max=1536){const i=await loadImg(src);let w=i.naturalWidth,h=i.naturalHeight,s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(i,0,0,w,h);return new Promise(r=>c.toBlob(b=>r({blob:b,w,h}),'image/jpeg',.92))}
const libSrc=a=>{const it=A.ITEMS[a.k];return it.angles?it.angles[a.ai??it.ai].i:it.i};
async function assetBlob(a){if(a.kind=='file')return a.blob;const src=libSrc(a);const r=await fetch(src);if(!r.ok)throw Error('素材下载失败（'+r.status+'）');const u=URL.createObjectURL(await r.blob());try{return(await toJpeg(u,1280)).blob}finally{URL.revokeObjectURL(u)}}
const b64=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(b)});
const dataURL=async b=>'data:'+(b.type||'image/jpeg')+';base64,'+await b64(b);
const isGen=()=>W.mode=='gen';const hasPerson=()=>W.persons.length>0;
// ---------- 提示词 ----------
function poseDesc(p,en){const it=A.ITEMS[p.k];if(!it)return'';const a=it.angles[p.ai??it.ai];return en?`${it.en} (${it.lineEn}, ${ANG_EN[a.zh]||a.en||a.zh})${/2人|双人/.test(it.line)?' — a two-person pose: match the number of people and their relative positions':''}`:`${it.zh}（${it.line}，${a.zh}）${/2人|双人/.test(it.line)?'——双人姿势，人数与相对位置需与线稿一致':''}`}
function compose(poseSet){const en=W.pl=='en',P=W.persons.length,G=W.garments.length,ps=poseSet||W.poses,np=ps.length,sheet=np>1;const style=STYLES.find(s=>s[0]==W.style)||STYLES[0],ch=CHARS.find(c=>c[0]==W.char)||CHARS[0],ex=$('#wbExtra').value.trim();
 const gi=W.garments.map(g=>g.kind=='lib'&&A.ITEMS[g.k]).filter(Boolean);let n=0;const rng=(c)=>{if(!c)return null;const a=n+1,b=n+c;n=b;return a==b?(en?`image ${a}`:`第 ${a} 张`):(en?`images ${a}–${b}`:`第 ${a}–${b} 张`)};
 const E=W.exprs.length,ei=E?A.ITEMS[W.exprs[0].k]:null;const rP=rng(P),rG=rng(G),rS=rng(np),rE=rng(E);const L=[];
 if(en){L.push(P?`Fashion ${isGen()?'image generation':'virtual try-on'} using reference images. ${rP} ${P>1?'show':'shows'} the person (same individual)${G?`; ${rG} ${G>1?'show':'shows'} the outfit${G>1?' pieces (top and bottom)':''} on an invisible mannequin`:''}${np?`; ${rS} ${np>1?'are':'is'} pose sketch${np>1?'es':''}`:''}.`:`Fashion image generation from reference images. ${G?`${rG} ${G>1?'show':'shows'} the outfit on an invisible mannequin`:''}${np?`; ${rS} ${np>1?'are':'is'} pose sketch${np>1?'es':''}`:''}.`);
  L.push(P?"Subject: the person from the photo. Preserve their face, identity, hairstyle, skin tone and body proportions exactly; they must stay recognisably the same adult.":`Subject: ${(W.char=='custom'?W.charTxt:ch[2])||ch[2]||'an adult model'}. Always an adult with adult proportions.`);
  if(G)L.push(`Outfit: dress the subject in the complete outfit from ${rG}, reproducing every garment faithfully — cut, color, fabric, pattern, layering, shoes and accessories${gi.length?': '+gi.map(x=>x.en.replace(/^[^,]*outfit,\s*/,'')).join('; '):''}. Replace the original clothing entirely. Never draw the mannequin or a blank body.`);
  if(np)L.push((sheet&&W.bm=='sheet'?`Pose: draw ${np} panels in one image, one per pose sketch, same subject and outfit in every panel, with even spacing and no text: `:'Pose: ')+ps.map((p,i)=>(sheet&&W.bm=='sheet'?`(${i+1}) `:'')+poseDesc(p,true)).join('; ')+'. Use the sketch only for body posture, weight, limb placement and camera angle; never draw sketch lines, joint circles or guide marks.');
  else if(P)L.push('Pose: keep the original pose, framing and camera angle.');
  if(E&&ei)L.push(`Expression: ${rE} is a faceless neutral head model showing the target expression (${ei.en}). Give the subject exactly this facial expression. Transfer ONLY the expression — the subject's own facial features, face shape and identity must remain exactly as in the person photo; never copy the reference head's face.`);
  L.push(`Look: ${P&&W.keepBg&&!isGen()?'keep the original background and lighting of the photo; ':''}${style[2]}. Natural fabric drape with realistic folds and shadows, high detail. No text, no watermark, no borders.`);
  if(ex)L.push('Additional: '+ex)}
 else{L.push(P?`时尚${isGen()?'生图':'虚拟试穿'}，使用参考图。${rP}是人物照片（同一人）${G?`；${rG}是放在隐形人台上的服装${G>1?'（上装与下装）':''}`:''}${np?`；${rS}是姿势线稿`:''}。`:`根据参考图进行时尚生图。${G?`${rG}是放在隐形人台上的服装`:''}${np?`；${rS}是姿势线稿`:''}。`);
  L.push(P?'人物：照片中的人。严格保留其面部、身份特征、发型、肤色与身材比例，必须一眼认出是同一位成年人。':`人物：${(W.char=='custom'?W.charTxt:ch[3])||ch[3]||'一位成年模特'}。始终为成年人比例。`);
  if(G)L.push(`服装：为人物换上${rG}中的整套服装，准确还原版型、颜色、面料、图案、叠穿、鞋袜与配饰${gi.length?'：'+gi.map(x=>x.zh.replace(/[。.]$/,'')).join('；'):''}。完全替换原有衣物，不要画出人台或空白身体。`);
  if(np)L.push((sheet&&W.bm=='sheet'?`姿势：在同一张图中画 ${np} 格，每格对应一张线稿，人物与服装保持一致，均匀留白，不写文字：`:'姿势：')+ps.map((p,i)=>(sheet&&W.bm=='sheet'?`（${i+1}）`:'')+poseDesc(p,false)).join('；')+'。线稿只用于提取身体姿态、重心、四肢位置和镜头角度，不要画出线条、关节圆或辅助线。');
  else if(P)L.push('姿势：保持原照片的姿势、构图和拍摄角度。');
  if(E&&ei)L.push(`表情：${rE} 是一张无身份头模的表情参考（${ei.zh}）。让人物做出完全一致的表情。只迁移神态——人物本人的五官、脸型和身份必须与照片完全一致，不要照搬参考头的脸。`);
  L.push(`画面：${P&&W.keepBg&&!isGen()?'保留原照片的背景与光线；':''}${style[3]}。衣物垂坠自然，褶皱阴影真实，高细节。不要文字、水印或边框。`);
  if(ex)L.push('补充：'+ex)}
 return L.join('\n')}
function reprompt(force){if(force||!W.dirty){$('#wbPrompt').value=compose();W.dirty=false}}
// ---------- 渲染 ----------
function pickRow(a,type,i){const it=a.kind=='lib'&&A.ITEMS[a.k];if(a.kind=='lib'&&!it)return'<div class="empty0">加载中…</div>';
 const src=it?(type=='pose'?A.ath(it.angles[a.ai??it.ai].t):A.thumb(it)):a.url,t=it?A.title(it):(a.name||'自定义图片'),sub=it?(it.type=='pose'?it.line+' · '+it.angles[a.ai??it.ai].zh:it.cat+' · '+it.id):(type=='costume'?(W.garments.length>1?(i==0?'上装':'下装'):'本地上传'):'本地上传');
 return`<div class="pick ${type}"><img src="${src}" alt="${esc(t)}"><div><b>${esc(t)}</b><small>${esc(sub)}</small></div>${(type=='pose'||type=='expr')&&it?`<select data-ang="${i}" aria-label="角度">${it.angles.map((x,j)=>`<option value="${j}" ${j==(a.ai??it.ai)?'selected':''}>${x.zh}</option>`).join('')}</select>`:''}<button class="rmx" data-rm="${type}" data-i="${i}" aria-label="移除" title="移除">×</button></div>`}
function render(){const G=isGen();$$('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode==W.mode));
 $('#stLead').textContent=G?'选模特类型和服装，直接出一张上身图。':'上传照片，选一套衣服，换上看看。';
 $('#s1T').textContent=G?'模特':'人物照片';$('#s1R').textContent=G?'可传脸部参考':'必选';$('#s1T').textContent=G?'模特':'人物';
 $('#wbPersons').innerHTML=W.persons.map((p,i)=>`<div class="pp"><img src="${p.url}" alt="人物照片 ${i+1}"><small>${p.w}×${p.h}</small><button class="x" data-rmp="${i}" aria-label="移除">×</button></div>`).join('');
 $('#wbDrop').classList.toggle('mini',W.persons.length>0);$('#wbDrop').hidden=W.persons.length>=3;$('#wbChar').hidden=!G||hasPerson();
 $('#wbChars').innerHTML=CHARS.map(c=>`<button class="chip ${W.char==c[0]?'on':''}" data-char="${c[0]}">${c[1]}</button>`).join('');$('#wbCharTxt').hidden=W.char!='custom';$('#wbCharTxt').value=W.charTxt;
 $('#wbG').innerHTML=W.garments.length?W.garments.map((g,i)=>pickRow(g,'costume',i)).join(''):'<button class="empty0" data-pick="costume"><span><b>选择服装</b><small>从库里选，或上传图片</small></span></button>';
 $('#wbPo').innerHTML=W.poses.length?W.poses.map((p,i)=>pickRow(p,'pose',i)).join(''):`<button class="empty0" data-pick="pose"><span><b>选择姿势（可选）</b><small>${G?'不选就随机':'不选就保持原姿势'}</small></span></button>`;
 $('#wbEx').innerHTML=W.exprs.length?W.exprs.map((g,i)=>pickRow(g,'expr',i)).join(''):'<button class="empty0" data-pick="expr"><span><b>选择表情（可选）</b><small>只取神态，不换脸</small></span></button>';
 $('#wbBatch').hidden=W.poses.length<2;$$('[data-bm]').forEach(b=>b.classList.toggle('on',b.dataset.bm==W.bm));$('#wbAllAng').hidden=W.poses.length!=1||!A.ITEMS[(W.poses[0]||{}).k];
 $('#wbStyles').innerHTML=STYLES.map(s=>`<button class="chip ${W.style==s[0]?'on':''}" data-style="${s[0]}">${s[1]}</button>`).join('');$('#wbKeepBg').checked=W.keepBg;$('#wbKeepBg').closest('label').hidden=G||!hasPerson();
 $$('[data-pl]').forEach(b=>b.classList.toggle('on',b.dataset.pl==W.pl));
 const ok=!needsKey(cfg.prov)||!!cfg.key;$('#wbDot').className='dot'+(ok?' on':'');$('#wbProv').textContent=provLabel();$('#wbDot2').className='dot'+(ok?' on':'');$('#wbProv2').textContent=ok?provName():'未配置 API';$('#wbOnb').hidden=ok;
 const dn=[G?true:hasPerson(),W.garments.length>0,W.poses.length>0,!!(W.style||$('#wbExtra').value)];$$('.step[data-s]').forEach(e=>e.classList.toggle('done',dn[e.dataset.s-1]));
 const jobs=nJobs();$('#wbGo').textContent='生成';$('#wbEst').textContent=`将生成 ${jobs} 张`;
 const noRefsOk=isLocal(cfg.prov)&&G;const miss=[!G&&!hasPerson()&&'人物照片',!noRefsOk&&!W.garments.length&&'服装',!ok&&'API 密钥'].filter(Boolean);$('#wbHint').textContent=miss.length?'还缺：'+miss.join('、'):'每张约半分钟';$('#wbHint').classList.toggle('miss',!!miss.length);const need=[!G&&!hasPerson()&&'上传人物照片',!noRefsOk&&!W.garments.length&&'选择服装'].filter(Boolean);if(!W.busy){$('#wbGo').disabled=!!need.length;$('#wbGo').title=need.length?'请先'+need.join('、'):'';if(need.length)$('#wbGo').textContent='请先'+need[0]}$$('.flow [data-f]').forEach(e=>e.classList.toggle('on',e.dataset.f<4?dn[e.dataset.f-1]&&(e.dataset.f!=3||W.poses.length>0):!need.length));
 SV('wbSel',{g:W.garments.filter(g=>g.kind=='lib').map(g=>g.k),p:W.poses.filter(p=>p.kind=='lib').map(p=>[p.k,p.ai]),e:W.exprs.filter(g=>g.kind=='lib').map(g=>[g.k,g.ai])});reprompt()}
const nJobs=()=>(W.poses.length>1&&W.bm=='each'?W.poses.length:1)*(+$('#wbN').value||1);
// ---------- 上传 ----------
async function addPortrait(it){if(W.persons.length>=3)return toast('最多 3 张人物照片');try{const x=await toJpeg(it.m,1536);W.persons.push({blob:x.blob,url:URL.createObjectURL(x.blob),w:x.w,h:x.h,k:it.k});render();toast(W.mode=='gen'?'已设为脸部参考（生成时保持这张脸）':'已设为人物照片')}catch(e){toast('人像加载失败')}}
async function addPersons(files){files=[...files].filter(f=>/^image\//.test(f.type));if(!files.length)return toast('请选择图片文件');for(const f of files){if(W.persons.length>=3){toast('最多 3 张人物照片');break}const u=URL.createObjectURL(f);try{const r=await toJpeg(u,1536);W.persons.push({blob:r.blob,url:URL.createObjectURL(r.blob),w:r.w,h:r.h})}catch(e){toast('无法读取这张图片')}finally{URL.revokeObjectURL(u)}}render()}
const drop=$('#wbDrop');$('#wbFile').onchange=e=>{addPersons(e.target.files);e.target.value=''};
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>addPersons(e.dataTransfer.files));drop.addEventListener('keydown',e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();$('#wbFile').click()}});
$('#wbGFile').onchange=async e=>{const fs=[...e.target.files];e.target.value='';W.garments=W.garments.filter(g=>g.kind=='file');for(const f of fs){if(W.garments.length>=2){toast('最多上传 2 张服装图（上装 + 下装）');break}const u=URL.createObjectURL(f);try{const r=await toJpeg(u,1280);URL.revokeObjectURL(u);W.garments.push({kind:'file',blob:r.blob,url:URL.createObjectURL(r.blob),name:f.name})}catch(x){toast('无法读取服装图')}}render()};
document.addEventListener('paste',e=>{if(document.body.classList.contains('studio')&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){const f=[...e.clipboardData.files].filter(f=>/^image/.test(f.type));if(f.length)addPersons(f)}});
$('#studio').addEventListener('click',e=>{const t=e.target;let b;
 if(b=t.closest('[data-rm]')){const i=+b.dataset.i;b.dataset.rm=='pose'?W.poses.splice(i,1):b.dataset.rm=='expr'?W.exprs.splice(i,1):W.garments.splice(i,1);render()}
 if(b=t.closest('[data-rmp]')){W.persons.splice(+b.dataset.rmp,1);render()}
 if(b=t.closest('[data-pick]'))picker(b.dataset.pick);
 if(b=t.closest('[data-pl]')){W.pl=b.dataset.pl;SV('wbPl',W.pl);reprompt(true);render()}
 if(b=t.closest('[data-mode]')){W.mode=b.dataset.mode;SV('wbMode',W.mode);if(W.mode=='gen'&&W.style=='keep'){W.style='studio'}if(W.mode=='tryon'&&W.style=='studio'&&!W.dirtyStyle)W.style='keep';W.dirty=false;render()}
 if(b=t.closest('[data-char]')){W.char=b.dataset.char;SV('wbChar',W.char);render()}
 if(b=t.closest('[data-style]')){W.style=b.dataset.style;W.dirtyStyle=1;SV('wbStyle',W.style);render()}
 if(b=t.closest('[data-bm]')){W.bm=b.dataset.bm;SV('wbBm',W.bm);render()}});
$('#studio').addEventListener('change',e=>{const s=e.target.closest('[data-ang]');if(s){const row=s.closest('.pick');if(row&&row.classList.contains('expr'))W.exprs[+s.dataset.ang].ai=+s.value;else W.poses[+s.dataset.ang].ai=+s.value;render()}if(e.target.id=='wbN')render();if(e.target.id=='wbKeepBg'){W.keepBg=e.target.checked;SV('wbKeepBg',W.keepBg);render()}});
$('#wbCharTxt').oninput=e=>{W.charTxt=e.target.value;SV('wbCharTxt',W.charTxt);reprompt()};
$('#wbAllAng').onclick=()=>{const p=W.poses[0],it=A.ITEMS[p.k];W.poses=it.angles.slice(0,6).map((a,i)=>({kind:'lib',k:p.k,ai:i}));toast(`已展开 ${W.poses.length} 个角度`);render()};
$('#wbPrompt').oninput=()=>W.dirty=true;$('#wbExtra').oninput=()=>reprompt();$('#wbReP').onclick=()=>{reprompt(true);toast('已按当前选择重新生成提示词')};
$('#wbCopyP').onclick=()=>A.copy($('#wbPrompt').value,'提示词');
// ---------- 选择器 ----------
let pkType='costume';async function picker(t){pkType=t;$('#pkT').textContent=t=='pose'?'选择姿势（可多选，最多 6 个）':t=='portrait'?'选择人像（作为人物 / 脸部参考）':t=='expr'?'选择表情（只迁移神态，不换脸）':t=='anime'?'选择动画服装':'选择服装';$('#pkDone').hidden=t!='pose';$('#pk').hidden=false;document.body.style.overflow='hidden';$('#pkQ').value='';$('#pkG').innerHTML='<div class="skel"></div>'.repeat(12);await A.load(t);drawPk();setTimeout(()=>$('#pkQ').focus(),50)}
function drawPk(){const q=$('#pkQ').value.toLowerCase().trim().split(/\s+/).filter(Boolean),L=A.DATA[pkType].filter(A.ok).filter(it=>q.every(w=>(it._s||[it.id,it.zh,it.en,it.cat,it.line||''].join(' ').toLowerCase()).includes(w))).slice(0,150),sel=new Set(W.poses.map(p=>p.k));
 $('#pkG').innerHTML=L.length?L.map(it=>`<button data-k="${it.k}" class="${pkType} ${sel.has(it.k)?'on':''}" title="${esc(A.title(it))}"><img loading="lazy" src="${A.thumb(it)}" alt="${esc(A.title(it))}"><span>${esc(A.title(it))}</span></button>`).join(''):'<p class="fine">没有匹配的结果</p>'}
let pq;$('#pkQ').oninput=()=>{clearTimeout(pq);pq=setTimeout(drawPk,150)};const pkClose=()=>{$('#pk').hidden=true;document.body.style.overflow='';render()};$('#pkX').onclick=pkClose;$('#pkDone').onclick=pkClose;
$('#pk').onclick=e=>{if(e.target.id=='pk')return pkClose();const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
 if(pkType=='pose'){const i=W.poses.findIndex(p=>p.k==k);if(i>=0)W.poses.splice(i,1);else if(W.poses.length>=6)return toast('最多选择 6 个姿势');else W.poses.push({kind:'lib',k,ai:A.ITEMS[k].ai});b.classList.toggle('on',i<0);$('#pkT').textContent=`选姿势（${W.poses.length}/6）`}
 else if(pkType=='portrait'){pkClose();addPortrait(A.ITEMS[k])}
 else if(pkType=='expr'){W.exprs=[{kind:'lib',k,ai:A.ITEMS[k].ai}];pkClose()}
 else{W.garments=[{kind:'lib',k}];pkClose()}};
// ---------- 设置 ----------

// ---------- 减少误拦截：只改发送给服务商的措辞，不改服装、姿势 ----------
// [匹配, 替换]，按顺序执行；替换为空表示删掉
const NEUTRAL=[
 [/(?:胸部|臀部|腰臀|身材)(?:曲线|线条)?(?:突出|丰满|饱满|凸显)/g,''],[/凸显(?:身材|曲线|胸部|臀部)/g,''],[/火辣|撩人|诱惑|魅惑|勾人|性感/g,'时尚'],
 [/紧身/g,'修身'],[/露肩/g,'一字肩'],[/露背/g,'开背设计'],[/露脐/g,'短款'],[/低胸/g,'V 领'],[/透视/g,'薄纱拼接'],
 [/比基尼|泳装|泳衣/g,'泳池边时装'],[/情趣内衣|内衣/g,'内搭'],[/裸露|裸体|半裸/g,''],
 [/\b(?:emphasi[sz]ing|accentuating|showing off|highlighting) (?:her |his |the )?(?:curves|figure|body|bust|chest|hips|cleavage)\b/gi,''],
 [/\b(?:curvy|voluptuous|busty)\b/gi,''],[/\b(?:sexy|seductive|sultry|alluring|provocative|hot)\b/gi,'stylish'],
 [/\b(?:skin-?tight|bodycon)\b/gi,'fitted'],[/\btight\b/gi,'fitted'],[/\boff[- ]the[- ]shoulder\b/gi,'off-shoulder neckline'],[/\bbackless\b/gi,'open-back design'],
 [/\b(?:bikini|swimsuit|swimwear)\b/gi,'swimwear fashion catalog piece'],[/\b(?:lingerie|underwear|bra and panties)\b/gi,'loungewear catalog set'],
 [/\b(?:nude|naked|topless|cleavage|bust|busty)\b/gi,''],[/\bsee-?through\b/gi,'sheer-panel'],[/\blow-?cut\b/gi,'V-neck'],
];
const FRAME={en:'Professional e-commerce fashion try-on photo for a clothing catalog. The subject is an adult, fully clothed in exactly the reference garments (same design, color and cut, nothing added or removed), keeping the same identity, in a natural, relaxed, non-suggestive pose, in a tasteful studio or lifestyle setting.',
 zh:'服装电商的专业试穿照片，用于商品目录。人物是成年人，完整穿着参考图中的服装（款式、颜色、剪裁完全一致，不增不减），保持同一人的长相，姿势自然放松，场景为简洁的影棚或生活场景。'};
const neutralOn=()=>LS('wbNeutral')!==false;$('#wbNeutral').checked=neutralOn();$('#wbNeutral').onchange=e=>{SV('wbNeutral',e.target.checked);toast(e.target.checked?'已开启减少误拦截':'已关闭减少误拦截，将按原提示词发送')};
const isAdultJob=set=>[...W.garments,...(set||[])].some(g=>g.kind=='lib'&&A.ITEMS[g.k]&&A.ITEMS[g.k].a);
function neutralize(p){let t=p;for(const [a,b] of NEUTRAL)t=t.replace(a,b?'\x01'+b+'\x01':'\x02');
 t=t.replace(/\b(with|and|in)\s+\x02\s+(?:and|with)\b/gi,'$1').replace(/\x01\x02*\x01/g,'、').replace(/\x01\s+\x01/g,' ').replace(/[\x01]/g,'').replace(/\s*\x02\s*/g,' ')
  .replace(/(^|[，,、；;：:。.\n])\s*(?:and|with|,)?\s*(?=[，,、；;。.\n]|$)/g,'$1').replace(/([，、；])[，、；]+/g,'$1').replace(/([,;])\s*[,;]+/g,'$1').replace(/[ \t]{2,}/g,' ').replace(/\s+([,.;，。；、])/g,'$1').replace(/^[，,、]\s*|[，,、]\s*$/gm,'').replace(/[,，、]\s*([.。;；])/g,'$1');
 const zh=/[\u4e00-\u9fa5]/.test(t.slice(0,40))&&W.pl!='en';return FRAME[zh?'zh':'en']+'\n'+t}
function cfgFill(){$$('[name=prov]').forEach(r=>r.checked=r.value==cfg.prov);const P=PROV[cfg.prov];$('#cfBase').value=cfg.base;$('#cfBase').placeholder=P.base||'https://你的中转地址/v1';$('#cfKey').value=cfg.key;$('#cfKey').placeholder=keyMode(cfg.prov)=='google'?'AIza…':'sk-… / 方舟 API Key';
 $('#cfModel').value=cfg.model;$('#cfModel').placeholder=P.model;renderModels();$('#cfField').value=cfg.field;$('#cfProto').value=cfg.proto;$('#cfProtoW').hidden=!isCustom(cfg.prov);$('#cfFieldW').hidden=!(isCustom(cfg.prov)&&cfg.proto=='edits');
 const local=isLocal(cfg.prov);$('#cfKeyW').hidden=local;$('#cfProxyW').hidden=local;$('#cfProxy').disabled=local;$('#cfProxy').checked=local?false:cfg.proxy;$('#cfSdW').hidden=!local;
 $('#cfHelp').innerHTML=({openai:'在 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a> 创建密钥；gpt-image-1 需要已验证的组织。',gemini:'在 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> 免费获取 API Key（AIza 开头）。',seedream:'在 <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener">火山方舟控制台</a> 开通 Seedream 模型并创建 API Key；会自动走本站代理。',custom:'填写中转商提供的 Base URL（通常以 /v1 结尾）与密钥，并按中转文档选择接口协议。',[SDCPP]:'连接你本机运行的 stable-diffusion.cpp server（sd-server），默认监听 127.0.0.1:1234。不需要 API Key，也不经过本站代理；请保持 sd-server 只绑定本机地址。HTTPS 页面会拦截本地 HTTP（混合内容），请用 http:// 打开本站或为本地服务配置 HTTPS。'})[cfg.prov]||'';$('#cfMsg').textContent='';$('#cfMsg').className='fine'}
function cfgRead(){const prov=($('[name=prov]:checked')||{}).value||'openai';return{prov,base:$('#cfBase').value.trim(),key:$('#cfKey').value.trim(),model:$('#cfModel').value.trim(),field:$('#cfField').value,proto:$('#cfProto').value,proxy:proxyAllowed(prov)?$('#cfProxy').checked:false}}
const cfgOpen=()=>{cfgFill();$('#cfg').hidden=false;document.body.style.overflow='hidden';if(isLocal(cfg.prov))sdRead()},cfgClose=()=>{$('#cfg').hidden=true;document.body.style.overflow=''};
$('#wbCfg').onclick=cfgOpen;$('#wbCfg2').onclick=cfgOpen;$('#wbOnbGo').onclick=cfgOpen;$('#cfgX').onclick=cfgClose;$('#cfg').addEventListener('click',e=>{if(e.target.id=='cfg')cfgClose()});
$('#cfRecipeRefresh').onclick=()=>sdRefresh();
$('#cfRecipe').onchange=e=>{const v=e.target.value;sdCatalog.pending=v&&v!=sdLoaded().value?v:'';sdRender()};
$('#cfRecipeLoad').onclick=()=>sdLoad();
$('#cfRecipePending').onclick=e=>{if(e.target.closest('[data-sd-cancel]')){sdCatalog.pending='';sdRender()}};
$$('[name=prov]').forEach(r=>r.onchange=()=>{const o=cfgRead();Object.assign(cfg,o,isLocal(o.prov)?{base:PROV[SDCPP].base,model:PROV[SDCPP].model,proxy:false}:{base:'',model:''});if(forcesProxy(o.prov))cfg.proxy=true;cfgFill();if(forcesProxy(o.prov))msg('火山方舟接口不允许浏览器跨域，已开启本站代理')});
$('#cfProto').onchange=()=>{cfg.proto=$('#cfProto').value;$('#cfFieldW').hidden=cfg.proto!='edits'};
$('#cfEye').onclick=()=>{const k=$('#cfKey');k.type=k.type=='password'?'text':'password';$('#cfEye').textContent=k.type=='password'?'显示':'隐藏'};
$('#cfSave').onclick=()=>{const o=cfgRead();if(isCustom(o.prov)&&!o.base)return msg('自定义中转需要填写 Base URL',1);Object.assign(cfg,o);SV('wbCfg',cfg);render();cfgClose();toast('API 设置已保存在本机')};
$('#cfClr').onclick=()=>{cfg.key='';$('#cfKey').value='';SV('wbCfg',cfg);render();msg('已从本机清除密钥')};
function msg(t,bad){const m=$('#cfMsg');m.textContent=t;m.className='fine '+(bad?'bad':'good')}
function msgAdd(t,bad){const m=$('#cfMsg');if(m){m.textContent=(m.textContent||'')+(m.textContent?'；':'')+t;if(bad)m.className='fine bad'}}
// ---------- 本地模型发现与加载（sd.cpp 原生 API，与生图接口分开） ----------
function nativeRoot(){const b=normBase(cfg.base)||PROV[cfg.prov].base;return b.replace(/\/v1(?:beta|alpha)?$/,'')}
let sdCatalog={recipes:[],models:[],status:null,native:null,reading:false,rescanning:false,pending:null,loading:false,loadingId:null};
function renderModels(){const dl=$('#cfModels');if(!dl)return;const ids=isLocal(cfg.prov)?[...new Set(sdCatalog.models.filter(Boolean))]:PROV[cfg.prov].models||[];dl.replaceChildren(...ids.map(id=>{const o=document.createElement('option');o.value=id;return o}))}
async function readModels(){const r=await call(`${root()}/models`,{method:'GET',headers:auth()});const j=await apiBody(r);if(!r.ok)throw await apiErr(r,j,'model');const ids=[...new Set((j&&j.data||[]).map(m=>m&&m.id).filter(Boolean))];sdCatalog.models=ids;renderModels();
 if(isLocal(cfg.prov)&&ids.length&&(!cfg.model||!ids.includes(cfg.model))){cfg.model=ids[0];$('#cfModel').value=cfg.model;SV('wbCfg',cfg);msg('当前模型不在模型目录中，已改用 '+cfg.model)}
 return ids}
async function sdNative(path,method,body,signal,scope){const opt=method=='POST'?{method:'POST',signal,headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify(body||{})}:{method:'GET',signal,headers:auth()};const r=await call(`${nativeRoot()}/sdcpp/v1/${path}`,opt);const j=await apiBody(r);if(!r.ok)throw await apiErr(r,j,scope||(method=='POST'?'load':'model'));
 if(!j||typeof j!='object'||Array.isArray(j)||(r.headers.get('content-type')||'').toLowerCase().includes('text/html')){const e=Error('This server does not expose the sd.cpp native model-management API');e.unsupported=true;e.zh='此服务端未提供 sd.cpp 原生模型管理端点，已改用 OpenAI 兼容模型目录。';throw e}
 return j}
// 服务器模型状态 → 界面文案（下拉框占位与状态提示的唯一来源）
const SD_STATE={loading:{pick:'正在加载模型…',line:'本地模型正在加载…'},switching:{pick:'正在加载模型…',line:'模型切换中…'},error:{pick:'加载失败，未加载模型',line:'本地模型加载失败，当前没有可用模型'},empty:{pick:'未加载模型',line:'当前未加载模型'}};
function sdLoaded(){const s=sdCatalog.status||{},cli=s.origin=='command_line'||!!(s.runtime_recipe&&s.runtime_recipe.id=='@command-line'),st=s.state||((s.recipe||cli)?'ready':'empty');
 if(st!='ready'){const q=SD_STATE[st]||SD_STATE.empty;return{value:'',text:q.pick,state:st}}
 if(cli)return{value:'@command-line',text:(s.runtime_recipe&&s.runtime_recipe.name||'Command line')+'（命令行预加载）',state:st};
 if(s.recipe){const r=sdCatalog.recipes.find(x=>x.id==s.recipe);return{value:s.recipe,text:r&&r.name||s.recipe,state:st}}
 return{value:'',text:SD_STATE.empty.pick,state:st}}
function sdRecipeName(id){const r=sdCatalog.recipes.find(x=>x.id==id);return r&&r.name||id||''}
function sdLoadedName(){const l=sdLoaded();return l.value&&l.value!='@command-line'?sdRecipeName(l.value):''}
function sdRender(){const wrap=$('#cfSdW');if(wrap)wrap.hidden=!isLocal(cfg.prov)||sdCatalog.native===false;if(!wrap||wrap.hidden)return;const sel=$('#cfRecipe');if(!sel)return;const loaded=sdLoaded(),opts=[];
 if(loaded.value=='@command-line'||(loaded.value&&!sdCatalog.recipes.some(r=>r.id==loaded.value))){const o=document.createElement('option');o.value=loaded.value||'@command-line';o.textContent=loaded.text+(loaded.value=='@command-line'?'':'（不在配方目录）');o.disabled=true;opts.push(o)}
 sdCatalog.recipes.forEach(r=>{if(r.id=='@command-line')return;const o=document.createElement('option');o.value=r.id;o.textContent=r.name||r.id;opts.push(o)});
 if(!loaded.value){const o=document.createElement('option');o.value='';o.textContent=loaded.text;o.disabled=true;opts.unshift(o)}
 sel.replaceChildren(...opts);
 if(opts.some(o=>o.value==loaded.value))sel.value=loaded.value;else if(opts.length)sel.selectedIndex=0;
 const le=$('#cfLoaded');if(le&&sdCatalog.status){const st=sdCatalog.loading&&sdCatalog.loadingId?'switching':loaded.state,q=SD_STATE[st]||SD_STATE.empty;
  le.textContent=(st=='ready'?'当前已加载：'+loaded.text:q.line)+(loaded.state=='error'&&sdCatalog.status.error?'：'+String(sdCatalog.status.error).slice(0,120):'')}
 const pend=sdCatalog.pending&&sdCatalog.pending!=loaded.value?sdCatalog.pending:'';
 const pn=$('#cfRecipePending');if(pn)pn.innerHTML=sdCatalog.loading&&sdCatalog.loadingId?'正在加载 '+esc(sdRecipeName(sdCatalog.loadingId))+'…':pend?'待加载：'+esc(sdRecipeName(pend))+' <button class="sm ghost" data-sd-cancel="1">取消</button>':'';
 sel.disabled=sdCatalog.loading;
 const btn=$('#cfRecipeLoad');if(btn){const can=!sdCatalog.loading&&!!pend&&sdCatalog.recipes.some(r=>r.id==pend);btn.disabled=!can;btn.textContent=sdCatalog.loading&&sdCatalog.loadingId?'正在加载…':can?'加载 '+sdRecipeName(pend):'加载此配方'}}
async function sdRead(){if(sdCatalog.reading)return;sdCatalog.reading=true;const btn=$('#cfRecipeRefresh');if(btn)btn.disabled=true;msg('正在读取本地配方、模型目录与状态…');
 try{const [catRes,statusRes,modelRes]=await Promise.allSettled([sdNative('recipes','GET'),sdStatus(),readModels()]);
  if([catRes,statusRes].some(x=>x.status==='rejected'&&x.reason&&x.reason.unsupported))sdCatalog.native=false;
  else if(catRes.status==='fulfilled'&&statusRes.status==='fulfilled')sdCatalog.native=true;
  if(catRes.status==='fulfilled')sdCatalog.recipes=(catRes.value&&catRes.value.recipes||[]).filter(r=>r&&r.id);
  const keep=sdCatalog.pending&&sdCatalog.pending!=sdLoaded().value&&sdCatalog.recipes.some(r=>r.id==sdCatalog.pending);
  sdCatalog.pending=keep?sdCatalog.pending:'';
  sdRender();
  const failed=[catRes,statusRes,modelRes].find(x=>x.status==='rejected');
  if([catRes,statusRes].some(x=>x.status==='rejected'&&x.reason&&x.reason.unsupported))msg('此服务端未提供 sd.cpp 原生配方管理，已改用 OpenAI 兼容模型目录。',1);
  else if(failed)msg(nice(failed.reason),1);else msg('已读取本地配方、模型目录与状态')}
 catch(e){msg(nice(e),1)}finally{sdCatalog.reading=false;if(btn)btn.disabled=sdCatalog.loading}}
// 服务端重扫时跳过的配方条目 → 用户可读的提示（不静默丢弃）
function sdRescanNotice(errors){const list=(Array.isArray(errors)?errors:errors?[errors]:[]).filter(Boolean);if(!list.length)return'';
 const one=e=>{if(typeof e=='string')return e;if(typeof e!='object')return String(e);const f=e.file||e.path||e.recipe||'',m=e.message||e.error||e.reason||'';return (f?f+'：':'')+(m||JSON.stringify(e))};
 return '重扫发现 '+list.length+' 个无效配方：'+list.map(e=>String(one(e)).slice(0,120)).join('；')}
// 刷新按钮：先让服务端重扫磁盘，再重读配方目录与已加载模型（顺序固定）
async function sdRefresh(){if(sdCatalog.reading||sdCatalog.rescanning)return;sdCatalog.rescanning=true;const btn=$('#cfRecipeRefresh');if(btn)btn.disabled=true;
 if(sdCatalog.native===false){msg('此服务端不支持配方重扫，正在重新读取模型目录…');try{await readModels();msg('已重新读取模型目录')}catch(e){msg(nice(e),1)}finally{sdCatalog.rescanning=false;if(btn)btn.disabled=sdCatalog.reading||sdCatalog.loading}return}
 msg('正在重扫本地配方与模型文件…');
 try{const j=await sdNative('models/refresh','POST',{},null,'refresh');const note=sdRescanNotice(j&&j.errors);await sdRead();if(note)msgAdd(note,1)}
 catch(e){if(e.unsupported||e.status===404){sdCatalog.native=false;sdRender();msg('此服务端不支持配方重扫，已改用 OpenAI 兼容模型目录。',1)}else msg(nice(e),1)}finally{sdCatalog.rescanning=false;if(btn)btn.disabled=sdCatalog.reading||sdCatalog.loading}}
// 读一次服务器模型状态并写回本地状态（读目录与校正共用这一条路径）
async function sdStatus(){const st=await sdNative('models/status','GET');if(st&&Object.keys(st).length)sdCatalog.status=st;else if(!sdCatalog.status)sdCatalog.status={};return sdCatalog.status}
// 失败后重新读一次服务器状态：选择器只显示服务器实际在用的配方
let sdSyncP=null;
function sdSync(){if(sdSyncP)return sdSyncP;const before=sdLoaded().value;
 const p=(async()=>{let ok=false;try{await sdStatus();ok=true}catch(e){}
  finally{sdRender();if(before!=sdLoaded().value&&!W.busy)render()}return ok})();
 sdSyncP=p.then(v=>{sdSyncP=null;return v});
 return sdSyncP}
async function sdLoad(){if(sdCatalog.loading)return;const id=sdCatalog.pending||'';if(!id||id=='@command-line')return;
 sdCatalog.loading=true;sdCatalog.loadingId=id;const rb=$('#cfRecipeRefresh');if(rb)rb.disabled=true;sdRender();msg('正在加载配方 '+sdRecipeName(id)+'…');let ok=false;
 const ac=new AbortController();let tmo=false;const tm=setTimeout(()=>{tmo=true;ac.abort()},window.__TMO||180000);
 try{const j=await sdNative('models/load','POST',{recipe:id},ac.signal);const st=Object.assign({},j||{});
  if(st.state=='ready'&&!st.recipe)st.recipe=id;
  if(st.state&&st.state!='ready')throw Error(st.error||('本地模型未就绪（'+st.state+'）'));
  if(!st.recipe)throw Error('加载响应里没有已加载配方信息');
  sdCatalog.status=st;sdCatalog.pending='';ok=true}
 catch(e){if(tmo)msg('加载超时：等了 3 分钟还没有返回，模型可能仍在加载，请稍后点「刷新」查看状态。',1);else msg(nice(e),1);
  sdCatalog.loadingId=null;sdCatalog.pending='';sdRender();const seen=await sdSync();if(!seen)msgAdd('（未能读取服务器当前模型状态，界面显示的是上次读到的结果）')}
 finally{clearTimeout(tm);sdCatalog.loading=false;sdCatalog.loadingId=null;if(rb)rb.disabled=sdCatalog.reading;sdRender();if(ok){render();msg('已加载：'+sdRecipeName(sdLoaded().value))}}}
$('#cfTest').onclick=async()=>{const o=cfgRead();if(!o.key&&needsKey(o.prov))return msg('请先填写 API Key',1);if(isCustom(o.prov)&&!o.base)return msg('请填写 Base URL',1);const old=Object.assign({},cfg);Object.assign(cfg,o);msg('正在连接…');
 try{const g=proto()=='gemini',url=g?`${root()}/models/${encodeURIComponent(modelOf())}`:`${root()}/models`;const r=await call(url,{method:'GET',headers:auth()});const j=await apiBody(r);
  if(!r.ok){if(forcesProxy(cfg.prov)&&r.status==404){if((r.headers.get('content-type')||'').includes('text/html')){const e=Error('');e.zh='本站代理未生效：/api/proxy 返回的是网站静态页面而不是接口响应，Seedream 暂时连不上，请稍后再试或联系站长';throw e}return msg('地址可达、密钥已被接受（方舟不提供模型列表接口，可直接生成测试）')}throw await apiErr(r,j)}
  if(g)msg(`连接成功：模型 ${j&&j.displayName||modelOf()} 可用`);else{const ids=(j&&j.data||[]).map(m=>m.id),has=ids.includes(modelOf());msg(`连接成功：共 ${ids.length} 个模型`+(ids.length?(has?`，包含 ${modelOf()}`:`，但未找到 ${modelOf()}（中转可能不列出，可直接尝试）`):''))}}
 catch(e){msg(nice(e),1)}finally{Object.assign(cfg,old)}};
// ---------- 请求 ----------
function auth(){const mode=keyMode(cfg.prov);if(mode=='none')return{};return mode=='google'?{'x-goog-api-key':cfg.key}:{Authorization:'Bearer '+cfg.key}}
const p2=n=>String(n).padStart(2,'0'),stamp=d=>`${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
const OFF=/^(api\.openai\.com|generativelanguage\.googleapis\.com|ark\.[a-z0-9-]+\.(volces|bytepluses)\.com)$/;
function call(url,o){if(!proxyAllowed(cfg.prov))return fetch(url,o);let hn='';try{hn=new URL(url).hostname}catch(e){}const cu=isCustom(cfg.prov)||!OFF.test(hn);if(!cfg.proxy)return fetch(url,o);const h=new Headers(o.headers||{});h.set('x-target-url',url);if(cu)h.set('x-proxy-custom','1');return fetch('/api/proxy',Object.assign({},o,{headers:h}))}
async function fetchResult(url){let r=await fetch(url).catch(()=>null);if(!r||!r.ok)r=await fetch('/api/proxy',{headers:{'x-target-url':url,'x-proxy-kind':'image'}}).catch(()=>null);if(r&&r.ok)return r.blob();const e=Error('');e.zh='结果图片无法在浏览器中下载，请直接打开：'+url;throw e}

const SAFE_RE=/safety system|safety_violations|moderation_blocked|content_policy_violation|content policy|SensitiveContent|sensitive content|PROHIBITED_CONTENT|IMAGE_SAFETY|\bSAFETY\b|BLOCKLIST|SPII|blocked by|内容安全|敏感/i;
const CAT=[[/minor|child|CSAM/i,'涉及未成年人'],[/sexual|SEXUALLY_EXPLICIT|nudity|porn|色情/i,'性感/暴露内容'],[/violen|gore|血腥|暴力/i,'暴力或血腥'],[/self-?harm/i,'自残'],[/hate|HATE_SPEECH/i,'仇恨'],[/harass/i,'骚扰'],[/illicit|DANGEROUS/i,'危险或违法内容'],[/SPII|personal/i,'个人隐私信息'],[/copyright|RECITATION|trademark/i,'版权内容']];
function safeErr(raw,j,rid){const t=String(raw||'')+' '+JSON.stringify(j||'');if(!SAFE_RE.test(t))return null;const e=Error(String(raw||'safety'));const c=CAT.filter(x=>x[0].test(t)).map(x=>x[1]);
 e.safe={cats:[...new Set(c)],where:/InputImage|input image/i.test(t)?'in':/OutputImage|output/i.test(t)?'out':'',rid:rid||(t.match(/req_[A-Za-z0-9]+/)||[])[0]||''};
 let r=String(raw||'').trim();if(cfg.key)r=r.split(cfg.key).join('***');e.raw=r||t.slice(0,600);e.zh='被服务商的安全审核拦下了';return e}
async function apiBody(r){const t=await r.text();try{return JSON.parse(t)}catch(e){r._text=t;return null}}
const LOAD_ERR={400:'配方配置无效，请刷新配方列表后再试',409:'本地模型正忙（还有生成任务没结束），请稍后再加载',422:'本地模型加载失败',429:'本地服务器繁忙，请稍后重试',500:'本地模型加载时服务器出错',503:'本地模型正在加载中，请稍后再试'};
const REFRESH_ERR={409:'本地模型正忙，暂时不能重扫配方',503:'本地模型正在加载或卸载，请稍后再重扫'};
async function apiErr(r,j,scope){const textBody=r._text||'';const raw=(j&&(j.error&&(j.error.message||j.error.status||j.error)||j.message))||textBody||r.statusText||'';{const se=safeErr(typeof raw=='string'?raw:JSON.stringify(raw),j,(j&&j.error&&j.error.request_id)||r.headers.get('x-request-id'));if(se){se.status=r.status;return se}}
 if(isLocal(cfg.prov)){const t=String(typeof raw=='string'?raw:JSON.stringify(raw)).trim(),model=scope=='model',load=scope=='load',refresh=scope=='refresh',code=(j&&(j.code||(j.error&&j.error.code)))||'',cd=code?'（'+code+'）':'';let zh;
  if(load)zh=(LOAD_ERR[r.status]||('本地模型加载失败（HTTP '+r.status+'）'))+cd+(t?'：'+t.slice(0,300):'');
  else if(refresh)zh=(REFRESH_ERR[r.status]||('重扫本地配方与模型文件失败'+(r.status?'（HTTP '+r.status+'）':'')))+cd+(t?'：'+t.slice(0,300):'');
  else if(r.status==429)zh=model?'本地服务器繁忙，请稍后重试':'本地生成队列已满，请稍后重试';
  else if(r.status==503)zh=model?'本地模型信息暂不可用（可能正在加载），请稍等再试':'本地模型尚未就绪（可能正在加载），请稍等再重试'+cd+(t?'：'+t.slice(0,300):'');
  else if(r.status>=500)zh=(model?'读取本地模型信息失败':'本地 sd.cpp 服务器报错')+(t?'：'+t.slice(0,300):'');
  else zh=(model?'读取本地模型信息失败':'本地生图失败')+'（HTTP '+r.status+'）'+(t?'：'+t.slice(0,300):'');
  const e=Error(t);e.status=r.status;e.zh=zh;e.modelState=!model&&!load&&!refresh&&(r.status==503||/model_loading|model_not_loaded/.test(code));return e}
 const m={400:'请求参数有误：常见原因是模型不支持参考图、画幅尺寸不对或图片格式不支持，可换个模型或画幅再试',401:'密钥无效或已过期，请检查 API Key',403:'没有权限：密钥无此模型权限、账户未验证，或所在地区不受支持',404:'地址或模型不存在：请检查 Base URL 和模型名',413:'图片太大，请换一张更小的照片',429:'请求过于频繁或额度已用完，请稍后再试或检查账户余额',500:'服务商内部错误，请稍后重试',502:'网关错误（中转服务不可用）',503:'服务暂时不可用，请稍后重试',504:'服务商响应超时，请重试'}[r.status]||('请求失败（HTTP '+r.status+'）');
 let t=String(typeof raw=='string'?raw:JSON.stringify(raw));if(cfg.key)t=t.split(cfg.key).join('***');const bad=/API_KEY_INVALID|API key not valid|invalid api key|Incorrect API key|AuthenticationError|InvalidApiKey/i.test(t+' '+JSON.stringify(j||''));const ans=!bad&&t.match(/Argument not supported:\s*(\w+)/i);const e=Error(t);e.status=r.status;e.zh=(bad?'密钥无效或已过期，请检查 API Key':ans?`该服务商不支持 ${ans[1]} 参数：当前接口协议与它的规格对不上，请检查「接口协议」设置（xAI 请改选 xAI 协议）`:m)+(t?`\n服务商返回：${t.slice(0,300)}`:'');return e}
function nice(e){if(e.name=='AbortError')return'已取消';if(e instanceof TypeError&&isLocal(cfg.prov)){const base=root();if(location.protocol=='https:'&&/^http:\/\//.test(base))return '从 HTTPS 页面连接本地 HTTP 服务失败：Chrome/Firefox 通常允许回环地址，但 Safari、旧版浏览器或本地网络访问授权可能拦截（混合内容）。请允许浏览器的本地网络访问提示，改用 http:// 打开 PoseWear（例如 http://localhost:8787），或为本地服务配置 HTTPS 后再试。';return '无法连接到本地 sd.cpp 服务器：请确认 sd-server 已启动并监听当前 Base URL 指向的地址（'+base+'；默认监听 127.0.0.1:1234）。'}if(e instanceof TypeError)return'无法连接到服务商：网络不通，或该地址不允许浏览器跨域访问（CORS）。\n可在 API 设置中开启「通过本站代理转发」。';return e.zh||e.message||String(e)}
const AR={auto:null,'2:3':'1024x1536','3:4':'1024x1536','9:16':'1024x1536','1:1':'1024x1024','4:3':'1536x1024','16:9':'1536x1024'};
const SEEDREAM_SIZE={auto:'1728x2304','2:3':'1664x2496','3:4':'1728x2304','9:16':'1440x2560','1:1':'2048x2048','4:3':'2304x1728','16:9':'2560x1440'};
const sizeFor=(p,ar,fallback)=>(provInfo(p).sizeTable==='SEEDREAM'?SEEDREAM_SIZE:AR)[ar]||fallback;
const toB=async d=>(await fetch('data:image/png;base64,'+d)).blob();
async function openaiData(j,opts={}){const d=j&&j.data&&j.data[0],local=isLocal(cfg.prov),b64Only=opts.b64Only??b64OnlyMode(cfg.prov);if(!d||(b64Only?!d.b64_json:(local&&!d.b64_json&&!d.url))){const e=Error('');e.zh=local?'生图失败：本地 sd.cpp 服务器返回成功但没有图片数据，请查看服务端日志':'服务商没有返回图片数据'+(j&&j.error?'：'+(j.error.message||''):'');throw e}return d.b64_json?toB(d.b64_json):fetchResult(d.url)}
async function genOnce(imgs,prompt,sig,arO){const ar=arO||$('#wbAR').value,m=modelOf(),P=proto();let warn='';
 const json=async(withImgs,extra)=>{const body=Object.assign({model:m,prompt,n:1},extra);if(withImgs&&imgs.length)body.image=await Promise.all(imgs.map(dataURL));
  const r=await call(`${root()}/images/generations`,{method:'POST',signal:sig,headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify(body)});const j=await apiBody(r);if(!r.ok)throw await apiErr(r,j);return openaiData(j)};
 const sendReferenceRequest=async o=>{const endpoint=o.endpoint||'/images/edits',field=o.field||'image[]',size=o.size||'1024x1024',fallback=o.fallback||'tolerant',scope=o.scope||'generate',b64Only=!!o.b64Only,max=o.max||imgs.length,headers=o.headers===undefined?auth():o.headers;
  const build=f=>{const fd=new FormData();fd.append('model',m);fd.append('prompt',prompt);fd.append('n','1');fd.append('size',size);imgs.slice(0,max).forEach((b,i)=>fd.append(f,b,`ref-${i+1}.jpg`));return fd};
  const send=async f=>{const r=await call(`${root()}${endpoint}`,{method:'POST',signal:sig,headers,body:build(f)});const j=await apiBody(r);if(!r.ok)throw await apiErr(r,j,scope);return{blob:await openaiData(j,{b64Only})}};
  if(fallback=='strict')return send(field);
  const alt=field=='image[]'?'image':'image[]';
  try{return await send(field)}catch(e){if(e.name=='AbortError'||e.safe)throw e;if(/Argument not supported/i.test(e.message))throw e;
   if(e.status==400&&/image/i.test(e.message)&&!/safety|moderation|reject/i.test(e.message)){try{const r=await send(alt);return{...r,warn:'已自动改用另一种图片字段名重试成功。'}}catch(x){}}
   if([404,405,415,501].includes(e.status)||/edits|not supported|unsupported|no such|invalid url/i.test(e.message)){try{return{blob:await json(true,{size}),warn:'该接口不支持 images/edits，已自动改用 images/generations（JSON 多图）。'}}catch(x){if(x.name=='AbortError')throw x;return{blob:await json(false,{size}),warn:'该接口不支持参考图，结果只按文字生成，人物与服装可能对不齐。'}}}
   throw e}};
 if(P=='gemini'){const parts=[{text:prompt}];for(const b of imgs)parts.push({inline_data:{mime_type:b.type||'image/jpeg',data:await b64(b)}});const gc={responseModalities:['TEXT','IMAGE']};if(ar!='auto')gc.imageConfig={aspectRatio:ar};
  const r=await call(`${root()}/models/${encodeURIComponent(m)}:generateContent`,{method:'POST',signal:sig,headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:gc})});
  const j=await apiBody(r);if(!r.ok)throw await apiErr(r,j);const c=j&&j.candidates&&j.candidates[0],ps=((j&&j.candidates)||[]).flatMap(c=>(c.content&&c.content.parts)||[]),im=ps.find(p=>(p.inlineData||p.inline_data||{}).data);
  if(!im){const why=(j&&j.promptFeedback&&j.promptFeedback.blockReason)||(c&&c.finishReason);{const rs=(c&&c.safetyRatings||[]).filter(x=>x.blocked||/HIGH|MEDIUM/.test(x.probability||'')).map(x=>x.category).join(' ');const se=why&&/SAFETY|PROHIBITED|BLOCKLIST|SPII|OTHER/i.test(why)?safeErr(why+' '+rs+' '+((c&&c.finishMessage)||''),null,j&&j.responseId):null;if(se)throw se}const t=ps.map(p=>p.text).filter(Boolean).join(' ');const e=Error(t);e.zh='模型没有返回图片'+(why?`（${why}，可能触发了安全策略）`:'')+(t?'\n模型回复：'+t.slice(0,300):'');throw e}
  const d=im.inlineData||im.inline_data;return{blob:await(await fetch(`data:${d.mimeType||d.mime_type||'image/png'};base64,${d.data}`)).blob()}}
 if(P==SDCPP){const sz=AR[ar]||'1024x1024';
  if(!imgs.length)return{blob:await json(false,{size:sz})};
  return await sendReferenceRequest({endpoint:'/images/edits',field:PROV[SDCPP].field,size:sz,b64Only:b64OnlyMode(cfg.prov),fallback:fallbackMode(cfg.prov),scope:'generate'})};
 if(P=='seedream'){const ex={size:sizeFor(cfg.prov,ar,SEEDREAM_SIZE.auto),response_format:'b64_json',watermark:false};if(/seedream-4/.test(m))ex.sequential_image_generation='disabled';try{return{blob:await json(true,ex)}}catch(e){if(!e.safe&&e.status==400&&/image|参考/i.test(e.message)){warn='该模型没有接收参考图，结果只按文字生成，人物与服装可能对不齐。';return{blob:await json(false,ex),warn}}throw e}}
 if(P=='xai'){const body={model:m,prompt,n:1,response_format:'b64_json'};if(ar!='auto')body.aspect_ratio=ar;let used=imgs;
  if(imgs.length>5){used=imgs.slice(0,5);warn='xAI 参考图最多 5 张，已只发送前 5 张。'}
  if(used.length){const us=await Promise.all(used.map(dataURL));if(us.length==1)body.image={url:us[0]};else body.images=us.map(u=>({url:u}))}
  const r=await call(`${root()}/images/${used.length?'edits':'generations'}`,{method:'POST',signal:sig,headers:Object.assign({'Content-Type':'application/json'},auth()),body:JSON.stringify(body)});const j=await apiBody(r);if(!r.ok)throw await apiErr(r,j);return{blob:await openaiData(j),warn}}
 const sz=AR[ar]||(/^gpt-image/.test(m)?'auto':'1024x1024');
 if(P=='json')return{blob:await json(true,{size:sz})};
 const one=/^dall-e-2$/.test(m);
 return await sendReferenceRequest({endpoint:'/images/edits',field:isCustom(cfg.prov)?cfg.field:'image[]',size:one&&sz=='auto'?'1024x1024':sz,max:one?1:imgs.length,fallback:fallbackMode(cfg.prov),scope:'generate'})}
// ---------- 进度 ----------
let T0,tick,PR=0,done=0,total=1;function stage(t){$('#wbStage1').textContent=t}
function busy(on){$('#wbBusy').hidden=!on;$('#wbGo').classList.toggle('run',on);if(on)$('#wbGo').innerHTML='<i class="ring"></i>生成中…';$('#wbGo').disabled=on;clearInterval(tick);if(on){T0=Date.now();PR=.03;tick=setInterval(()=>{const s=(Date.now()-T0)/1e3,cap=(done+.95)/total;PR=Math.max(done/total,Math.min(cap,PR+(cap-PR)*.03));$('#wbProg').style.transform=`scaleX(${PR})`;$('#wbTime').textContent=`${Math.round(s)} 秒`+(total>1?` · 已完成 ${done} / ${total}`:'');},250)}else render()}
async function run(opts={}){if(!cfg.key&&needsKey(cfg.prov)){toast('请先配置你的 API');cfgOpen();return{got:[],errs:[],warns:[],nokey:true}}if(!opts.quick){if(!isGen()&&!hasPerson())return toast('请先上传人物照片');if(!W.garments.length&&!(isLocal(cfg.prov)&&isGen()))return toast('请先选择服装')}
 let modeBak=null;if(opts.quick&&!hasPerson()&&W.mode!='gen'){modeBak=W.mode;W.mode='gen'}
 const ac=new AbortController();W.busy=ac;$('#wbErr').hidden=true;$('#wbWarn').hidden=true;
 const n=opts.n||(+$('#wbN').value||1),sets=W.poses.length>1&&W.bm=='each'?W.poses.map(p=>[p]):[W.poses];const jobs=[];sets.forEach(s=>{for(let i=0;i<n;i++)jobs.push(s)});
 done=0;total=jobs.length;if(!opts.quick)busy(true);stage('正在准备素材…');const errs=[],warns=new Set(),got=[];
 try{const pb=W.persons.map(p=>p.blob),gb=await Promise.all(W.garments.map(assetBlob)),eb=await Promise.all(W.exprs.map(assetBlob)),cache=new Map();const poseB=async p=>{const key=p.k+':'+p.ai;if(!cache.has(key))cache.set(key,assetBlob(p));return cache.get(key)};
  const custom=opts.prompt!=null?opts.prompt:(W.dirty?$('#wbPrompt').value.trim():null);stage(total>1?`模型正在绘制… 共 ${total} 张`:'模型正在绘制…');
  let q=0;const worker=async()=>{while(q<jobs.length&&!ac.signal.aborted){const set=jobs[q++];try{const imgs=[...pb,...gb,...await Promise.all(set.map(poseB)),...eb];const prompt0=custom&&(sets.length==1||opts.quick)?custom:compose(set),soft=neutralOn()&&!isAdultJob(set),prompt=soft?neutralize(prompt0):prompt0;W.lastSent=prompt;
    const jc=new AbortController(),onA=()=>jc.abort();ac.signal.addEventListener('abort',onA);let tmo=false;const tm=setTimeout(()=>{tmo=true;jc.abort()},window.__TMO||180000);let r;try{r=await genOnce(imgs,prompt,jc.signal,opts.ar)}catch(x){x.sent=prompt;if(tmo&&!ac.signal.aborted){const y=Error('timeout');y.zh='等了 3 分钟还没有返回。服务商可能正忙，稍后点「重试」。';throw y}throw x}finally{clearTimeout(tm);ac.signal.removeEventListener('abort',onA)}if(r.warn)warns.add(r.warn);const rec={t:Date.now()+Math.random(),prov:cfg.prov,model:modelOf(),prompt,orig:soft?prompt0:null,neutral:soft,mode:W.mode,label:set.map(p=>poseDesc(p,false).split('（')[0]).join(' / ')||'',before:pb[0]||null,after:r.blob};got.push(rec);await save(rec);W.results=got.slice();if(!opts.quick)show(got.length-1)}
   catch(e){if(e.name=='AbortError')throw e;if(e.modelState)sdSync();/*本地模型状态异常：重读服务器状态，别停在失效配方上*/errs.push(e)}finally{done++;if(opts.onTick)opts.onTick(done,total)}}};
  await Promise.all(Array.from({length:Math.min(2,jobs.length)},worker));
  if(got.length){toast(got.length>1?`完成 ${got.length} 张`:'生成完成');hist();window.HIS&&HIS.refresh()}if(errs.length&&!opts.quick){const e=errs.find(x=>x.safe)||errs[0];errBox(e,got.length?`${errs.length} 张生成失败`:'')}
  if(warns.size&&!opts.quick){$('#wbWarn').hidden=false;$('#wbWarn').textContent=[...warns].join(' ')}}
 catch(e){if(e.name=='AbortError'){toast('已取消生成');if(got.length)hist()}else if(!opts.quick)errBox(e);else errs.push(e)}
 finally{if(!opts.quick)busy(false);else render();W.busy=null;if(modeBak)W.mode=modeBak}
 return{got,errs,warns:[...warns]}}
function errBox(e,head){const el=$('#wbErr');el.hidden=false;el.classList.toggle('safe',!!e.safe);
 if(e.safe){const S=e.safe,c=S.cats.length?`，原因是<b>${S.cats.join('、')}</b>`:'';const w=S.where=='in'?'上传的照片或服装图':S.where=='out'?'生成出来的图片':'这次请求';
  el.innerHTML=`<b>${head?head+' · ':''}被服务商的安全审核拦下了</b><p>${(PROV[cfg.prov]||{}).name||'服务商'} 判断${w}不合规${c}。真人照片配上比较暴露的服装（泳装、内衣、露背等）很容易被拦，OpenAI 审核最严，Gemini 和豆包 Seedream 相对宽松一些。</p><p class="fine">可以换一家服务商，或换一套遮挡多一点的服装。原样重试大多还会被拦。</p><div class="row"><button class="sm" data-ef="prov">换服务商重试</button><button class="sm ghost" data-ef="cos">换一套服装</button><button class="sm ghost" id="wbRetry">重试</button></div>${neutralOn()?'':'<div class="row"><button class="sm" data-ef="neutral">打开减少误拦截后重试</button></div>'}<details class="raw"><summary>查看原始信息</summary><pre>${esc(e.raw+(S.rid&&!e.raw.includes(S.rid)?'\nrequest id: '+S.rid:'')+(e.sent?'\n\n实际发送的提示词'+(neutralOn()?'（已开启减少误拦截）':'')+'：\n'+e.sent:''))}</pre><button class="sm ghost" data-ef="copy">复制</button></details>`;return}
 el.innerHTML=`<b>${head||'生成失败'}</b><p>${esc(nice(e)).replace(/\n/g,'<br>')}</p><div class="row"><button class="sm" id="wbRetry">重试</button><button class="sm ghost" data-open-cfg>检查 API 设置</button></div>`}
$('#wbStage').addEventListener('click',e=>{const f=e.target.closest('[data-ef]');if(f){const k=f.dataset.ef;if(k=='prov'){cfgOpen();const p=$('#cfg .prov');p.scrollIntoView({block:'start'});p.classList.remove('hl');void p.offsetWidth;p.classList.add('hl');const o=$('[name=prov]:not(:checked)');o&&o.focus()}if(k=='cos')picker('costume');if(k=='neutral'){SV('wbNeutral',true);$('#wbNeutral').checked=true;run()}if(k=='copy')A.copy?A.copy(f.previousElementSibling.textContent):navigator.clipboard.writeText(f.previousElementSibling.textContent).then(()=>toast('已复制'));return}if(e.target.id=='wbRetry')run();if(e.target.closest('[data-open-cfg]'))cfgOpen()});
$('#wbGo').onclick=run;$('#wbAgain').onclick=run;$('#wbStop').onclick=()=>W.busy&&W.busy.abort();
// ---------- 结果 ----------
let urls=[];const ru=new Map();const U=b=>{if(!ru.has(b))ru.set(b,URL.createObjectURL(b));return ru.get(b)};
function show(i,meta){const r=W.results[i];if(!r)return;{let d=$('#wbSentD');if(!d){d=document.createElement('details');d.id='wbSentD';d.className='raw sent';$('#wbOutAct').after(d)}d.hidden=!r.prompt;d.innerHTML=r.prompt?`<summary>查看原始信息${r.neutral?' · 已减少误拦截':''}</summary><pre>${esc((r.orig?'原提示词：\n'+r.orig+'\n\n实际发送：\n':'实际发送：\n')+r.prompt)}</pre>`:''}W.ri=i;const a=U(r.after),hasB=!!r.before;$('#wbAfter').src=a;if(hasB)$('#wbBefore').src=U(r.before);$('#wbCmp').hidden=false;$('#wbCmp').classList.toggle('solo',!hasB||!W.cmp);$('#wbCmpT').hidden=!hasB;$('#wbCmpT').textContent=W.cmp?'关闭对比':'前后对比';
 $('#wbPh0').hidden=true;$('#wbErr').hidden=true;$('#wbOutAct').hidden=false;setX(50);$('#wbZip').hidden=W.results.length<2;if(!matchMedia('(prefers-reduced-motion: reduce)').matches){$('#wbAfter').animate([{opacity:0,transform:'scale(1.03)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'none'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});if(hasB&&W.cmp&&!W._wig){W._wig=1;const t0=performance.now();const f=t=>{const p=(t-t0)/1400;if(p>=1)return setX(50);setX(50+Math.sin(p*Math.PI*2)*12*(1-p));requestAnimationFrame(f)};setTimeout(()=>requestAnimationFrame(f),500)}}$('#wbMeta').textContent=meta||((PROV[r.prov]||{name:r.prov}).name+' · '+r.model+(r.label?' · '+r.label:''));
 const R=$('#wbRes');R.hidden=W.results.length<2;R.innerHTML=W.results.map((x,j)=>`<button data-ri="${j}" class="${j==i?'on':''}"><img src="${U(x.after)}" alt="结果 ${j+1}"></button>`).join('');const rct=$('#wbStage').getBoundingClientRect();if(rct.bottom<0||rct.top>innerHeight)$('#wbStage').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('#wbRes').onclick=e=>{const b=e.target.closest('[data-ri]');b&&show(+b.dataset.ri)};$('#wbCmpT').onclick=()=>{W.cmp=!W.cmp;show(W.ri)};
$('#wbZip').onclick=async()=>{if(!window.makeZip)return;const ts=stamp(new Date());const fs=W.results.map((r,i)=>({name:`posewear-${r.mode=='gen'?'gen':'tryon'}-${ts}-${String(i+1).padStart(2,'0')}.png`,blob:r.after}));window.X.dl(await makeZip(fs),`posewear-tryon-${ts}.zip`);toast(`已打包 ${fs.length} 张`)};
$('#cfExp').onclick=()=>{const withKey=confirm('导出时包含 API Key 吗？\n确定 = 包含，取消 = 不含密钥');const o={...cfg};if(!withKey)delete o.key;window.X.dl(new Blob([JSON.stringify({app:'衣姿 PoseWear',type:'api-config',cfg:o},null,2)],{type:'application/json'}),'衣姿-API设置.json');msg('已导出设置'+(withKey?'（含密钥，请妥善保管）':'（不含密钥）'))};
$('#cfImp').onclick=()=>$('#cfImpF').click();$('#cfImpF').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());const o=j.cfg||j;if(!o.prov)throw 0;Object.assign(cfg,o);SV('wbCfg',cfg);cfgFill();render();msg('已导入设置')}catch(err){msg('导入失败：文件格式不正确',1)}e.target.value=''};
$('#wbDl').onclick=()=>{const r=W.results[W.ri];if(!r)return;const l=document.createElement('a');l.href=U(r.after);l.download=`posewear-${r.mode=='gen'?'gen':'tryon'}-${stamp(new Date(r.t))}-${String(W.ri+1).padStart(2,'0')}.png`;l.click()};
$('#wbUse').onclick=async()=>{const r=W.results[W.ri];if(!r)return;const x=await toJpeg(U(r.after),1536);W.persons=[{blob:x.blob,url:URL.createObjectURL(x.blob),w:x.w,h:x.h}];W.mode='tryon';render();toast('已将结果设为新的人物照片')};
function setX(x){$('#wbCmp').style.setProperty('--x',x+'%');$('#wbRange').value=x}$('#wbRange').oninput=e=>setX(e.target.value);
// ---------- IndexedDB ----------
let dbp;const db=()=>dbp||(dbp=new Promise((r,j)=>{const q=indexedDB.open('lk-studio',1);q.onupgradeneeded=()=>q.result.createObjectStore('h',{keyPath:'t'});q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)}));
const tx=async(m,f)=>{const d=await db();return new Promise((r,j)=>{const t=d.transaction('h',m),s=t.objectStore('h'),q=f(s);t.oncomplete=()=>r(q&&q.result);t.onerror=()=>j(t.error)})};
async function save(rec){try{await tx('readwrite',s=>s.put(rec));const all=await tx('readonly',s=>s.getAllKeys());if(all.length>200)await tx('readwrite',s=>{all.slice(0,all.length-200).forEach(k=>s.delete(k))})}catch(e){}}
let hu=[];async function hist(){let L=[];try{L=(await tx('readonly',s=>s.getAll()))||[]}catch(e){}L.sort((a,b)=>b.t-a.t);hu.forEach(URL.revokeObjectURL);hu=[];
 const list=L.slice(0,30);
 $('#wbHist').innerHTML=list.length?(list.map(r=>{const u=URL.createObjectURL(r.after);hu.push(u);return`<button data-t="${r.t}" title="${esc(new Date(r.t).toLocaleString('zh-CN')+(r.label?' · '+r.label:''))}"><img src="${u}" alt="历史结果"><span>${r.mode=='gen'?'生图':'试穿'} · ${esc(new Date(r.t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))}</span><i data-del="${r.t}" aria-label="删除">×</i></button>`}).join('')+(L.length>30?`<button class="hist-more" data-go="history" title="查看全部 ${L.length} 条记录"><b>全部</b><small>${L.length}条 ↗</small></button>`:'')):'<p class="fine">还没有生成记录</p>';W.hist=L}
$('#wbHist').onclick=async e=>{const d=e.target.closest('[data-del]');if(d){e.stopPropagation();const rec=(W.hist||[]).find(x=>x.t==d.dataset.del);await tx('readwrite',s=>s.delete(+d.dataset.del));await hist();if(rec)toast('已删除 1 条记录',async()=>{await tx('readwrite',s=>s.put(rec));hist()});return}const b=e.target.closest('[data-t]');if(!b)return;const r=W.hist.find(x=>x.t==b.dataset.t);if(r){W.results=[r];show(0,(PROV[r.prov]||{name:r.prov}).name+' · '+r.model+' · '+new Date(r.t).toLocaleString('zh-CN'));$('#wbStage').scrollIntoView({behavior:'smooth',block:'nearest'})}};
$('#wbHClr').onclick=async()=>{const all=W.hist||[];if(!all.length)return toast('还没有生成记录');await tx('readwrite',s=>s.clear());await hist();toast(`已清空 ${all.length} 条记录`,async()=>{await tx('readwrite',s=>{all.forEach(r=>s.put(r))});hist()})};
// ---------- 对外 ----------
let inited=false;async function init(){if(inited)return;inited=true;const gk=[].concat(g0.g||[]),pk=(g0.p||[]).filter(x=>Array.isArray(x)),ek=(g0.e||[]).filter(x=>Array.isArray(x));const need=[gk.length&&'costume',gk.some(k=>k[0]=='a')&&'anime',pk.length&&'pose',ek.length&&'expr'].filter(Boolean);if(need.length)await Promise.all(need.map(A.load)).catch(()=>{});
 if(!W.garments.length)W.garments=gk.filter(k=>A.ITEMS[k]).slice(0,1).map(k=>({kind:'lib',k}));if(!W.poses.length)W.poses=pk.filter(x=>A.ITEMS[x[0]]).slice(0,6).map(x=>({kind:'lib',k:x[0],ai:x[1]??A.ITEMS[x[0]].ai}));if(!W.exprs.length)W.exprs=ek.filter(x=>A.ITEMS[x[0]]).slice(0,1).map(x=>({kind:'lib',k:x[0],ai:x[1]??A.ITEMS[x[0]].ai}));hist()}
async function setSel(sel){await init();W.garments=(sel.garment||[]).slice(0,2).map(it=>({kind:'lib',k:it.k}));W.poses=(sel.pose||[]).slice(0,6).map(it=>({kind:'lib',k:it.k,ai:it.ai}));W.exprs=(sel.expr||[]).slice(0,1).map(it=>({kind:'lib',k:it.k,ai:it.ai}));const pk=(sel.portrait||[])[0];if(pk){if(!(W.persons.length&&W.persons[0].k==pk.k)){W.persons=[];await addPortrait(pk)}}else W.persons=[];reprompt(true);render();return $('#wbPrompt').value}
window.WB={async show(){await init();render()},async pick(it){await init();if(it.type=='pose'){if(!W.poses.some(p=>p.k==it.k)){if(W.poses.length>=6)W.poses.shift();W.poses.push({kind:'lib',k:it.k,ai:it.ai})}toast(`已加入姿势参考（${W.poses.length} 个）`)}else if(it.type=='portrait'){await addPortrait(it)}else if(it.type=='expr'){W.exprs=[{kind:'lib',k:it.k,ai:it.ai}];toast('已加入表情参考（只取神态）')}else{W.garments=[{kind:'lib',k:it.k}];toast('已选为试穿服装')}A.setTab('studio')},_W:W,_cfg:cfg,db:{tx,save,hist:()=>tx('readonly',s=>s.getAll()),del:t=>tx('readwrite',s=>s.delete(t)),clear:()=>tx('readwrite',s=>s.clear()),put:r=>tx('readwrite',s=>s.put(r)),refreshHist:hist},quick:o=>run(Object.assign({},o||{},{quick:true})),cfgOpen,nice,needsKey:()=>needsKey(cfg.prov),busy:()=>!!W.busy,stop:()=>{if(W.busy)W.busy.abort()},provLabel:()=>provLabel(),setSel};
if(document.body.classList.contains('studio'))WB.show();
if(location.hash=='#studio'){const t0=()=>scrollTo(0,0);requestAnimationFrame(t0);addEventListener('load',()=>setTimeout(t0,0),{once:true})}
addEventListener('keydown',e=>{if(e.key=='Escape'){if(!$('#pk').hidden)pkClose();else if(!$('#cfg').hidden)cfgClose()}});
})();
// v10：手机端把密钥引导卡放到第 1 步之前
(()=>{const mq=matchMedia('(max-width:760px)'),o=document.getElementById('wbOnb');if(!o)return;const place=()=>{if(mq.matches){const s1=document.querySelector('.st-l [data-s="1"]');s1&&s1.parentNode.insertBefore(o,s1)}else document.querySelector('.st-c').prepend(o)};place();mq.addEventListener('change',place)})();
