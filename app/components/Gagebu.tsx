"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";

type EntryType = "income" | "expense";

interface Entry {
  id: number;
  date: string;
  desc: string;
  amount: number;
  type: EntryType;
  category: string;
}

const CATEGORIES: Record<EntryType, string[]> = {
  income: ["급여", "부업", "용돈", "기타"],
  expense: ["식비", "교통", "쇼핑", "의료", "문화", "주거", "기타"],
};

function fmt(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toYYYYMM(date: string) {
  return date.slice(0, 7);
}

const EMPTY_FORM = {
  date: today(),
  desc: "",
  amount: "",
  type: "expense" as EntryType,
  category: "식비",
};

export default function Gagebu() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7));
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedDark = localStorage.getItem("gagebu_dark") === "true";
    setDark(savedDark);
    document.documentElement.classList.toggle("dark", savedDark);

    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("date", { ascending: false });
    if (!error && data) {
      setEntries(
        data.map((r) => ({
          id: r.id,
          date: r.date,
          desc: r.description,
          amount: r.amount,
          type: r.type as EntryType,
          category: r.category,
        }))
      );
    }
    setLoading(false);
  }

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("gagebu_dark", String(next));
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "type") {
        next.category = CATEGORIES[value as EntryType][0];
      }
      return next;
    });
  }

  async function submitForm() {
    const num = parseInt(form.amount);
    if (!form.date || !form.desc.trim() || !num || num <= 0) {
      alert("날짜, 내역, 금액을 올바르게 입력해주세요.");
      return;
    }
    if (editId !== null) {
      const { error } = await supabase
        .from("entries")
        .update({
          date: form.date,
          description: form.desc,
          amount: num,
          type: form.type,
          category: form.category,
        })
        .eq("id", editId);
      if (error) { alert("수정 실패: " + error.message); return; }
      setEditId(null);
    } else {
      const { error } = await supabase.from("entries").insert({
        date: form.date,
        description: form.desc,
        amount: num,
        type: form.type,
        category: form.category,
      });
      if (error) { alert("추가 실패: " + error.message); return; }
    }
    setForm(EMPTY_FORM);
    await loadEntries();
  }

  function startEdit(e: Entry) {
    setEditId(e.id);
    setForm({ date: e.date, desc: e.desc, amount: String(e.amount), type: e.type, category: e.category });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  async function deleteEntry(id: number) {
    if (!confirm("삭제할까요?")) return;
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await loadEntries();
  }

  function exportCSV() {
    const header = "날짜,내역,카테고리,유형,금액";
    const rows = entries
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => `${e.date},${e.desc},${e.category},${e.type === "income" ? "수입" : "지출"},${e.amount}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `가계부_${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => toYYYYMM(e.date)));
    set.add(today().slice(0, 7));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => toYYYYMM(e.date) === filterMonth)
      .filter((e) =>
        search === "" || e.desc.includes(search) || e.category.includes(search)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, filterMonth, search]);

  const totalIncome  = filtered.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpense = filtered.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const chartData = useMemo(() => {
    const map: Record<string, { month: string; 수입: number; 지출: number }> = {};
    entries.forEach((e) => {
      const m = toYYYYMM(e.date);
      if (!map[m]) map[m] = { month: m.slice(5) + "월", 수입: 0, 지출: 0 };
      if (e.type === "income") map[m].수입 += e.amount;
      else map[m].지출 += e.amount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [entries]);

  const inputCls = "flex-1 border rounded px-3 py-2 text-sm focus:outline-none bg-[#1a1710] border-[#c9a84c]/30 focus:border-[#c9a84c] text-[#f0e6c8] placeholder-[#6b5f3e]";
  const cardCls  = "bg-[#12110e] border border-[#c9a84c]/20 rounded-sm shadow-lg p-5";

  return (
    <div className="min-h-screen py-10 px-4 transition-colors" style={{ background: "linear-gradient(135deg, #0a0906 0%, #13110c 50%, #0f0d09 100%)" }}>

      {/* 헤더 */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-8">
        <div>
          <p className="text-[#c9a84c] text-xs tracking-[0.3em] uppercase mb-1">Maison Privée</p>
          <h1 className="text-3xl font-light tracking-widest text-[#f0e6c8]">가계부</h1>
        </div>
        <button
          onClick={toggleDark}
          className="w-10 h-10 border border-[#c9a84c]/40 hover:border-[#c9a84c] flex items-center justify-center text-lg transition-colors text-[#c9a84c]"
          title="테마 전환"
        >
          {dark ? "○" : "●"}
        </button>
      </div>

      {/* 구분선 */}
      <div className="max-w-2xl mx-auto mb-8 flex items-center gap-3">
        <div className="flex-1 h-px bg-[#c9a84c]/20" />
        <span className="text-[#c9a84c]/50 text-xs tracking-widest">✦</span>
        <div className="flex-1 h-px bg-[#c9a84c]/20" />
      </div>

      {/* 입력 / 수정 폼 */}
      <div className={`${cardCls} max-w-2xl mx-auto mb-6`}>
        <h2 className="text-xs tracking-[0.2em] uppercase text-[#c9a84c]/70 mb-4">
          {editId !== null ? "Edit Entry" : "New Entry"}
        </h2>
        <div className="flex flex-wrap gap-3">
          <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} className={inputCls} />
          <input type="text" value={form.desc} onChange={(e) => setField("desc", e.target.value)} placeholder="내역" className={inputCls} />
          <input type="number" value={form.amount} onChange={(e) => setField("amount", e.target.value)} placeholder="금액" min={0} className={inputCls} />
          <select value={form.type} onChange={(e) => setField("type", e.target.value as EntryType)} className={inputCls} style={{ flex: "none" }}>
            <option value="income">수입</option>
            <option value="expense">지출</option>
          </select>
          <select value={form.category} onChange={(e) => setField("category", e.target.value)} className={inputCls} style={{ flex: "none" }}>
            {CATEGORIES[form.type].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={submitForm} className="border border-[#c9a84c] text-[#c9a84c] hover:bg-[#c9a84c] hover:text-[#0a0906] font-light tracking-widest px-6 py-2 text-sm transition-all">
            {editId !== null ? "CONFIRM" : "ADD"}
          </button>
          {editId !== null && (
            <button onClick={cancelEdit} className="border border-[#6b5f3e] text-[#6b5f3e] hover:border-[#c9a84c]/50 px-6 py-2 text-sm tracking-widest transition-all">
              CANCEL
            </button>
          )}
        </div>
      </div>

      {/* 월 필터 + 검색 + CSV */}
      <div className="max-w-2xl mx-auto mb-4 flex gap-3 flex-wrap">
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={inputCls} style={{ flex: "none" }}>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색" className={inputCls} />
        <button onClick={exportCSV} className="border border-[#c9a84c]/40 hover:border-[#c9a84c] text-[#c9a84c]/70 hover:text-[#c9a84c] px-4 py-2 text-xs tracking-widest transition-all">
          EXPORT
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
        {[
          { label: "INCOME", value: fmt(totalIncome), color: "text-[#7ec8a0]" },
          { label: "EXPENSE", value: fmt(totalExpense), color: "text-[#c87e7e]" },
          { label: "BALANCE", value: fmt(balance), color: balance >= 0 ? "text-[#c9a84c]" : "text-[#c87e7e]" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${cardCls} text-center`}>
            <p className="text-xs tracking-[0.2em] text-[#c9a84c]/50 mb-2">{label}</p>
            <p className={`text-lg font-light ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 월별 차트 */}
      {chartData.length > 0 && (
        <div className={`${cardCls} max-w-2xl mx-auto mb-6`}>
          <h2 className="text-xs tracking-[0.2em] uppercase text-[#c9a84c]/70 mb-4">Monthly Overview</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b5f3e" }} axisLine={{ stroke: "#c9a84c22" }} tickLine={false} />
              <YAxis tickFormatter={(v) => (v / 10000).toFixed(0) + "만"} tick={{ fontSize: 10, fill: "#6b5f3e" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => fmt(Number(v))}
                contentStyle={{ background: "#12110e", border: "1px solid #c9a84c33", borderRadius: 0, color: "#f0e6c8", fontSize: 12 }}
                cursor={{ fill: "#c9a84c08" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#6b5f3e" }} />
              <Bar dataKey="수입" fill="#7ec8a0" radius={[2, 2, 0, 0]} />
              <Bar dataKey="지출" fill="#c87e7e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 거래 내역 */}
      <div className={`${cardCls} max-w-2xl mx-auto`}>
        <h2 className="text-xs tracking-[0.2em] uppercase text-[#c9a84c]/70 mb-4">
          Transactions{filtered.length > 0 && <span className="text-[#6b5f3e] normal-case tracking-normal font-normal"> · {filtered.length}건</span>}
        </h2>
        {loading ? (
          <p className="text-center text-[#3d3527] py-10 text-sm tracking-widest">— LOADING —</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[#3d3527] py-10 text-sm tracking-widest">— NO RECORDS —</p>
        ) : (
          <ul>
            {filtered.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3 border-b border-[#c9a84c]/10 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.type === "income" ? "bg-[#7ec8a0]" : "bg-[#c87e7e]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#d4c49a] truncate font-light">{e.desc}</p>
                  <p className="text-xs text-[#6b5f3e]">{e.category}</p>
                </div>
                <span className="text-xs text-[#4a4030] flex-shrink-0">{e.date}</span>
                <span className={`text-sm font-light flex-shrink-0 ${e.type === "income" ? "text-[#7ec8a0]" : "text-[#c87e7e]"}`}>
                  {e.type === "income" ? "+" : "−"}{fmt(e.amount)}
                </span>
                <button onClick={() => startEdit(e)} className="text-[#4a4030] hover:text-[#c9a84c] text-xs transition-colors px-1">✎</button>
                <button onClick={() => deleteEntry(e.id)} className="text-[#4a4030] hover:text-[#c87e7e] text-xs transition-colors px-1">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 하단 장식 */}
      <div className="max-w-2xl mx-auto mt-8 flex items-center gap-3">
        <div className="flex-1 h-px bg-[#c9a84c]/10" />
        <span className="text-[#c9a84c]/20 text-xs tracking-widest">✦</span>
        <div className="flex-1 h-px bg-[#c9a84c]/10" />
      </div>
    </div>
  );
}
