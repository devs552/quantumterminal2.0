'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Settings, Download } from 'lucide-react';
import { createExchangeConnector } from '@/services/exchangeConnector';
import { Trade, ExchangeConfig } from '@/lib/types';

interface HeatmapSettings {
  exchange: 'binance' | 'bybit' | 'hyperliquid' | 'okx';
  symbol: string;
  priceGrouping: number;
  timeAggregation: '1m' | '5m' | '15m' | '1h';
  profileType: 'fixed-range' | 'visible-range';
  showBuySell: boolean;
  showImbalance: boolean;
}

interface HeatmapCell {
  id: string;
  price: number;
  time: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  imbalance: number;
}

interface Bubble {
  time: number;
  price: number;
  size: number;
  isBuy: boolean;
}

// ─── Canvas renderer ─────────────────────────────────────────────────────────
// Layout matches the reference image (Bookmap / Quantower style):
//  ┌──────────────────────────────────┬──────────────┐
//  │  CHART  (time → right, price ↑)  │  Y-AXIS 86px │
//  │  Each price row = horizontal     │  price labels │
//  │  scanline. Red = ask (above mid) │  + volume     │
//  │  Green = bid (below mid)         │  notations    │
//  ├──────────────────────────────────┴──────────────┤
//  │  X-AXIS  22px  (time labels)                    │
//  └─────────────────────────────────────────────────┘

function drawHeatmap(
  canvas: HTMLCanvasElement,
  cells: HeatmapCell[],
  bubbles: Bubble[],
  maxVolume: number,
  showImbalance: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !cells.length) return;

  const W = canvas.width;
  const H = canvas.height;
  const YAXIS_W = 86;
  const XAXIS_H = 22;
  const chartW = W - YAXIS_W;
  const chartH = H - XAXIS_H;

  ctx.fillStyle = '#050809';
  ctx.fillRect(0, 0, W, H);

  const times  = [...new Set(cells.map(c => c.time ))].sort((a, b) => a - b);
  const prices = [...new Set(cells.map(c => c.price))].sort((a, b) => a - b);
  if (!times.length || !prices.length) return;

  const colW = chartW / times.length;
  const rowH = Math.max(1, chartH / prices.length);

  const timeIndex  = new Map(times .map((t, i) => [t, i]));
  const priceIndex = new Map(prices.map((p, i) => [p, i]));

  // Mid-price: highest-volume cell in the last time slot
  const lastCells = cells.filter(c => c.time === times[times.length - 1]);
  const midPrice  = lastCells.length
    ? lastCells.reduce((a, b) => (a.volume > b.volume ? a : b)).price
    : prices[Math.floor(prices.length / 2)];
  const midPriceIdx = priceIndex.get(midPrice) ?? Math.floor(prices.length / 2);

  // ── Horizontal scanline cells ────────────────────────────────────────────
  cells.forEach(cell => {
    const ti = timeIndex.get(cell.time)!;
    const pi = priceIndex.get(cell.price)!;
    const total = cell.buyVolume + cell.sellVolume;
    if (total < 0.0001) return;

    const intensity = Math.min(total / (maxVolume * 0.28), 1);
    const alpha     = 0.10 + intensity * 0.90;
    let r = 0, g = 0, b = 0;

    if (showImbalance) {
      if (cell.imbalance > 0.5) { g = Math.round(55 + intensity * 185); r = 8; }
      else                      { r = Math.round(75 + intensity * 175); g = 8; }
    } else {
      const isAsk = pi >= midPriceIdx;
      if (isAsk) { r = Math.round(75 + intensity * 175); g = Math.round(intensity * 15); b = 10; }
      else       { g = Math.round(50 + intensity * 185); r = Math.round(intensity * 10); b = 25; }
    }

    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(
      Math.floor(ti * colW),
      Math.floor(chartH - (pi + 1) * rowH),
      Math.ceil(colW) + 1,
      Math.ceil(rowH) + 1,
    );
  });

  // ── Dotted price trail ───────────────────────────────────────────────────
  const priceLine: Array<{ x: number; y: number }> = [];
  times.forEach((t, ti) => {
    const slot = cells.filter(c => c.time === t);
    if (!slot.length) return;
    const best = slot.reduce((a, b) => (a.volume > b.volume ? a : b));
    const pi   = priceIndex.get(best.price)!;
    priceLine.push({ x: (ti + 0.5) * colW, y: chartH - (pi + 0.5) * rowH });
  });

  if (priceLine.length > 1) {
    ctx.beginPath();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(195,230,255,0.65)';
    ctx.lineWidth = 1;
    priceLine.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Trade bubbles ────────────────────────────────────────────────────────
  bubbles.forEach(bub => {
    const ti = timeIndex.get(bub.time);
    const pi = priceIndex.get(bub.price);
    if (ti === undefined || pi === undefined) return;
    const cx  = (ti + 0.5) * colW;
    const cy  = chartH - (pi + 0.5) * rowH;
    const rad = 5 + bub.size * 16;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle   = bub.isBuy ? 'rgba(248,190,60,0.70)' : 'rgba(215,75,95,0.70)';
    ctx.strokeStyle = bub.isBuy ? 'rgba(255,218,95,0.90)' : 'rgba(255,105,125,0.90)';
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
  });

  // ── Right Y-axis ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#060b10';
  ctx.fillRect(chartW, 0, YAXIS_W, chartH);
  ctx.fillStyle = '#172030';
  ctx.fillRect(chartW, 0, 1, chartH);

  const volByPrice = new Map<number, number>();
  cells.forEach(c => volByPrice.set(c.price, (volByPrice.get(c.price) ?? 0) + c.volume));

  const pStep = Math.max(1, Math.round(prices.length / Math.floor(chartH / 26)));
  ctx.textAlign = 'left';

  prices.forEach((price, pi) => {
    const y = chartH - (pi + 0.5) * rowH;
    ctx.fillStyle = '#172030';
    ctx.fillRect(chartW, Math.round(y), 4, 1);

    if (pi % pStep !== 0) return;

    const vol = volByPrice.get(price) ?? 0;
    if (vol > 0) {
      const vLabel = vol >= 1000 ? (vol / 1000).toFixed(1) + 'k' : vol.toFixed(1);
      ctx.fillStyle = '#243a4a';
      ctx.font = '8px "Courier New", monospace';
      ctx.fillText(vLabel, chartW + 4, y - 1);
    }

    ctx.fillStyle = '#4878a0';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(price.toLocaleString() + '.0', chartW + 4, y + 10);
  });

  // Current price box (grey, like reference)
  if (priceLine.length > 0) {
    const ly   = priceLine[priceLine.length - 1].y;
    const boxH = 16;
    ctx.fillStyle   = '#1c2c3c';
    ctx.strokeStyle = '#2a4a6a';
    ctx.lineWidth   = 0.5;
    ctx.fillRect  (chartW, ly - boxH / 2, YAXIS_W - 1, boxH);
    ctx.strokeRect(chartW, ly - boxH / 2, YAXIS_W - 1, boxH);
    ctx.fillStyle = '#88c0e0';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(midPrice.toLocaleString() + '.0', chartW + 5, ly + 3);
  }

  // ── Bottom X-axis ────────────────────────────────────────────────────────
  ctx.fillStyle = '#060a0e';
  ctx.fillRect(0, chartH, chartW, XAXIS_H);
  ctx.fillStyle = '#172030';
  ctx.fillRect(0, chartH, chartW, 1);

  const tStep = Math.max(1, Math.round(times.length / Math.floor(chartW / 55)));
  ctx.font = '9px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2e4a62';
  times.forEach((t, ti) => {
    if (ti % tStep !== 0) return;
    const d = new Date(t);
    ctx.fillText(
      d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'),
      (ti + 0.5) * colW,
      chartH + 15,
    );
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeatmapDOMDashboard() {
  const [settings, setSettings] = useState<HeatmapSettings>({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    priceGrouping: 10,
    timeAggregation: '5m',
    profileType: 'visible-range',
    showBuySell: true,
    showImbalance: false,
  });

  const [heatmapData,  setHeatmapData ] = useState<HeatmapCell[]>([]);
  const [bubbles,      setBubbles     ] = useState<Bubble[]>([]);
  const [loading,      setLoading     ] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);

  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; cell: HeatmapCell } | null>(null);

  const getTimeMs = (agg: string) =>
    ({ '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000 }[agg] ?? 300000);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const generateHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const connector = createExchangeConnector({ name: settings.exchange } as ExchangeConfig);
      await connector.connect();
      const trades: Trade[] = await connector.getTrades(settings.symbol, 1000);
      connector.disconnect();

      if (!trades.length) { setHeatmapData([]); setBubbles([]); return; }

      const pStep = settings.priceGrouping;
      const tStep = getTimeMs(settings.timeAggregation);
      const grouped = new Map<string, HeatmapCell>();

      trades.forEach(trade => {
        const gP  = Math.floor(trade.price      / pStep) * pStep;
        const gT  = Math.floor(trade.timestamp  / tStep) * tStep;
        const key = `${gP}-${gT}`;
        const e   = grouped.get(key) ?? {
          id: key, price: gP, time: gT,
          volume: 0, buyVolume: 0, sellVolume: 0, imbalance: 0.5,
        };
        e.volume += trade.quantity;
        if (trade.side === 'buy') e.buyVolume += trade.quantity;
        else e.sellVolume += trade.quantity;
        const tot = e.buyVolume + e.sellVolume;
        e.imbalance = tot > 0 ? e.buyVolume / tot : 0.5;
        grouped.set(key, e);
      });

      const data = Array.from(grouped.values()).sort((a, b) => a.time - b.time);
      setHeatmapData(data);

      const sorted = [...data].sort((a, b) => b.volume - a.volume);
      const thresh = sorted[Math.floor(sorted.length * 0.03)]?.volume ?? Infinity;
      setBubbles(
        data
          .filter(c => c.volume >= thresh)
          .map(c => ({
            time: c.time, price: c.price,
            size: Math.min(c.volume / sorted[0].volume, 1),
            isBuy: c.buyVolume >= c.sellVolume,
          }))
      );
    } catch (err) {
      console.error('Heatmap error:', err);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => { generateHeatmap(); }, []);

  // ── Paint ──────────────────────────────────────────────────────────────────
  const maxVolume = heatmapData.length ? Math.max(...heatmapData.map(d => d.volume)) : 1;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    drawHeatmap(canvas, heatmapData, bubbles, maxVolume, settings.showImbalance);
  }, [heatmapData, bubbles, maxVolume, settings.showImbalance]);

  useEffect(() => { paint(); }, [paint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint]);

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!heatmapData.length) return;
    const rect    = canvasRef.current!.getBoundingClientRect();
    const mx      = e.clientX - rect.left;
    const my      = e.clientY - rect.top;
    const YAXIS_W = 86;
    const XAXIS_H = 22;
    const chartW  = rect.width  - YAXIS_W;
    const chartH  = rect.height - XAXIS_H;
    if (mx > chartW || my > chartH) { setTooltipData(null); return; }

    const times  = [...new Set(heatmapData.map(c => c.time ))].sort((a, b) => a - b);
    const prices = [...new Set(heatmapData.map(c => c.price))].sort((a, b) => a - b);
    const colW   = chartW / times.length;
    const rowH   = Math.max(1, chartH / prices.length);

    const ti = Math.floor(mx / colW);
    const pi = prices.length - 1 - Math.floor(my / rowH);
    const t  = times[ti];
    const p  = prices[pi];
    if (t === undefined || p === undefined) { setTooltipData(null); return; }

    const cell = heatmapData.find(c => c.time === t && c.price === p);
    if (!cell) { setTooltipData(null); return; }
    setTooltipData({
      x: mx + 14 + 150 > rect.width ? mx - 154 : mx + 14,
      y: Math.max(my - 10, 0),
      cell,
    });
  }, [heatmapData]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalVol = heatmapData.reduce((s, d) => s + d.volume, 0);
  const avgBuy   = heatmapData.reduce((s, d) => s + d.buyVolume,  0) / Math.max(heatmapData.length, 1);
  const avgSell  = heatmapData.reduce((s, d) => s + d.sellVolume, 0) / Math.max(heatmapData.length, 1);
  const pMin     = heatmapData.length ? Math.min(...heatmapData.map(d => d.price)) : 0;
  const pMax     = heatmapData.length ? Math.max(...heatmapData.map(d => d.price)) : 0;

  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  return (
    <div style={{ ...mono, width: '100%', height: '100%', minHeight: 600, background: '#050809', color: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: '#07090d', borderBottom: '1px solid #111a24', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: '#20b870' }}>◆</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ccd8e0', letterSpacing: '0.05em' }}>{settings.symbol} PERP</span>
        {[settings.timeAggregation, '5x'].map(b => (
          <span key={b} style={{ fontSize: 9, color: '#3a5a72', background: '#0c1520', border: '1px solid #182535', borderRadius: 3, padding: '1px 6px' }}>{b}</span>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[
            { node: <Settings  style={{ width: 12, height: 12 }} />, fn: () => setShowSettings(s => !s) },
            { node: <RefreshCw style={{ width: 12, height: 12 }} className={loading ? 'animate-spin' : ''} />, fn: generateHeatmap, dis: loading },
            { node: <Download  style={{ width: 12, height: 12 }} />, fn: () => {} },
          ].map((btn, i) => (
            <button key={i} onClick={btn.fn} disabled={btn.dis}
              style={{ padding: 4, borderRadius: 3, background: '#0c1520', border: '1px solid #182535', color: '#3a5a72', cursor: 'pointer', opacity: btn.dis ? 0.4 : 1 }}>
              {btn.node}
            </button>
          ))}
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '10px 14px', background: '#07090d', borderBottom: '1px solid #111a24', flexShrink: 0 }}>
          {[
            { label: 'Exchange',      type: 'select', key: 'exchange',        opts: ['binance','bybit','hyperliquid','okx'] },
            { label: 'Symbol',        type: 'text',   key: 'symbol' },
            { label: 'Price Grp ($)', type: 'number', key: 'priceGrouping' },
            { label: 'Time Agg',      type: 'select', key: 'timeAggregation', opts: ['1m','5m','15m','1h'] },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 9, color: '#2a4050', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
              {f.type === 'select' ? (
                <select value={(settings as any)[f.key]} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                  style={{ width: '100%', background: '#0c1520', border: '1px solid #182535', borderRadius: 3, padding: '3px 6px', fontSize: 11, color: '#8ab0c8', ...mono }}>
                  {f.opts!.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} value={(settings as any)[f.key]}
                  onChange={e => setSettings({ ...settings, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                  style={{ width: '100%', background: '#0c1520', border: '1px solid #182535', borderRadius: 3, padding: '3px 6px', fontSize: 11, color: '#8ab0c8', ...mono }} />
              )}
            </div>
          ))}
          {[
            { key: 'showImbalance', label: 'Imbalance mode' },
            { key: 'showBuySell',   label: 'Buy/Sell split' },
          ].map(f => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', alignSelf: 'end', paddingBottom: 2 }}>
              <input type="checkbox" checked={(settings as any)[f.key]}
                onChange={e => setSettings({ ...settings, [f.key]: e.target.checked })} />
              <span style={{ fontSize: 11, color: '#4a6a82' }}>{f.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* ── Canvas area ── */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 400 }}>
        {heatmapData.length > 0 ? (
          <>
            <canvas ref={canvasRef}
              style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', imageRendering: 'pixelated' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltipData(null)}
            />

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 28, left: 8, display: 'flex', gap: 12, fontSize: 9, color: '#2a4050', ...mono }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, background: '#0a5030', borderRadius: 1, display: 'inline-block' }} />Bid
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, background: '#5a1015', borderRadius: 1, display: 'inline-block' }} />Ask
              </span>
            </div>

            {/* Tooltip */}
            {tooltipData && (
              <div style={{
                position: 'absolute', left: tooltipData.x, top: tooltipData.y,
                background: 'rgba(3,6,10,0.96)', border: '1px solid #1a3040', borderRadius: 3,
                padding: '6px 10px', fontSize: 10, lineHeight: 1.8, whiteSpace: 'nowrap',
                pointerEvents: 'none', zIndex: 20, ...mono,
              }}>
                <div style={{ color: '#2a4a60', marginBottom: 3 }}>{new Date(tooltipData.cell.time).toLocaleTimeString()}</div>
                <div>Price:  <span style={{ color: '#c8dce8' }}>${tooltipData.cell.price.toLocaleString()}</span></div>
                <div>Volume: <span style={{ color: '#c89030' }}>{tooltipData.cell.volume.toFixed(4)}</span></div>
                <div>Buy:    <span style={{ color: '#18c870' }}>{tooltipData.cell.buyVolume.toFixed(4)}</span></div>
                <div>Sell:   <span style={{ color: '#d84050' }}>{tooltipData.cell.sellVolume.toFixed(4)}</span></div>
                <div>Imbal:  <span style={{ color: '#c8c030' }}>{(tooltipData.cell.imbalance * 100).toFixed(1)}%</span></div>
              </div>
            )}
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a3040', fontSize: 12, ...mono }}>
            {loading
              ? <><RefreshCw style={{ width: 12, height: 12, marginRight: 8 }} className="animate-spin" />Loading heatmap…</>
              : 'No data — press refresh'}
          </div>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid #111a24', background: '#050809', flexShrink: 0 }}>
        {[
          { label: 'Total Volume', value: totalVol >= 1000 ? (totalVol/1000).toFixed(1)+'k' : totalVol.toFixed(2), color: '#18c870' },
          { label: 'Avg Buy',      value: avgBuy.toFixed(4),  color: '#14a858' },
          { label: 'Avg Sell',     value: avgSell.toFixed(4), color: '#d84050' },
          { label: 'Price Range',  value: heatmapData.length ? `$${pMin}–$${pMax}` : '—', color: '#3a80b0' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '6px 14px', borderRight: '1px solid #111a24' }}>
            <div style={{ fontSize: 9, color: '#1e3040', textTransform: 'uppercase', letterSpacing: '0.06em', ...mono }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2, ...mono }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}