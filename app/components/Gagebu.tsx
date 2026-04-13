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

  useEffect(() => {
    const saved = localStorage.getItem("gagebu_v2");
    if (saved) setEntries(JSON.parse(saved));

    const savedDark = localStorage.getItem("gagebu_dark") === "true";
    setDark(savedDark);
    document.documentElement.classList.toggle("dark", savedDark);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("gagebu_dark", String(next));
  }

  function save(next: Entry[]) {
    setEntries(next);
    localStorage.setItem("gagebu_v2", JSON.stringify(next));
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

  function submitForm() {
    const num = parseInt(form.amount);
    if (!form.date || !form.desc.trim() || !num || num <= 0) {
      alert("날짜, 내역, 금액을 올바르게 입력해주세요.");
      return;
    }
    if (editId !== null) {
      save(entries.map((e) => e.id === editId ? { ...e, ...form, amount: num } : e));
      setEditId(null);
    } else {
      save([...entries, { id: Date.now(), ...form, amount: num }]);
    }
    setForm(EMPTY_FORM);
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

  function deleteEntry(id: number) {
    if (!confirm("삭제할까요?")) return;
    save(entries.filter((e) => e.id !== id));
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

  // 공통 input/select 스타일
  const inputCls = "flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100";
  const cardCls  = "bg-white dark:bg-gray-800 rounded-xl shadow p-5";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4 transition-colors">

      {/* 헤더 */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">가계부</h1>
        <button
          onClick={toggleDark}
          className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow flex items-center justify-center text-xl transition-colors"
          title="다크모드 전환"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* 입력 / 수정 폼 */}
      <div className={`${cardCls} max-w-2xl mx-auto mb-6`}>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          {editId !== null ? "✏️ 내역 수정" : "내역 추가"}
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
        <div className="flex gap-2 mt-3">
          <button onClick={submitForm} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
            {editId !== null ? "수정 완료" : "추가"}
          </button>
          {editId !== null && (
            <button onClick={cancelEdit} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
              취소
            </button>
          )}
        </div>
      </div>

      {/* 월 필터 + 검색 + CSV */}
      <div className="max-w-2xl mx-auto mb-4 flex gap-3 flex-wrap">
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={inputCls} style={{ flex: "none" }}>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색 (내역, 카테고리)" className={inputCls} />
        <button onClick={exportCSV} className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          CSV 저장
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
        <div className={`${cardCls} text-center`}>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">수입</p>
          <p className="text-xl font-bold text-green-500">{fmt(totalIncome)}</p>
        </div>
        <div className={`${cardCls} text-center`}>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">지출</p>
          <p className="text-xl font-bold text-red-500">{fmt(totalExpense)}</p>
        </div>
        <div className={`${cardCls} text-center`}>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">잔액</p>
          <p className={`text-xl font-bold ${balance >= 0 ? "text-blue-500" : "text-red-500"}`}>{fmt(balance)}</p>
        </div>
      </div>

      {/* 월별 차트 */}
      {chartData.length > 0 && (
        <div className={`${cardCls} max-w-2xl mx-auto mb-6`}>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">월별 수입 / 지출</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: dark ? "#9ca3af" : "#6b7280" }} />
              <YAxis tickFormatter={(v) => (v / 10000).toFixed(0) + "만"} tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }} />
              <Tooltip
                formatter={(v) => fmt(Number(v))}
                contentStyle={{ background: dark ? "#1f2937" : "#fff", border: "none", borderRadius: 8, color: dark ? "#f3f4f6" : "#111" }}
              />
              <Legend />
              <Bar dataKey="수입" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="지출" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 거래 내역 */}
      <div className={`${cardCls} max-w-2xl mx-auto`}>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">
          거래 내역{filtered.length > 0 && <span className="text-gray-300 dark:text-gray-600 font-normal"> ({filtered.length}건)</span>}
        </h2>
        {filtered.length === 0 ? (
          <p className="text-center text-gray-300 dark:text-gray-600 py-10">내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${e.type === "income" ? "bg-green-400" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{e.desc}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{e.category}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{e.date}</span>
                <span className={`text-sm font-bold flex-shrink-0 ${e.type === "income" ? "text-green-500" : "text-red-500"}`}>
                  {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                </span>
                <button onClick={() => startEdit(e)} className="text-gray-300 hover:text-blue-400 text-sm transition-colors px-1">✏️</button>
                <button onClick={() => deleteEntry(e.id)} className="text-gray-300 hover:text-red-400 text-sm transition-colors px-1">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
