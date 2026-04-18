import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import prisma from './db/prisma';
import { setupSocket } from './socket';
import { MatchService } from './db/match';
import { loginWithLine, devLogin } from './auth';

const PORT = parseInt(process.env.PORT || '3000');
const isDev = process.env.NODE_ENV !== 'production';

async function start() {
  const fastify = Fastify({ logger: false });

  await fastify.register(fastifyCors, { origin: true });

  // ===== API Routes =====
  fastify.get('/api/health', async () => ({
    status: 'ok',
    time: new Date().toISOString(),
    db: 'connected',
  }));

  // ===== Auth Routes =====
  // LINE LIFF login
  fastify.post('/api/auth/login', async (req, reply) => {
    try {
      const { accessToken } = req.body as { accessToken: string };
      if (!accessToken) {
        return reply.code(400).send({ error: 'accessToken is required' });
      }
      const result = await loginWithLine(accessToken);
      return result;
    } catch (err) {
      console.error('Login error:', err);
      return reply.code(401).send({ error: 'Login failed' });
    }
  });

  // Dev login (no LINE needed - dev only)
    // Guest login (no LINE needed - for browser testing)
  fastify.post('/api/auth/dev-login', async (req, reply) => {
    try {
      
    try {
      const { name } = (req.body as { name?: string }) || {};
      const result = await devLogin(name);
      return result;
    } catch (err) {
      console.error('Dev login error:', err);
      return reply.code(500).send({ error: 'Dev login failed' });
    }
  });

  fastify.get('/api/leaderboard', async (req) => {
    const { game } = req.query as { game?: string };
    const gameType = game || 'tap_battle';
    const data = await MatchService.getLeaderboard(gameType);
    return {
      leaderboard: data.map((r: any, i: number) => ({
        rank: i + 1,
        name: r.user.displayName,
        pic: r.user.pictureUrl,
        wins: r.totalWins,
        losses: r.totalLoss,
        earned: r.totalEarned.toNumber(),
        streak: r.bestStreak,
      })),
    };
  });

  fastify.get('/api/stats', async () => {
    const users = await prisma.user.count();
    const matches = await prisma.match.count({ where: { status: 'finished' } });
    return { totalUsers: users, totalMatches: matches };
  });

  // ===== Serve React (only if build exists) =====
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  const clientExists = fs.existsSync(clientDist) && fs.existsSync(path.join(clientDist, 'index.html'));

  if (clientExists) {
    console.log('📂 Serving React from:', clientDist);
    await fastify.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
      wildcard: false,
    });

    fastify.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    console.log('⚠️ Client build not found at:', clientDist);
    console.log('   Serving API only mode');

    // Fallback: serve a simple HTML page
    fastify.get('/', async (req, reply) => {
      reply.type('text/html').send(getFallbackHTML());
    });

    fastify.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      reply.type('text/html').send(getFallbackHTML());
    });
  }

  // ===== Start =====
  await fastify.listen({ port: PORT, host: '0.0.0.0' });

  // Socket.IO
  const io = new Server(fastify.server, {
    cors: { origin: '*' },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  setupSocket(io);

  // Test DB connection
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected (${userCount} users)`);
  } catch (err) {
    console.error('⚠️ Database not connected:', (err as Error).message);
  }

  console.log(`🚀 Skill Arena running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🌍 ${isDev ? 'Development' : 'Production'} mode`);
}

start().catch((err) => {
  console.error('❌ Server failed:', err);
  process.exit(1);
});

// Fallback HTML if React build doesn't exist
function getFallbackHTML(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#0F212E">
<title>Skill Arena</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
<style>
:root{--bg:#0F212E;--bg2:#1A2C38;--bg3:#213743;--bg4:#2F4553;--green:#00E701;--red:#F53B57;--gold:#FFC107;--white:#F1F5F9;--gray:#7B8A95}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--white);min-height:100vh}
.app{max-width:440px;margin:0 auto;padding:16px;min-height:100vh}
.screen{display:none;animation:fadeIn .3s ease}.screen.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes pop{0%{transform:scale(2.5);opacity:0}70%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.nav{display:flex;align-items:center;justify-content:space-between;padding:8px 0 16px}
.nav-logo{font-size:20px;font-weight:900}.nav-logo span{color:var(--green)}
.nav-on{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray)}
.nav-dot{width:8px;height:8px;border-radius:50%;background:var(--green);animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
.wallet{background:var(--bg3);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.w-icon{width:36px;height:36px;border-radius:10px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:16px}
.w-lbl{font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.w-amt{font-size:20px;font-weight:800;color:var(--green);margin-top:1px}
.btn-s{background:var(--bg4);color:var(--white);font-weight:600;padding:8px 16px;border-radius:8px;font-size:12px;border:none;cursor:pointer}
.btn-s:active{transform:scale(.95)}
.sec{font-size:13px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.8px;margin:20px 0 10px}
.gc{background:var(--bg2);border:1.5px solid transparent;border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s;margin-bottom:8px;width:100%;text-align:left}
.gc:active{transform:scale(.98)}.gc.ready:hover{border-color:var(--green)}
.gc.locked{opacity:.35;pointer-events:none}
.gc-i{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.gc-n{font-weight:700;font-size:14px}.gc-d{color:var(--gray);font-size:11px;margin-top:2px}
.badge{font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;display:inline-block;margin-left:6px}
.b-live{background:rgba(0,231,1,.15);color:var(--green)}.b-soon{background:var(--bg4);color:var(--gray)}
.gc-f{text-align:right;flex-shrink:0}.gc-f .a{color:var(--green);font-weight:700;font-size:14px}
.gc-f .l{color:var(--gray);font-size:9px;text-transform:uppercase;margin-top:1px}
.center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:75vh;text-align:center}
.spinner{width:48px;height:48px;border:3px solid var(--bg4);border-top:3px solid var(--green);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:20px}
.vs-row{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.vs-av{width:64px;height:64px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;margin:0 auto 6px}
.vs1 .vs-av{background:rgba(0,231,1,.12);color:var(--green);border:2px solid var(--green)}
.vs2 .vs-av{background:rgba(245,59,87,.12);color:var(--red);border:2px solid var(--red)}
.tap-btn{width:180px;height:180px;border-radius:50%;background:var(--green);border:none;color:var(--bg);font-size:18px;font-weight:900;cursor:pointer;transition:transform .04s;box-shadow:0 0 40px rgba(0,231,1,.25);text-transform:uppercase;letter-spacing:2px;user-select:none;-webkit-user-select:none}
.tap-btn:active{transform:scale(.9)}.tap-btn.off{background:var(--bg4);color:var(--gray);box-shadow:none;pointer-events:none}
.btn-m{background:var(--green);color:var(--bg);font-weight:800;padding:14px 0;border-radius:10px;font-size:15px;border:none;cursor:pointer;width:100%;max-width:280px;margin-bottom:8px;text-transform:uppercase}
.btn-m:active{transform:scale(.97)}
.btn-x{background:var(--bg3);color:var(--white);font-weight:600;padding:12px 0;border-radius:10px;font-size:13px;border:1px solid var(--bg4);cursor:pointer;width:100%;max-width:280px}
.btn-x:active{transform:scale(.97)}
.r-scores{background:var(--bg2);border-radius:12px;padding:16px 28px;display:flex;gap:36px;margin:16px 0;border:1px solid var(--bg4)}
.footer{text-align:center;color:var(--bg4);font-size:10px;margin-top:28px}
</style>
</head>
<body>
<div class="app">
<div id="lobby" class="screen active">
  <div class="nav"><div class="nav-logo"><span>Skill</span> Arena</div><div class="nav-on"><div class="nav-dot"></div><span id="onlineCount">0</span> online</div></div>
  <div class="wallet"><div style="display:flex;align-items:center;gap:10px"><div class="w-icon">💰</div><div><div class="w-lbl">Balance</div><div class="w-amt" id="walletDisplay">฿0.00</div></div></div><button class="btn-s" onclick="deposit()">+ Deposit</button></div>
  <div class="sec">Games</div>
  <div id="gameList"></div>
  <div class="footer">Skill Arena v2.0 · No luck. Just skill.</div>
</div>
<div id="queueScreen" class="screen"><div class="center"><div class="spinner"></div><div style="font-size:18px;font-weight:700;margin-bottom:6px">Finding opponent</div><div style="color:var(--gray);font-size:13px">Matching you with a player...</div><button class="btn-x" style="margin-top:24px" onclick="cancelQ()">Cancel</button></div></div>
<div id="vsScreen" class="screen"><div class="center"><div class="vs-row"><div class="vs1"><div class="vs-av" id="vsYA">Y</div><div style="font-size:13px;font-weight:600;text-align:center" id="vsYN">You</div></div><div style="font-size:32px;font-weight:900;color:var(--gold)">VS</div><div class="vs2"><div class="vs-av" id="vsOA">O</div><div style="font-size:13px;font-weight:600;text-align:center" id="vsON">Opp</div></div></div><div style="color:var(--gray);font-size:13px">Prize: <span style="color:var(--green);font-weight:700" id="vsP">฿9.50</span></div></div></div>
<div id="cdScreen" class="screen"><div class="center"><div id="cdNum" style="font-size:96px;font-weight:900;color:var(--green)">3</div></div></div>
<div id="gameScreen" class="screen"><div class="center"><div id="gTimer" style="font-size:56px;font-weight:900;color:var(--green)">5.0</div><div style="color:var(--gray);font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:20px">Tap as fast as you can!</div><button class="tap-btn" id="tapBtn" ontouchstart="handleTap(event)" onclick="handleTap(event)">TAP</button><div style="font-size:52px;font-weight:900;margin-top:20px" id="gScore">0</div><div style="color:var(--gray);font-size:11px;text-transform:uppercase;font-weight:600;margin-top:2px">Your taps</div><div style="margin-top:10px;color:var(--gray);font-size:13px">Opponent: <span style="color:var(--red);font-weight:800;font-size:18px" id="gOpp">0</span></div></div></div>
<div id="resultScreen" class="screen"><div class="center"><div id="rIcon" style="font-size:64px;margin-bottom:12px">🏆</div><div id="rTitle" style="font-size:24px;font-weight:900;margin-bottom:4px">You win!</div><div id="rSub" style="color:var(--gray);font-size:13px;margin-bottom:16px"></div><div class="r-scores"><div style="text-align:center"><div style="font-size:11px;color:var(--gray);text-transform:uppercase;font-weight:600;margin-bottom:4px">You</div><div id="rYou" style="font-size:32px;font-weight:900;color:var(--green)">0</div></div><div style="text-align:center"><div style="font-size:11px;color:var(--gray);text-transform:uppercase;font-weight:600;margin-bottom:4px">Opponent</div><div id="rOpp" style="font-size:32px;font-weight:900;color:var(--red)">0</div></div></div><div id="rPrize" style="font-size:18px;font-weight:800;margin-bottom:20px;color:var(--green)">+฿9.50</div><button class="btn-m" onclick="playAgain()">Play again</button><button class="btn-x" onclick="goLobby()">Lobby</button></div></div>
</div>
<script>
const socket=io();let wallet=0,currentMatchId=null,timerInt=null;
const GAMES=[
{id:'tap_battle',name:'Tap Speed',icon:'⚡',desc:'Tap faster than opponent in 5s',color:'#00E701',ready:true},
{id:'memory_flip',name:'Memory Flip',icon:'🧠',desc:'Match cards faster',color:'#E056A0',ready:false},
{id:'math_duel',name:'Math Duel',icon:'🔢',desc:'Solve math first',color:'#4FC3F7',ready:false},
{id:'aim_click',name:'Aim Click',icon:'🎯',desc:'Click targets precisely',color:'#F53B57',ready:false},
{id:'puzzle_rush',name:'Puzzle Rush',icon:'🧩',desc:'Solve puzzles fast',color:'#26C281',ready:false},
{id:'strategy_card',name:'Strategy Card',icon:'⚔️',desc:'RPS evolved',color:'#9B59B6',ready:false},
{id:'reaction_dodge',name:'Reaction Dodge',icon:'🏃',desc:'Dodge longest wins',color:'#E67E22',ready:false}
];
const myName='Player_'+Math.floor(Math.random()*9999);
socket.emit('set_name',myName);
function renderGames(){document.getElementById('gameList').innerHTML=GAMES.map(g=>'<button class="gc '+(g.ready?'ready':'locked')+'" '+(g.ready?'onclick="play(\\''+g.id+'\\')\"':'')+'><div class="gc-i" style="background:'+g.color+'18">'+g.icon+'</div><div style="flex:1;min-width:0"><div class="gc-n">'+g.name+'<span class="badge '+(g.ready?'b-live':'b-soon')+'">'+(g.ready?'Live':'Soon')+'</span></div><div class="gc-d">'+g.desc+'</div></div><div class="gc-f"><div class="a">฿5</div><div class="l">Entry</div></div></button>').join('')}
renderGames();
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function deposit(){wallet+=50;document.getElementById('walletDisplay').textContent='฿'+wallet.toFixed(2)}
function play(id){socket.emit('find_match',id)}
function cancelQ(){socket.emit('cancel_queue')}
function handleTap(e){if(e)e.preventDefault();if(!currentMatchId)return;socket.emit('tap',currentMatchId);if(navigator.vibrate)navigator.vibrate(8)}
function playAgain(){play('tap_battle')}
function goLobby(){show('lobby')}
socket.on('wallet_update',v=>{wallet=v;document.getElementById('walletDisplay').textContent='฿'+wallet.toFixed(2)});
socket.on('online_count',n=>document.getElementById('onlineCount').textContent=n);
socket.on('queued',()=>show('queueScreen'));
socket.on('queue_cancelled',()=>show('lobby'));
socket.on('queue_timeout',()=>show('lobby'));
socket.on('error_msg',m=>alert(m));
socket.on('match_found',d=>{currentMatchId=d.matchId;document.getElementById('vsYA').textContent=d.you.charAt(0).toUpperCase();document.getElementById('vsYN').textContent=d.you;document.getElementById('vsOA').textContent=d.opponent.charAt(0).toUpperCase();document.getElementById('vsON').textContent=d.opponent;document.getElementById('vsP').textContent='฿'+d.prize;show('vsScreen')});
socket.on('countdown',n=>{show('cdScreen');const el=document.getElementById('cdNum');el.textContent=n;el.style.animation='none';void el.offsetHeight;el.style.animation='pop .4s ease';if(navigator.vibrate)navigator.vibrate(30)});
socket.on('game_start',d=>{currentMatchId=d.matchId;document.getElementById('gScore').textContent='0';document.getElementById('gOpp').textContent='0';document.getElementById('gTimer').textContent='5.0';document.getElementById('gTimer').style.color='var(--green)';document.getElementById('tapBtn').classList.remove('off');show('gameScreen');const st=Date.now();timerInt=setInterval(()=>{const left=Math.max(0,(d.duration-(Date.now()-st))/1000);document.getElementById('gTimer').textContent=left.toFixed(1);if(left<=2)document.getElementById('gTimer').style.color='var(--red)';if(left<=0){clearInterval(timerInt);document.getElementById('tapBtn').classList.add('off')}},50)});
socket.on('your_score',s=>document.getElementById('gScore').textContent=s);
socket.on('opponent_tap',s=>document.getElementById('gOpp').textContent=s);
socket.on('match_result',d=>{clearInterval(timerInt);document.getElementById('tapBtn').classList.add('off');const rI=document.getElementById('rIcon'),rT=document.getElementById('rTitle'),rP=document.getElementById('rPrize');document.getElementById('rYou').textContent=d.yourScore;document.getElementById('rOpp').textContent=d.oppScore;if(d.result==='win'){rI.textContent='🏆';rT.textContent='You win!';rT.style.color='var(--green)';rP.textContent='+฿'+d.prize.toFixed(2);rP.style.color='var(--green)';document.getElementById('rYou').style.color='var(--green)';document.getElementById('rOpp').style.color='var(--red)'}else if(d.result==='draw'){rI.textContent='🤝';rT.textContent='Draw!';rT.style.color='var(--gold)';rP.textContent='Refund ฿'+d.refund.toFixed(2);rP.style.color='var(--gold)';document.getElementById('rYou').style.color='var(--green)';document.getElementById('rOpp').style.color='var(--green)'}else{rI.textContent='😤';rT.textContent='You lose';rT.style.color='var(--red)';rP.textContent='-฿5.00';rP.style.color='var(--red)';document.getElementById('rYou').style.color='var(--red)';document.getElementById('rOpp').style.color='var(--green)'}if(navigator.vibrate)navigator.vibrate(d.result==='win'?[50,50,50]:[100]);setTimeout(()=>show('resultScreen'),600)});
</script>
</body>
</html>`;
}
