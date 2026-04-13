"use client";

import { useState, useEffect } from "react";

type EntryType = "income" | "expense";

interface Entry {
  id: number;
  date: string;
  desc: string;
  amount: number;
  type: EntryType;
}

function fmt(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Gagebu() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<EntryType>("expense");

  useEffect(() => {
    const saved = localStorage.getItem("gagebu");
    if (saved) setEntries(JSON.parse(saved));
  }, []);

  function save(next: Entry[]) {
    setEntries(next);
    localStorage.setItem("gagebu", JSON.stringify(next));
  }

  function addEntry() {
    const num = parseInt(amount);
    if (!date || !desc.trim() || !num || num <= 0) {
      alert("날짜, 내역, 금액을 올바르게 입력해주세요.");
      return;
    }
    save([...entries, { id: Date.now(), date, desc: desc.trim(), amount: num, type }]);
    setDesc("");
    setAmount("");
  }

  function deleteEntry(id: number) {
    save(entries.filter((e) => e.id !== id));
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const totalIncome = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">가게부</h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <p className="text-sm text-gray-400 mb-1">총 수입</p>
          <p className="text-xl font-bold text-green-500">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <p className="text-sm text-gray-400 mb-1">총 지출</p>
          <p className="text-xl font-bold text-red-500">{fmt(totalExpense)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <p className="text-sm text-gray-400 mb-1">잔액</p>
          <p className={`text-xl font-bold ${balance >= 0 ? "text-blue-500" : "text-red-500"}`}>
            {fmt(balance)}
          </p>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white rounded-xl shadow p-5 max-w-2xl mx-auto mb-6 flex flex-wrap gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 min-w-[130px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="내역 (예: 점심식사)"
          className="flex-1 min-w-[150px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="금액"
          min={0}
          className="flex-1 min-w-[100px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EntryType)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="income">수입</option>
          <option value="expense">지출</option>
        </select>
        <button
          onClick={addEntry}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
        >
          추가
        </button>
      </div>

      {/* 거래 내역 */}
      <div className="bg-white rounded-xl shadow p-5 max-w-2xl mx-auto">
        <h2 className="text-sm font-semibold text-gray-500 mb-4">거래 내역</h2>

        {sorted.length === 0 ? (
          <p className="text-center text-gray-300 py-10">내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    e.type === "income" ? "bg-green-400" : "bg-red-400"
                  }`}
                />
                <span className="flex-1 text-sm text-gray-700">{e.desc}</span>
                <span className="text-xs text-gray-400">{e.date}</span>
                <span
                  className={`text-sm font-bold ${
                    e.type === "income" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                </span>
                <button
                  onClick={() => deleteEntry(e.id)}
                  className="text-gray-300 hover:text-red-400 text-base transition-colors px-1"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
