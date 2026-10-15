const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const loading = document.querySelector('#loading');
const status = document.querySelector('#status');

const TILE = 48, COLS = 51, ROWS = 64, VIEW_W = 20 * TILE, VIEW_H = 12 * TILE;
const root = 'assets/';
const tileNames = {
  0:'grass', 1:'wall', 2:'water', 3:'earth', 4:'tree', 5:'sand', 6:'water01',
  7:'tree', 8:'road00', 9:'water00', 10:'grass00', 11:'grass01',
  12:'water00', 13:'water01', 14:'water02', 15:'water03', 16:'water04',
  17:'water05', 18:'water06', 19:'water07', 20:'water08', 21:'water09',
  22:'water10', 23:'water11', 24:'water12', 25:'water13', 26:'road00',
  27:'road01', 28:'road02', 29:'road03', 30:'road04', 31:'road05',
  32:'road06', 33:'road07', 34:'road08', 35:'road09', 36:'road10',
  37:'road11', 38:'road12', 39:'earth', 40:'wall', 41:'tree', 42:'hut',
  43:'floor01', 44:'table01', 45:'floor01', 46:'floor01'
};
const solidTiles = new Set([1,2,4,6,9,12,13,14,15,16,17,18,19,20,21,22,23,24,25,40,41,44]);
const images = {};
const keys = new Set();
let map = [], gameState = 'title', last = 0, attackTimer = 0, message = 'Press Enter to begin';

const player = { x: 23*TILE, y: 34*TILE, speed: 180, direction:'down', frame:0, hp:6, maxHp:6, coins:0, kills:0 };
const monsters = [
  {x:23*TILE,y:40*TILE,type:'green',hp:2,alive:true}, {x:39*TILE,y:10*TILE,type:'green',hp:2,alive:true},
  {x:39*TILE,y:11*TILE,type:'green',hp:2,alive:true}, {x:40*TILE,y:10*TILE,type:'green',hp:2,alive:true},
  {x:12*TILE,y:31*TILE,type:'green',hp:2,alive:true}, {x:10*TILE,y:55*TILE,type:'pink',hp:3,alive:true},
  {x:38*TILE,y:10*TILE,type:'green',hp:2,alive:true}, {x:40*TILE,y:12*TILE,type:'red',hp:4,alive:true}
];
const objects = [
  {x:22*TILE,y:22*TILE,type:'coin_bronze',taken:false}, {x:23*TILE,y:22*TILE,type:'coin_bronze',taken:false},
  {x:22*TILE,y:23*TILE,type:'potion_red',taken:false}, {x:24*TILE,y:22*TILE,type:'potion_red',taken:false},
  {x:36*TILE,y:44*TILE,type:'heart_full',taken:false}, {x:32*TILE,y:32*TILE,type:'chest',taken:false}
];
const npcs = [{x:21*TILE,y:21*TILE,type:'oldman',text:'Welcome, adventurer! Explore the world and defeat the slimes.'}];

function asset(path) { const img = new Image(); img.src = root + path; images[path] = img; return img; }

function loadAssets() {
  Object.values(tileNames).forEach(n => asset(`tiles/${n}.png`));
  ['down','up','left','right'].forEach(d => [1,2].forEach(i => asset(`player/boy_${d}_${i}.png`)));
  ['down', 'up', 'left', 'right'].forEach(direction => [1, 2].forEach(frame =>asset(`attack/boy_attack_${direction}_${frame}.png`)));
  ['green','pink','red'].forEach(c => [1,2].forEach(i => asset(`monsters/${c}slime_down_${i}.png`)));
  asset('NPC/oldman_down_1.png'); 
  asset('objects/coin_bronze.png'); asset('objects/potion_red.png');
  asset('objects/heart_full.png'); 
  asset('objects/chest.png');
}
async function loadMap() {
  const text = await fetch('assets/map/worldV3.txt').then(r => r.text());
  map = text.trim().split(/\r?\n/).slice(0, ROWS).map(line => line.trim().split(/\s+/).map(Number));
  while (map.length < ROWS) map.push(Array(COLS).fill(0));
  map = map.map(row => { while(row.length < COLS) row.push(0); return row.slice(0,COLS); });
}
function waitForAssets() { return new Promise(resolve => { const check = () => Object.values(images).every(i => i.complete) ? resolve() : setTimeout(check,30); check(); }); }

function tileAt(x,y) { return map[Math.floor(y/TILE)]?.[Math.floor(x/TILE)] ?? 1; }

function blocked(x,y,w=24,h=24) {
  return [
    [x-w/2,y-h/2],[x+w/2,y-h/2],[x-w/2,y+h/2],[x+w/2,y+h/2]
  ].some(([px,py]) => solidTiles.has(tileAt(px,py)));
}
function moveEntity(e, dx, dy) {
  if (!blocked(e.x+dx,e.y,e.w||22,e.h||22)) e.x += dx;
  if (!blocked(e.x,e.y+dy,e.w||22,e.h||22)) e.y += dy;
}

function sprite(path, x, y, w = null, h = null) {
    const img = images[path];
    if (!img) {
        return;
    }
    if (w === null || h === null) {
        const scale = TILE / 16;
        w = img.naturalWidth * scale;
        h = img.naturalHeight * scale;
    }
    ctx.drawImage(
        img,
        x - w / 2,
        y - h / 2,
        w,
        h
    );
}

function camera() { return {x:Math.max(0,Math.min(COLS*TILE-VIEW_W,player.x-VIEW_W/2)), y:Math.max(0,Math.min(ROWS*TILE-VIEW_H,player.y-VIEW_H/2))}; }
function drawWorld() {
  const cam=camera(), startX=Math.floor(cam.x/TILE), startY=Math.floor(cam.y/TILE);
  for(let r=startY;r<Math.min(ROWS,startY+13);r++) for(let c=startX;c<Math.min(COLS,startX+21);c++) {
    const n=map[r]?.[c]??0, img=images[`tiles/${tileNames[n]||'grass'}.png`];
    if(img) ctx.drawImage(img,c*TILE-cam.x,r*TILE-cam.y,TILE,TILE);
  }
  objects.filter(o=>!o.taken).forEach(o=>sprite(`objects/${o.type}.png`,o.x-cam.x,o.y-cam.y,40,40));
  npcs.forEach(n=>sprite('NPC/oldman_down_1.png',n.x-cam.x,n.y-cam.y));
  monsters.filter(m=>m.alive).forEach(m=>sprite(`monsters/${m.type}slime_down_${m.frame?2:1}.png`,m.x-cam.x,m.y-cam.y));
  const suffix=attackTimer>0?'attack_':'';
  const file=attackTimer>0?`attack/boy_attack_${player.direction}_${player.frame?2:1}.png`:`player/boy_${player.direction}_${player.frame?2:1}.png`;
  console.log('Rendering player sprite:', file);
  sprite(file,player.x-cam.x,player.y-cam.y);
}
function text(str,x,y,size=22,color='#fff',align='left') { 
  ctx.font=`${size}px Maru, sans-serif`; ctx.textAlign=align; 
  ctx.fillStyle=color; 
  ctx.fillText(str,x,y);
 }
function drawHud() {
  ctx.fillStyle='#000a'; ctx.fillRect(16,16,280,56); 
  text('♥'.repeat(player.hp)+'♡'.repeat(player.maxHp-player.hp),28,52,25,'#f87171'); 
  text(`Coins: ${player.coins}`,180,52,19,'#fde68a');
  text('WASD / arrows: move   Space/J: attack   P: pause',20,VIEW_H-18,16,'#fff');
}
function drawTitle() {
  ctx.fillStyle='#122033'; 
  ctx.fillRect(0,0,VIEW_W,VIEW_H); 
  ctx.fillStyle='#1e3a5f'; 
  ctx.fillRect(70,70,VIEW_W-140,VIEW_H-140);
  text('2D ADVENTURE',VIEW_W/2,185,54,'#fef3c7','center'); 
  text('WEB EDITION',VIEW_W/2,225,24,'#fbbf24','center');
  text('▶  New Game',VIEW_W/2,330,30,'#fff','center'); 
  text('Explore • Fight • Discover',VIEW_W/2,410,20,'#cbd5e1','center');
  text('Press Enter or click to play',VIEW_W/2,500,20,'#fbbf24','center');
}
function drawPause() { 
  ctx.fillStyle='#0009'; 
  ctx.fillRect(0,0,VIEW_W,VIEW_H); 
  text('PAUSED',VIEW_W/2,260,48,'#fff','center'); 
  text('Press P to continue',VIEW_W/2,315,22,'#fbbf24','center'); }

function update(dt) {
  if(gameState!=='play') return;
  let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
  let dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
  if(dx||dy) { 
    const len=Math.hypot(dx,dy); dx=dx/len*player.speed*dt; dy=dy/len*player.speed*dt; 
    if(Math.abs(dx)>Math.abs(dy)) player.direction=dx>0?'right':'left';
    else player.direction=dy>0?'down':'up'; moveEntity(player,dx,dy); 
    player.frame=(Math.floor(performance.now()/150)%2); }
  attackTimer=Math.max(0,attackTimer-dt);
  objects.forEach(o=>{if(!o.taken&&Math.hypot(player.x-o.x,player.y-o.y)<30){o.taken=true;if(o.type.includes('coin'))player.coins++;
    if(o.type==='heart_full')player.hp=Math.min(player.maxHp,player.hp+2);if(o.type==='potion_red')player.hp=Math.min(player.maxHp,player.hp+1);message=`Collected ${o.type.replace('_',' ')}`;}});
    monsters.filter(m=>m.alive).forEach(m=>{m.frame=Math.floor(performance.now()/300)%2; 
    const dist=Math.hypot(player.x-m.x,player.y-m.y); 
    if(dist<420){
      const dx=player.x-m.x,dy=player.y-m.y,len=Math.hypot(dx,dy)||1;
      moveEntity(m,dx/len*35*dt,dy/len*35*dt);
    } 
      if(dist<30&&Math.random()<dt*.6) player.hp=Math.max(0,player.hp-1);});
      if(player.hp<=0){gameState='gameover';message='You were defeated';}
}
function attack() { 
  if(gameState!=='play'||attackTimer>0)return; 
  attackTimer=.3; player.frame=1; 
  monsters.forEach(m=>{if(m.alive&&Math.hypot(player.x-m.x,player.y-m.y)<75){m.hp--;if(m.hp<=0){m.alive=false;player.kills++;player.coins+=2;message='Slime defeated!';}}});
  
}

function render() { 
  ctx.clearRect(0,0,VIEW_W,VIEW_H); 
  if(gameState==='title')drawTitle(); else {drawWorld();
    drawHud();
    if(gameState==='pause')drawPause();
      if(gameState==='gameover'){ctx.fillStyle='#000b';
      ctx.fillRect(0,0,VIEW_W,VIEW_H);
      text('GAME OVER',VIEW_W/2,260,48,'#f87171','center');
      text('Press Enter to restart',VIEW_W/2,320,22,'#fff','center');
    }
  } 
  status.textContent=message; 
  const file = attackTimer > 0
  ? `attack/boy_attack_${player.direction}_${player.frame ? 2 : 1}.png`
  : `player/boy_${player.direction}_${player.frame ? 2 : 1}.png`;
}

function loop(now){
  const dt=Math.min(.05,(now-last)/1000||0);
  last=now;update(dt);
  render();requestAnimationFrame(loop);
}
function start(){gameState='play';
  message='Find the slimes and explore the map';}

window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();

keys.add(e.key);if((e.key==='Enter'||e.key===' ')&&gameState==='title')start();
if(e.key.toLowerCase()==='p'&&['play','pause'].includes(gameState))gameState=gameState==='play'?'pause':'play';
if (!e.repeat && (e.key.toLowerCase() === 'j' || e.key === ' ')) {
    attack();
}
if(e.key==='Enter'&&gameState==='gameover')location.reload();});

window.addEventListener('keyup',e=>keys.delete(e.key)); canvas.addEventListener('click',()=>{
  if(gameState==='title')start();
  else canvas.focus();});
  (async()=>{loadAssets();await loadMap();await waitForAssets();loading.classList.add('ready');requestAnimationFrame(loop);})().catch(err=>{loading.textContent='Could not load the game: '+err.message;console.error(err);
  });
