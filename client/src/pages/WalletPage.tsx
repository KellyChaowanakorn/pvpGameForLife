import { useState, useEffect } from 'react';
import { useGameStore } from '../lib/store';

interface Tx { id: number; type: string; amount: number; balanceBefore: number; balanceAfter: number; description: string; createdAt: string; }

export default function WalletPage() {
  const { wallet, setWallet, setScreen, token } = useGameStore();
  const [tab, setTab] = useState<'main' | 'deposit' | 'withdraw' | 'history'>('main');
  const [txs, setTxs] = useState<Tx[]>([]);
  const [depAmt, setDepAmt] = useState(100);
  const [wdAmt, setWdAmt] = useState(100);
  const [ppId, setPpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const refresh = async () => { try { const r = await fetch('/api/wallet/balance', { headers: h }); if (r.ok) { const d = await r.json(); setWallet(d.balance); } } catch {} };
  const loadTx = async () => { try { const r = await fetch('/api/wallet/transactions', { headers: h }); if (r.ok) { const d = await r.json(); setTxs(d.transactions); } } catch {} };
  useEffect(() => { refresh(); loadTx(); }, []);

  const deposit = async () => {
    setLoading(true); setMsg('');
    try { const r = await fetch('/api/wallet/deposit', { method: 'POST', headers: h, body: JSON.stringify({ amount: depAmt }) }); const d = await r.json(); setMsg(r.ok ? '✅ สร้างคำขอเติมเงินแล้ว!' : '❌ ' + d.error); if (r.ok) setTab('main'); } catch { setMsg('❌ เกิดข้อผิดพลาด'); }
    setLoading(false);
  };
  const withdraw = async () => {
    if (!ppId) { setMsg('❌ กรุณาใส่เบอร์ PromptPay'); return; }
    setLoading(true); setMsg('');
    try { const r = await fetch('/api/wallet/withdraw', { method: 'POST', headers: h, body: JSON.stringify({ amount: wdAmt, promptpayId: ppId }) }); const d = await r.json(); setMsg(r.ok ? '✅ สร้างคำขอถอนเงินแล้ว!' : '❌ ' + d.error); if (r.ok) { refresh(); setTab('main'); } } catch { setMsg('❌ เกิดข้อผิดพลาด'); }
    setLoading(false);
  };

  const tl: Record<string, string> = { deposit: '💰 เติมเงิน', withdraw: '💸 ถอนเงิน', entry_fee: '🎮 ค่าเข้าเกม', prize: '🏆 รางวัล', refund: '↩️ คืนเงิน' };
  const tc: Record<string, string> = { deposit: 'text-cute-mint', withdraw: 'text-cute-red', entry_fee: 'text-cute-red', prize: 'text-cute-mint', refund: 'text-cute-gold' };

  return (
    <div className="animate-[fadeIn_0.3s_ease]">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setScreen('lobby')} className="text-cute-gray hover:text-cute-dark text-xl">←</button>
        <div className="text-lg font-bold text-cute-dark">💰 Wallet</div>
      </div>
      {msg && <div className={`mb-3 px-4 py-2 rounded-2xl text-sm font-semibold ${msg.startsWith('✅') ? 'bg-cute-mint/10 text-cute-mint' : 'bg-cute-red/10 text-cute-red'}`}>{msg}</div>}

      {tab === 'main' && <>
        <div className="cute-card p-6 mb-4 text-center" style={{ animation: 'glow-cute 3s ease infinite' }}>
          <div className="text-cute-gray text-xs font-semibold mb-1">ยอดเงินคงเหลือ</div>
          <div className="text-4xl font-black text-cute-pink tabular-nums mb-4">฿{wallet.toFixed(2)}</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTab('deposit')} className="cute-btn bg-cute-mint/10 text-cute-mint py-3 text-sm border-2 border-cute-mint/20">💰 เติมเงิน</button>
            <button onClick={() => setTab('withdraw')} className="cute-btn bg-cute-red/10 text-cute-red py-3 text-sm border-2 border-cute-red/20">💸 ถอนเงิน</button>
          </div>
        </div>
        <button onClick={() => { setTab('history'); loadTx(); }} className="cute-card w-full p-3 flex items-center justify-between mb-4 active:scale-[0.98]">
          <span className="text-sm font-semibold text-cute-dark">📋 ประวัติธุรกรรม</span>
          <span className="text-cute-gray text-xs">→</span>
        </button>
      </>}

      {tab === 'deposit' && <div className="cute-card p-5">
        <div className="text-base font-bold text-cute-dark mb-4">💰 เติมเงิน</div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[50, 100, 200, 500].map(a => <button key={a} onClick={() => setDepAmt(a)} className={`cute-btn py-2 text-sm ${depAmt === a ? 'bg-cute-pink text-white' : 'bg-cute-soft text-cute-dark'}`}>฿{a}</button>)}
        </div>
        <input type="number" value={depAmt} onChange={(e) => setDepAmt(Number(e.target.value))} className="w-full bg-cute-bg border-2 border-cute-border rounded-2xl px-4 py-3 text-cute-dark text-lg font-bold mb-4 outline-none focus:border-cute-pink" />
        <button onClick={deposit} disabled={loading} className="cute-btn w-full bg-cute-pink text-white py-3 text-sm shadow-lg shadow-cute-pink/20 disabled:opacity-50">{loading ? '...' : `ยืนยัน ฿${depAmt}`}</button>
        <button onClick={() => setTab('main')} className="w-full mt-2 text-cute-gray text-sm py-2">ยกเลิก</button>
      </div>}

      {tab === 'withdraw' && <div className="cute-card p-5">
        <div className="text-base font-bold text-cute-dark mb-4">💸 ถอนเงิน</div>
        <div className="text-cute-gray text-xs mb-1">จำนวนเงิน (ขั้นต่ำ ฿20)</div>
        <input type="number" value={wdAmt} onChange={(e) => setWdAmt(Number(e.target.value))} className="w-full bg-cute-bg border-2 border-cute-border rounded-2xl px-4 py-3 text-cute-dark text-lg font-bold mb-3 outline-none focus:border-cute-pink" />
        <div className="text-cute-gray text-xs mb-1">เบอร์ PromptPay</div>
        <input type="text" value={ppId} onChange={(e) => setPpId(e.target.value)} placeholder="0812345678" className="w-full bg-cute-bg border-2 border-cute-border rounded-2xl px-4 py-3 text-cute-dark mb-4 outline-none focus:border-cute-pink" />
        <button onClick={withdraw} disabled={loading} className="cute-btn w-full bg-cute-red text-white py-3 text-sm disabled:opacity-50">{loading ? '...' : `ยืนยันถอน ฿${wdAmt}`}</button>
        <button onClick={() => setTab('main')} className="w-full mt-2 text-cute-gray text-sm py-2">ยกเลิก</button>
      </div>}

      {tab === 'history' && <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-cute-dark">📋 ประวัติธุรกรรม</div>
          <button onClick={() => setTab('main')} className="text-cute-gray text-xs">← กลับ</button>
        </div>
        {txs.length === 0 ? <div className="text-center text-cute-gray text-sm py-10">ยังไม่มีรายการ</div>
         : <div className="flex flex-col gap-2">{txs.map(tx => (
          <div key={tx.id} className="cute-card p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-cute-dark">{tl[tx.type] || tx.type}</span>
              <span className={`text-sm font-bold tabular-nums ${tc[tx.type] || 'text-cute-dark'}`}>{tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cute-gray">{tx.description}</span>
              <span className="text-[10px] text-cute-gray">{new Date(tx.createdAt).toLocaleDateString('th-TH')}</span>
            </div>
          </div>
        ))}</div>}
      </div>}
    </div>
  );
}
