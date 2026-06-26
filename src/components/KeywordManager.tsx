'use client';

import { useState } from 'react';
import type { KeywordEntry } from '@/lib/types';

interface KeywordManagerProps {
  keywords: KeywordEntry[];
  selectedKeywords: KeywordEntry[];
  onUpdate: (keywords: KeywordEntry[]) => void;
  onSelect: (selected: KeywordEntry[]) => void;
}

export default function KeywordManager({ keywords, selectedKeywords, onUpdate, onSelect }: KeywordManagerProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const selectedSet = new Set(selectedKeywords.map(k => k.keyword));

  const isSelected = (kw: KeywordEntry) => selectedSet.has(kw.keyword);

  const toggleSelect = (kw: KeywordEntry) => {
    if (isSelected(kw)) {
      onSelect(selectedKeywords.filter(k => k.keyword !== kw.keyword));
    } else {
      onSelect([...selectedKeywords, kw]);
    }
  };

  const selectAll = () => {
    onSelect([...keywords]);
  };

  const clearSelection = () => {
    onSelect([]);
  };

  const handleAdd = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    const cat = newCategory.trim() || '未分类';
    onUpdate([...keywords, { keyword: kw, category: cat }]);
    setNewKeyword('');
    setNewCategory('');
    setShowAdd(false);
  };

  const handleRemove = (idx: number) => {
    const removed = keywords[idx];
    onUpdate(keywords.filter((_, i) => i !== idx));
    // Also deselect if selected
    if (removed && isSelected(removed)) {
      onSelect(selectedKeywords.filter(k => k.keyword !== removed.keyword));
    }
    if (editingIdx === idx) setEditingIdx(null);
  };

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditCategory(keywords[idx].category);
  };

  const handleSaveEdit = (idx: number) => {
    const updated = [...keywords];
    updated[idx] = { ...updated[idx], category: editCategory.trim() || '未分类' };
    onUpdate(updated);
    // Also update selection if this keyword is selected
    if (isSelected(updated[idx])) {
      onSelect(selectedKeywords.map(k => k.keyword === updated[idx].keyword ? updated[idx] : k));
    }
    setEditingIdx(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setShowAdd(false); setEditingIdx(null); }
  };

  const existingCategories = [...new Set(keywords.map(k => k.category))].filter(Boolean);

  // Group keywords by category
  const grouped: Record<string, KeywordEntry[]> = {};
  for (const kw of keywords) {
    const cat = kw.category || '未分类';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(kw);
  }

  return (
    <div>
      {/* Selection summary */}
      {keywords.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className="text-muted">
            已选 <span className="font-medium text-ink">{selectedKeywords.length}</span>/{keywords.length} 个关键词
          </span>
          <button
            onClick={selectAll}
            className="px-2 py-0.5 text-xs border border-border rounded hover:border-gold hover:text-gold transition-colors"
          >
            全选
          </button>
          <button
            onClick={clearSelection}
            className="px-2 py-0.5 text-xs border border-border rounded hover:border-signal hover:text-signal transition-colors"
          >
            清空
          </button>
        </div>
      )}

      {/* Add button / form */}
      {showAdd ? (
        <div className="mb-3 p-2.5 rounded-md bg-ink/[0.02] border border-border space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="关键词"
              className="flex-1 px-2 py-1 text-sm border border-border rounded bg-card text-ink placeholder:text-muted/60 focus:outline-none focus:border-gold"
              autoFocus
            />
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="分类"
              className="w-20 px-2 py-1 text-sm border border-border rounded bg-card text-ink placeholder:text-muted/60 focus:outline-none focus:border-gold"
            />
          </div>
          {existingCategories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {existingCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setNewCategory(cat)}
                  className="text-xs px-1.5 py-0.5 rounded border border-border hover:border-gold hover:text-gold transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1 text-xs font-medium bg-gold text-white rounded hover:bg-gold-dim transition-colors">添加</button>
            <button onClick={() => { setShowAdd(false); setNewKeyword(''); setNewCategory(''); }} className="px-3 py-1 text-xs text-muted hover:text-ink transition-colors">取消</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-3 px-3 py-1 text-xs font-medium border border-dashed border-muted/40 rounded-md text-muted hover:border-gold hover:text-gold transition-colors"
        >
          + 添加关键词
        </button>
      )}

      {/* Keywords grouped by category */}
      {keywords.length === 0 ? (
        <div className="text-center py-4 text-muted text-xs">暂无关键词</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, kws]) => (
            <div key={cat}>
              <div className="text-xs text-muted font-medium mb-1">{cat}</div>
              <div className="flex flex-wrap gap-1.5">
                {kws.map((kw) => {
                  const globalIdx = keywords.indexOf(kw);
                  const checked = isSelected(kw);
                  return (
                    <span
                      key={globalIdx}
                      className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        checked
                          ? 'bg-gold/10 text-ink ring-1 ring-gold/30'
                          : 'bg-ink/[0.04] text-ink hover:bg-ink/[0.08]'
                      }`}
                      onClick={() => toggleSelect(kw)}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[8px] leading-none ${
                        checked
                          ? 'bg-gold border-gold text-white'
                          : 'border-muted/40'
                      }`}>
                        {checked && '✓'}
                      </span>
                      {editingIdx === globalIdx ? (
                        <>
                          <input
                            type="text"
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEdit(globalIdx);
                              if (e.key === 'Escape') setEditingIdx(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-16 px-1 py-0 text-xs border border-border rounded bg-card focus:outline-none focus:border-gold"
                            autoFocus
                          />
                          <button
                            onClick={e => { e.stopPropagation(); handleSaveEdit(globalIdx); }}
                            className="text-mint hover:underline"
                          >
                            ✓
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{kw.keyword}</span>
                          <span
                            className="text-muted hover:text-gold"
                            onClick={e => { e.stopPropagation(); handleStartEdit(globalIdx); }}
                            title="编辑分类"
                          >
                            [{kw.category || '未分类'}]
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); handleRemove(globalIdx); }}
                            className="text-muted opacity-0 group-hover:opacity-100 hover:text-signal transition-opacity ml-0.5"
                            title="删除"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
