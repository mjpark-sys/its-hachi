'use strict';
// Replace sample captions/media here with verified Instagram post content.
// 인스타그램 게시물 기준 데이터: [분류, 날짜, 원문 주소, 제목, 해시태그, 본문]
// 이미지: media/board/hachi-01.webp … (게시물 순서와 같은 번호)
const CATEGORY_LABEL={'하치':'하치 이야기','미토피아':'미토피아 친구들'};
const posts = [
 ["미토피아", "2026.10.20", "https://www.instagram.com/reel/Devl3ccM6Gj/", "늙크크 멘트, 진지가 모아왔Z", "", "진지: 애들은 가라Z😎\n늙크크라면 한 번 쯤 써 본 적 있는\n멘트만 진지가 모아왔Z😉\n\n✔️ 어떻게 하면 소문이 날까~\n✔️ 안 봐도 비디오야\n✔️ 시계 밥 좀 줘라!\n✔️ 완전 탈렌트네\n✔️ 보자 보자~ 가만있어 보자~\n\n내가 아는 늙크크 멘트가 있다면?!\n댓글로 알려달라Z💬"],
 ["하치", "2026.10.18", "https://www.instagram.com/p/DeqQMaYE8dL/", "인성 바사삭 vs 인성 촉촉", "#가습기작동전후 #인성바사삭 #인성촉촉 #하치는 #배고플때 #인성바사삭이에욤", "맥 : 푸석푸석 Emotion까지\ndry해버린 나 K-직장인😑\n혹시 몰라 경.고.하.는.데\n회사에서 내 name 부르지 마요.😡\n\n하치 : 맥 대리님 까칠모드 때문에\n분위기도 완전 건조해졌어욤😢\n퓨어 스팀 가습기라도 켜드려야겠어욤✨\n\n~🪄쿠첸 퓨어스팀 가습기 ON 🪄~\n\n진지 : 맥 대리, 퇴근 1분 전에 미안하다Z~\n\n맥 : 진지님~ Don’t say 미안~\n완전 Possible~ 😎\n퇴근 1분 전인데 하치님은 얼른 칼퇴 해~💧\n\n아하! 하치는 깨달았어욤!\n쿠첸 퓨어 스팀 가습기가\n메마른 직장인 인성까지 촉촉하게 만드는군욤🩵\n\n밥풀이들,\n회사에서 언제 가장 인성 바사삭해욤? 👀\n댓글로 알려줘봐욤!"],
 ["미토피아", "2026.10.13", "https://www.instagram.com/p/DedYOgFExEV/", "회사 빌런이 사라지게 해주슉", "#직장내빌런보존의법칙 #뭔가잘못됐어 #단단히 #알고보니 #빌런이 #바로나였던건에대하여…", "설익태 : 제발…회사 빌런이 사라지게 해주슉🙏\n\n앗?! 어디선가 소리💨가 나는데?\n👼지니가 나타난거슉?\n\n뭐슉? 파워스윕 먼지 자동감지 센서가\n왜 내 앞에서 켜진거슉?\n\n왜 내가 빨려 들어가고 있는 거슉?!!? 😱\n\n빌런 나 아니라고!!😭\n\n💬 회사 빌런 퇴치 필요한 밥풀아,\n댓글로 빌런 사라지게 해달라고 소원 빌어보슉 👀\n\n쿠첸 파워스윕이 소원을 들어줄 수도🤫"],
 ["하치", "2026.10.11", "https://www.instagram.com/p/DeYnWopk0m5/", "내 또래 재력 상태", "#내또래재력상태 #내상태 #냉동고만보면 #마음이둑흔둑흔", "하치 : 내 집 마련🏠? 내 차🚗?\n멋진 어른의 삶도 좋지만…\n\n저는 좋아하는 음식으로 냉동고만 채워도\n세상 다 가진 사람처럼 행복해욤 😌💞\n\n강력한 직접 냉각으로\n식재료는 신선하게 지키고,\n넉넉하고 효율적인 수납공간으로\n먹을 행복까지 알차게 채워두면… 🧊\n\n마음만은 내가 제일 부자예욤 💸\n\n밥풀이들의 마음 재력상태는 어때욤?\n댓글로 자랑해주세욤 👇"],
 ["하치", "2026.10.04", "https://www.instagram.com/p/DeGG7huk1zj/", "인생 첫 위내시경", "#하치 #인생첫 #위내시경 #진료거부 #내잘못아님 #무조건아님", "Dr.척척 : 하치 환자, 병명이 나왔어요.\n당신은 심각한 탱글백미🍚 중독입니다.\n\n하치 : 흥😤 모르고 하시는 소리!\n티탄 컬렉션 탱글백미는 차원이 다르다구욤.\n\n밥알 하나하나 감싸는\n마이크로 에어버블이 만들어낸 그 탱글함!\n\n한 번도 안 먹어본 사람은 있어도\n한 번만 먹어본 사람은 없어욤!!🥰\n\nDr.척척 : ...차원이 다르긴 하죠.😅\n\n밥풀이들아,\n하치 자제력 부족 VS 탱글백미가 과하게 맛있는 탓\n\n누구 탓이에욤? 댓글로 판단해줘욤!"],
 ["미토피아", "2026.08.11", "https://www.instagram.com/p/Db6_S2uoNDX/", "브레인의 현재 모드는?", "#이벤트 #2026년형브레인 #현재모드를맞혀라 #26년형브레인 #안귀여워하기 #그거어떻게하는건데", "진지 : 오늘도 사무실에 퍼지는 구수한 밥 냄새🍚\n직원 여러분, 설마 점심도 거르고 일하려는Z?\n\n말리진 않겠다만,\n2026년형 브레인이 구수하게 낋여주는\n갓 지은 밥으로 든든하게 배 채워야Z!\n브레인이 여러분을 내솥 빠지게 기다리고 있Z!\n\n그나저나, 브레인의 눈웃음 가득한 표정이\n뭘 말하더라…?\n\n💬🤔댓글로 브레인의 현재 모드를 맞혀보라Z!\n1. 취사 완료\n2. 대기 모드\n3. 절전 모드\n\n📅 이벤트 기간: 8.12(수) ~ 8.25(화)\n📢 당첨자 발표: 8.27(목), 당첨자 개별 DM\n🎁 경품: 투썸플레이스 아메리카노 기프티콘 (5명)\n\n✨ 참여 방법:\nSTEP 1. @cuchen_kr 인스타그램 팔로우\nSTEP 2. 브레인의 현재 모드를 댓글로 맞히기!"],
 ["하치", "2026.08.06", "https://www.instagram.com/p/DbuDwIzDC6Z/", "믿기 힘든 현실, 직장인의 삶", "#믿기힘든현실 #직장인의삶 #울디마 #나자신 #화이팅", "하치 : 금요일 점심은 정말 행복해욤 🌼\n\n쿠첸 123이 고슬고슬한 잡곡밥도 해주고🍚\n갈비탕에 깍두기 하나 척 올려 먹고🍖\n휴게실에서 20분 낮잠까지 자면...💤\n\n🤔\n\n생각해보니...\n\n회사에서 밥 먹고,\n회사에서 쉬고,\n회사에서 커피 마시고...\n\n집은...\n잠깐 충전하러 들르는 곳 같아욤...\n제 월세... 울고 있겠죰...💸\n\n이번 주말은 기필코 집에서 뽕 뽑을 거예욤!\n\n🍳 밥풀이들은 집콕하면 꼭 해 먹는 음식이 있나욤?\n댓글로 추천해 주세욤! 👇"],
 ["하치", "2026.07.30", "https://www.instagram.com/p/DbcMjmPIDdf/", "POV: 가짜 배고픔 특 (ft. 하치)", "#POV #가짜배고픔 #특징", "하치 : 분명 밥 먹었는데… 왜 또 배고픈 거예욤?🤔\n\n이게 바로 말로만 듣던\n가짜 배고픔인가 봐욤🍚\n\n배에서 꼬르륵 소리가 나니까\n진짜 배고픈 줄 알고 뭔가 먹어 봤는데,\n기다리다 보니 하치가 먼저 잠들어 버렸어욤😴💤\n\n밥풀이들도 밥 먹은 지 얼마 안 됐는데\n괜히 냉장고 열어본 적 있어욤?👀\n\n그럴 땐 배보다 마음이 심심한 건 아닌지\n잠깐 생각해 봐야 한다구욤!\n\n그리고 밥풀이들에게\n마음까지 든든해질 반가운 소식💛\n\n먹대장 하치와 미토피아 친구들의 이야기가 담긴\n그림책 『미토피아 밥친구들』이 출간됐어욤!📚🎉\n\n자꾸만 뭔가 당기는 날엔\n간식 대신 하치의 이야기를 한 장씩 펼쳐보는 건 어때욤?✨"],
 ["하치", "2026.07.16", "https://www.instagram.com/p/Da3_DeIjwyo/", "하치의 갓생 시작, 독서", "#갓생시작 #진지모드 #미토피아밥친구들 #하치가선정한 #올해의동화책", "하치 : 지금부터 30분 간 말 시키지 마세욤🤫\n\n한 해의 절반이 훌쩍 지났으니,\n먹대장 하치도 갓생 살아보려구욤💪\n\n바로 독서하기~!📖\n\n매일매일 맛있는 밥으로 몸의 양식을 채우는 것도 중요하지만🍚\n가끔은 책으로 마음의 양식도 채워야\n미토피아&밥티칸 시티의 당당한 하치가 될 수 있다구욤!✨\n\n요즘 하치의 최애 책은\n<미토피아 밥친구들>📚💛\n\n밥풀이들도 7월 목표 세웠어욤?🎯\n지금까지 얼마나 달성했는지\n중간 점검해 볼까욤?\n\n💬 어떤 목표를 세웠고,\n지금은 어디까지 왔는지 댓글로 알려줘욤!"],
 ["미토피아", "2026.07.02", "https://www.instagram.com/p/DaUjmPgoJ9G/", "국보랜드 개장, 쿠첸 CUBE 밥솥", "#국보랜드 #개장 #국보탄생 #레트로디자인 #탑승객 #모집중", "진지 : Ssal랜드에 오신 것을 환영하Z~🎡\n오늘 국보랜드의 NEW어트랙션,\n국보 37호 ‘쿠첸 CUBE 밥솥’이 드디어 공개됐Z!\n\n🎢IH압력의 강력한 고화력으로\n한 톨 한 톨 디테일한 밥맛 유지!\n\n🎡큐브 디자인에\n어느 주방에도 자연스럽게 녹아드는\n부드러운 아이보리 컬러!\n\n🎠냉동보관밥 기능으로\n갓 지은 밥맛까지 오래오래 즐길 수 있Z!\n\n매력적인 CUBE 밥솥 시승하러 온 밥풀이들은\n댓글에 ‘🍚’ 이모지 달고 탑승 줄부터 서라Z!👇"]
].map(([category,date,url,title,tags,caption],i)=>({category,date,url,title,tags,caption,image:`media/board/hachi-${String(i+1).padStart(2,'0')}.webp`})).concat(EXTRA_POSTS).sort((a,b)=>b.date.localeCompare(a.date));

/* ============================================================
   롤링 ⇄ 리스트 보기
   - 전체 게시물 카드가 롤링(나선)으로 돌다가, 리스트로 바꾸면 게시물 수에 맞춰 펼쳐집니다.
   - 조절하고 싶은 값은 아래 SETTINGS 에 모아 두었습니다.
   ============================================================ */
const SETTINGS={
 rollCardHeight:.42,    // 롤링 카드 크기: 무대 높이 대비 카드 '가로' 비율 (키우려면 .62, 줄이려면 .46)
 rollCardMaxW:.25,      // 롤링 카드 가로 상한: 화면 너비 대비 (모바일은 아래 값)
 rollCardMaxWMobile:.46,
 rollRadius:.38,        // 롤링이 좌우로 퍼지는 폭: 화면 너비 대비
 rollTilt:6,           // 롤링 축 기울기(도): 레퍼런스처럼 오른쪽이 내려가는 기울기. 0이면 수평
 rollSpacing:.30,       // 카드 사이 세로 간격: 카드 높이 대비 (좁게 .24, 넓게 .38)
 rollSeconds:5.2,       // 카드 한 장 지나가는 시간(초). 느리게 하려면 값을 키우세요
 unfurlMs:950,          // 펼쳐지는 시간
 unfurlStagger:45,      // 카드마다 시작이 늦어지는 간격(ms)
 listGap:22,            // 리스트 카드 사이 간격
 captionH:130           // 리스트 카드 아래 글자와 다음 행 사이 여백을 포함한 높이
};
const main=document.querySelector('main'),stage=document.querySelector('#stage'),scene=document.querySelector('#spiral'),dock=document.querySelector('#dock'),header=document.querySelector('.site-header'),modal=document.querySelector('#post-modal'),pauseButton=document.querySelector('#pause'),btnRoll=document.querySelector('#view-roll'),btnList=document.querySelector('#view-list'),countEl=document.querySelector('#count');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const N=posts.length,SLOTS=Math.max(24,N),RATIO=1.25; // 카드 세로/가로 비율 (인스타 게시물 4:5)
let active=0,opener=null,paused=reduced,hovering=false,focused=false,phase=0,last=0,onScreen=true;
let mode='roll',filter='전체',W=0,rollH=0,listH=0,curListH=0,gP=0,gDir=0;
const UNFURL=reduced?1:SETTINGS.unfurlMs,STAGGER=reduced?0:SETTINGS.unfurlStagger;
countEl.textContent=`${N}개의 게시물`;
const cards=[];
for(let i=0;i<SLOTS;i++){const index=i%N,post=posts[index],button=document.createElement('button');button.className='spiral-card';button.type='button';button.setAttribute('aria-label',post.title+' 게시글 보기');
 button.innerHTML=`<span class="media"><img src="${post.image}" alt="${index===i?post.title:''}" draggable="false"><span class="card-open" aria-hidden="true">↗</span></span><span class="cap"><small>${CATEGORY_LABEL[post.category]} · ${post.date}</small><strong>${post.title}</strong></span>`;
 if(i>=N)button.setAttribute('aria-hidden','true');
 button.addEventListener('click',()=>openPost(index,button));button.addEventListener('pointerenter',()=>hovering=true);button.addEventListener('pointerleave',()=>hovering=false);
 scene.append(button);cards.push({el:button,index,i,p:0,dir:0,wait:0,l:null,w:-1,vis:'',tab:null});}
scene.addEventListener('focusin',()=>focused=true);scene.addEventListener('focusout',e=>{if(!scene.contains(e.relatedTarget))focused=false;});
function syncPause(){pauseButton.textContent=paused?'▷':'Ⅱ';pauseButton.setAttribute('aria-label',paused?'애니메이션 재생':'애니메이션 일시정지');pauseButton.setAttribute('aria-pressed',String(paused));}
pauseButton.addEventListener('click',()=>{paused=!paused;syncPause();});syncPause();
new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;}).observe(stage);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const visibleIdx=()=>posts.map((p,j)=>j).filter(j=>filter==='전체'||posts[j].category===filter);
/* 크기 측정 + 리스트 배치 계산 */
let listPos=[],listW=0,listCardH=0;
function measure(){
 W=stage.clientWidth;
 const hh=header?header.offsetHeight:70;
 rollH=Math.max(460,innerHeight-hh-dock.offsetHeight);
 layoutList();
}
function layoutList(){
 const cols=W>=1280?5:W>=900?4:W>=600?3:2,padX=0,gap=W<640?14:SETTINGS.listGap;
 listW=(W-padX*2-gap*(cols-1))/cols;listCardH=listW*RATIO;
 const rowH=listCardH+SETTINGS.captionH,vis=visibleIdx(),rows=Math.max(1,Math.ceil(vis.length/cols));
 const padTop=W<640?28:40,padBottom=48;
 listPos=posts.map((p,j)=>{const k=vis.includes(j)?vis.indexOf(j):j;return{x:padX+(k%cols)*(listW+gap)+listW/2,y:padTop+Math.floor(k/cols)*rowH+listCardH/2,show:vis.includes(j)};});
 listH=Math.max(rollH,padTop+rows*rowH-SETTINGS.captionH*.4+padBottom);
 if(!curListH)curListH=listH;
}
new ResizeObserver(()=>{measure();}).observe(stage);addEventListener('resize',measure);measure();
/* 보기 방식 바꾸기 */
function setMode(next,instant){
 if(next===mode&&!instant)return;
 mode=next;main.dataset.mode=mode;hovering=false;
 btnRoll.setAttribute('aria-pressed',String(mode==='roll'));btnList.setAttribute('aria-pressed',String(mode==='list'));
 const dir=mode==='list'?1:-1;gDir=dir;
 cards.forEach(c=>{c.dir=dir;c.wait=instant?0:Math.min(c.index,9)*STAGGER*(dir>0?1:.6);if(instant)c.p=dir>0?1:0;});
 if(instant)gP=dir>0?1:0;
 if(mode==='roll'&&scrollY>0)scrollTo({top:0,behavior:reduced?'auto':'smooth'});
}
btnRoll.addEventListener('click',()=>setMode('roll'));btnList.addEventListener('click',()=>setMode('list'));
/* 프레임 */
function frame(time){
 const dt=Math.min((time-last)||0,50);last=time;
 const moving=cards.some(c=>c.p>0&&c.p<1||(c.dir!==0&&c.wait>0));
 if(!paused&&!hovering&&!focused&&!modal.open&&onScreen&&!document.hidden&&(mode==='roll'||moving))phase=(phase+dt/(SETTINGS.rollSeconds*1000))%SLOTS;
 gP=clamp(gP+gDir*dt/(UNFURL*1.15));
 curListH+=(listH-curListH)*(1-Math.exp(-dt/110));if(Math.abs(listH-curListH)<.5)curListH=listH;
 const eg=ease(gP),H=lerp(rollH,Math.max(rollH,curListH),eg);
 if(Math.abs((stage._h||0)-H)>.3){stage.style.height=H+'px';stage._h=H;}
 scene.style.setProperty('--fade',(8*(1-eg)).toFixed(2)+'%');
 scene.style.transform=SETTINGS.rollTilt?`skewY(${(SETTINGS.rollTilt*(1-eg)).toFixed(2)}deg)`:'';
 /* 롤링 형태 */
 const rollW=Math.round(clamp(Math.min(rollH*SETTINGS.rollCardHeight,W*(W<700?SETTINGS.rollCardMaxWMobile:SETTINGS.rollCardMaxW)),110,420)),rollCardH=rollW*RATIO;
 const radius=W*(W<700?.30:SETTINGS.rollRadius),spacing=rollCardH*SETTINGS.rollSpacing,zAmp=rollW*.85,cx=W/2,cy=rollH/2;
 cards.forEach(c=>{
  if(c.wait>0)c.wait-=dt;else if(c.dir!==0)c.p=clamp(c.p+c.dir*dt/UNFURL);
  const e=ease(c.p),el=c.el;
  /* 리스트 목표(부드럽게 따라감) */
  const lp=listPos[c.index],tgtOp=(c.i<N&&lp.show)?1:0;
  if(!c.l)c.l={x:lp.x,y:lp.y,op:tgtOp};
  else{const k=1-Math.exp(-dt/90);if(lp.show){c.l.x+=(lp.x-c.l.x)*k;c.l.y+=(lp.y-c.l.y)*k;}c.l.op+=(tgtOp-c.l.op)*k;}
  /* 롤링 목표 */
  let x=cx,y=cy,z=0,rot=0,op=1,zi=1;
  if(e<1){
   const pp=(c.i+phase)%SLOTS,ang=(pp-SLOTS/2)*Math.PI/4,depth=Math.cos(ang); // 화면 세로 중앙(pp=12)에서 각도 0 = 시선에 가장 가까운 면이 정면 중앙에 오도록
   let r=(ang*180/Math.PI)%360;if(r>180)r-=360;
   x=cx+Math.sin(ang)*radius;y=cy+(pp-SLOTS/2)*spacing;z=depth*zAmp;rot=r;op=.62+.38*(depth+1)/2;zi=Math.round((depth+1)*100);
   c.depth=depth;
  }
  const w=lerp(rollW,listW,e);
  if(e>0){x=lerp(x,c.l.x,e);y=lerp(y,c.l.y,e);z=lerp(z,0,e);rot=lerp(rot,0,e);op=lerp(op,c.l.op,e);zi=Math.round(zi*(1-e))+1;}
  const h=w*RATIO;
  if(Math.abs(w-c.w)>.4){el.style.width=w.toFixed(1)+'px';c.w=w;}
  el.style.transform=`translate3d(${(x-w/2).toFixed(1)}px,${(y-h/2).toFixed(1)}px,${z.toFixed(1)}px) rotateY(${rot.toFixed(2)}deg)`;
  el.style.opacity=op.toFixed(3);el.style.zIndex=String(zi);
  el.style.setProperty('--cap',clamp((e-.55)/.45).toFixed(3));
  const inRoll=Math.abs(y-cy)<rollH/2+h*.6,show=op>.01&&(e>0||inRoll),vis=show?'visible':'hidden';
  if(vis!==c.vis){el.style.visibility=vis;c.vis=vis;}
  const tab=(e<.5?(show&&c.depth>0):(c.i<N&&lp.show))?0:-1;
  if(tab!==c.tab){el.tabIndex=tab;c.tab=tab;}
 });
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
/* 분류 필터 (리스트 보기) */
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 filter=button.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
 countEl.textContent=`${visibleIdx().length}개의 게시물`;layoutList();
}));
if(location.hash==='#list'||/[?&]view=list\b/.test(location.search))setMode('list',true);
function renderPagination(){
 const pages=document.querySelector('#post-pages');
 const focusedPage=pages.contains(document.activeElement);
 const start=Math.max(0,Math.min(active-2,posts.length-5));
 pages.replaceChildren();
 for(let i=start;i<Math.min(start+5,posts.length);i++){
  const button=document.createElement('button');
  button.type='button';button.textContent=String(i+1);
  button.setAttribute('aria-label',`${i+1}번 게시글`);
  if(i===active)button.setAttribute('aria-current','page');
  button.addEventListener('click',()=>{active=i;renderPost();});
  pages.append(button);
 }
 document.querySelector('#prev').disabled=active===0;
 document.querySelector('#next').disabled=active===posts.length-1;
 if(focusedPage)pages.querySelector('[aria-current="page"]').focus({preventScroll:true});
}
function renderPost(){const post=posts[active];document.querySelector('#post-title').textContent=post.title;document.querySelector('#post-caption').textContent=post.caption;document.querySelector('#post-category').textContent=CATEGORY_LABEL[post.category]+' / '+post.date;const img=document.querySelector('#post-image');img.src=post.image;img.alt=post.title;const tags=document.querySelector('#post-tags');tags.textContent=post.tags;tags.hidden=!post.tags;document.querySelector('#post-link').href=post.url;renderPagination();document.querySelector('.post-body').scrollTop=0;}
function openPost(index,button){active=index;opener=button;renderPost();modal.showModal();document.body.style.overflow='hidden';document.querySelector('.close').focus();}
function closePost(){modal.close();}
modal.addEventListener('close',()=>{document.body.style.overflow='';opener?.focus({preventScroll:true});});document.querySelector('.close').addEventListener('click',closePost);
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePost();}});
document.querySelector('#prev').addEventListener('click',()=>{active=Math.max(0,active-1);renderPost();});document.querySelector('#next').addEventListener('click',()=>{active=Math.min(posts.length-1,active+1);renderPost();});
modal.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();document.querySelector('#prev').click();}if(e.key==='ArrowRight'){e.preventDefault();document.querySelector('#next').click();}});
