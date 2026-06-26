'use client';

import { useState } from 'react';
import { useCrawlStatus, useRefreshStatus } from './StatusProvider';

export default function ControlActions() {
  const status = useCrawlStatus();
  const refresh = useRefreshStatus();
  const [intervalInput, setIntervalInput] = useState('');
  const [roundsInput, setRoundsInput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  const flash = (text: string, type: 'ok' | 'err') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleStart = async () => {
    const res = await fetch('/api/crawl/start', { method: 'POST' });
    if (res.ok) {
      flash('已启动爬取', 'ok');
      refresh();
    } else {
      const data = await res.json();
      flash(data.error || '启动失败', 'err');
    }
  };

  const handlePause = async () => {
    const res = await fetch('/api/crawl/pause', { method: 'POST' });
    if (res.ok) {
      flash('已暂停爬取', 'ok');
      refresh();
    } else flash('暂停失败', 'err');
  };

  const handleSetInterval = async () => {
    const minutes = parseInt(intervalInput, 10);
    if (isNaN(minutes) || minutes < 3) {
      flash('间隔最少 3 分钟', 'err');
      return;
    }
    const res = await fetch('/api/crawl/interval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
    if (res.ok) { flash(`间隔已设为 ${minutes} 分钟`, 'ok'); refresh(); }
    else {
      const data = await res.json();
      flash(data.error || '设置失败', 'err');
    }
    setIntervalInput('');
  };

  const handleSetRounds = async () => {
    const maxRounds = roundsInput.trim() === '' ? null : parseInt(roundsInput, 10);
    if (maxRounds !== null && (isNaN(maxRounds) || maxRounds < 1)) {
      flash('轮次最少 1', 'err');
      return;
    }
    const res = await fetch('/api/crawl/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_rounds: maxRounds }),
    });
    if (res.ok) { flash(maxRounds ? `最多 ${maxRounds} 轮` : '已设为持续运行', 'ok'); refresh(); }
    else flash('设置失败', 'err');
    setRoundsInput('');
  };

  const handleLogin = async () => {
    const res = await fetch('/api/crawl/login', { method: 'POST' });
    if (res.status === 409) {
      flash('登录已在进行中', 'err');
    } else if (res.ok) {
      flash('登录流程已启动，请在浏览器窗口中操作', 'ok');
      refresh();
    } else {
      flash('启动登录失败', 'err');
    }
  };

  if (!status) {
    return <div className="text-center py-8 text-muted">加载中…</div>;
  }

  const isRunning = status.running && !status.paused;
  const isCrawling = status.crawling_now;

  return (
    <div className="space-y-4">
      {/* Flash message */}
      {message && (
        <div className={`px-3 py-2 rounded text-sm font-medium ${
          message.type === 'ok' ? 'bg-mint/10 text-mint' : 'bg-signal/10 text-signal'
        }`}>
          {message.text}
        </div>
      )}

      {/* Start / Pause */}
      <div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={isCrawling}
              className="px-5 py-2 text-sm font-medium bg-mint text-white rounded-md hover:bg-mint/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCrawling ? '爬取中…' : '开始监控'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-5 py-2 text-sm font-medium bg-signal text-white rounded-md hover:bg-signal/90 transition-colors"
            >
              暂停监控
            </button>
          )}

          <button
            onClick={handleLogin}
            disabled={status.login_in_progress}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md text-ink hover:border-gold hover:text-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status.login_in_progress ? '登录中…' : '登录闲鱼'}
          </button>
        </div>
        {/* Keyword hints */}
        {!isRunning && status.keywords.length === 0 && (
          <div className="text-xs text-signal mt-1.5">请先添加关键词</div>
        )}
        {!isRunning && status.keywords.length > 0 && status.selected_keywords.length === 0 && status.last_round_keywords.length === 0 && (
          <div className="text-xs text-gold mt-1.5">提示：未选择关键词，将使用全部词库</div>
        )}
        {!isRunning && status.selected_keywords.length === 0 && status.last_round_keywords.length > 0 && (
          <div className="text-xs text-muted mt-1.5">将使用上一轮的关键词 ({status.last_round_keywords.length} 个)</div>
        )}
      </div>

      {/* Interval */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted whitespace-nowrap">爬取间隔</label>
        <input
          type="number"
          value={intervalInput}
          onChange={e => setIntervalInput(e.target.value)}
          placeholder={`${status.interval} 分钟`}
          min={3}
          className="w-24 px-2 py-1 text-sm border border-border rounded-md bg-card text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
        />
        <button
          onClick={handleSetInterval}
          className="px-3 py-1 text-xs font-medium bg-ink/[0.06] rounded-md hover:bg-ink/[0.10] transition-colors"
        >
          设置
        </button>
      </div>

      {/* Max rounds */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted whitespace-nowrap">最大轮次</label>
        <input
          type="number"
          value={roundsInput}
          onChange={e => setRoundsInput(e.target.value)}
          placeholder={status.max_rounds ? `${status.max_rounds} 轮` : '持续运行'}
          min={1}
          className="w-24 px-2 py-1 text-sm border border-border rounded-md bg-card text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold"
        />
        <button
          onClick={handleSetRounds}
          className="px-3 py-1 text-xs font-medium bg-ink/[0.06] rounded-md hover:bg-ink/[0.10] transition-colors"
        >
          设置
        </button>
        <span className="text-xs text-muted">
          当前: {status.max_rounds ? `${status.max_rounds} 轮` : '持续'} | 已完成: {status.completed_rounds} 轮
        </span>
      </div>

      {/* Status readouts */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-3 rounded-md bg-ink/[0.02]">
          <div className="text-xs text-muted mb-1">爬取状态</div>
          <div className="text-sm font-medium">
            {isCrawling ? (
              <span className="text-gold">● 爬取中</span>
            ) : isRunning ? (
              <span className="text-mint">● 运行中</span>
            ) : (
              <span className="text-muted">○ 已暂停</span>
            )}
          </div>
        </div>
        <div className="p-3 rounded-md bg-ink/[0.02]">
          <div className="text-xs text-muted mb-1">登录状态</div>
          <div className="text-sm font-medium">
            {status.login_in_progress ? (
              <span className="text-gold">● 登录中</span>
            ) : status.has_cookies ? (
              <span className="text-mint">● 已登录</span>
            ) : (
              <span className="text-signal">○ 未登录</span>
            )}
          </div>
        </div>
        <div className="p-3 rounded-md bg-ink/[0.02]">
          <div className="text-xs text-muted mb-1">上次爬取</div>
          <div className="text-sm text-ink">
            {status.last_crawl_time || '—'}
          </div>
        </div>
        <div className="p-3 rounded-md bg-ink/[0.02]">
          <div className="text-xs text-muted mb-1">下次爬取</div>
          <div className="text-sm text-ink">
            {status.next_crawl_time || '—'}
          </div>
        </div>
      </div>

      {/* Last crawl summary */}
      {status.last_crawl_summary && (
        <div className="p-3 rounded-md bg-gold/[0.04] border border-gold/10">
          <div className="text-xs text-muted mb-1">最近结果</div>
          <div className="text-sm text-ink">{status.last_crawl_summary}</div>
        </div>
      )}
    </div>
  );
}
