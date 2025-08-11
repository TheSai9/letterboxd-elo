import React, { useEffect, useState, useRef } from "react";
import Papa from "papaparse";

// Simple Letterboxd Elo Movie Ranker
// Single-file React component (default export) that:
// - Lets you upload a Letterboxd ratings.csv
// - Initializes Elo scores from your ratings
// - Presents pairwise matchups and updates Elo based on wins
// - Lets you add new movies from another CSV (merge)
// - View/export current rankings as CSV
// Note: Uses localStorage so your progress persists in-browser.

function ratingToInitialElo(rating) {
  // Letterboxd rating: usually values like 0.5,1,1.5,...,5 (or empty)
  // Map rating 0..5 -> Elo roughly 800..2400
  if (!rating || isNaN(rating)) return 1200;
  const r = parseFloat(rating);
  return Math.round(1200 + (r - 2.5) * 200); // center around 1200
}

function expectedScore(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function updateElo(eloA, eloB, scoreA, k = 32) {
  const expA = expectedScore(eloA, eloB);
  const expB = 1 - expA;
  const newA = eloA + k * (scoreA - expA);
  const newB = eloB + k * ((1 - scoreA) - expB);
  return [Math.round(newA), Math.round(newB)];
}

function csvEscapeCell(s) {
  if (s == null) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export default function App() {
  const [movies, setMovies] = useState(() => {
    try {
      const raw = localStorage.getItem("mb_movies");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem("mb_history");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const fileRef = useRef();

  useEffect(() => {
    localStorage.setItem("mb_movies", JSON.stringify(movies));
  }, [movies]);
  useEffect(() => {
    localStorage.setItem("mb_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (!left || !right) pickPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies]);

  function importRatingsCsv(file, merge = false) {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        // Detect typical Letterboxd column names.
        // Common export has: "Title", "Year", "Rating" (0-5) and maybe "Your Rating"
        const titleKeys = ["Title", "title", "Film", "Name"];
        const ratingKeys = ["Rating", "rating", "Your Rating", "your_rating"];
        const yearKeys = ["Year", "year", "Release Year"];

        const mapKey = (keys, row) => keys.find((k) => k in row) || null;

        const tKey = mapKey(titleKeys, rows[0] || {});
        const rKey = mapKey(ratingKeys, rows[0] || {});
        const yKey = mapKey(yearKeys, rows[0] || {});

        const parsed = rows.map((r) => {
          const title = (tKey && r[tKey]) || r[Object.keys(r)[0]] || "Unknown";
          const year = (yKey && r[yKey]) || "";
          const rawRating = r[rKey] || r["Rating"] || r["rating"] || "";
          const normalizedRating = rawRating === "" ? null : parseFloat(rawRating);
          const id = (title + "|" + year).trim();
          return {
            id,
            title: title.trim(),
            year: year && String(year).trim(),
            rating: normalizedRating,
            elo: ratingToInitialElo(normalizedRating),
            played: 0,
            wins: 0,
            losses: 0,
          };
        });

        setMessage(
          `Imported ${parsed.length} rows from CSV. ${merge ? "(merge mode)" : "(fresh import)"}`
        );

        setMovies((cur) => {
          if (!merge) return parsed;
          // merge - only add items that don't exist (by id)
          const existingIds = new Set(cur.map((m) => m.id));
          const toAdd = parsed.filter((p) => !existingIds.has(p.id));
          return [...cur, ...toAdd];
        });
      },
      error: (err) => {
        setMessage("CSV parse error: " + err.message);
      },
    });
  }

  function pickPair() {
    if (movies.length < 2) {
      setLeft(null);
      setRight(null);
      return;
    }
    // Strategy: prefer close Elo matches.
    // We'll try random sampling and choose a pair with small elo diff.
    const sampleSize = Math.min(200, movies.length * 2);
    const picks = [];
    for (let i = 0; i < sampleSize; i++) {
      const a = movies[Math.floor(Math.random() * movies.length)];
      const b = movies[Math.floor(Math.random() * movies.length)];
      if (!a || !b || a.id === b.id) continue;
      picks.push([a, b, Math.abs(a.elo - b.elo)]);
    }
    if (picks.length === 0) {
      const [a, b] = [movies[0], movies[1]];
      setLeft(a);
      setRight(b);
      return;
    }
    picks.sort((x, y) => x[2] - y[2]);
    const best = picks[0];
    setLeft(best[0]);
    setRight(best[1]);
  }

  function handleChoice(winnerId, loserId) {
    const a = movies.find((m) => m.id === winnerId);
    const b = movies.find((m) => m.id === loserId);
    if (!a || !b) return;
    const [newA, newB] = updateElo(a.elo, b.elo, 1);
    setMovies((cur) =>
      cur.map((m) => {
        if (m.id === a.id) return { ...m, elo: newA, played: m.played + 1, wins: m.wins + 1 };
        if (m.id === b.id) return { ...m, elo: newB, played: m.played + 1, losses: m.losses + 1 };
        return m;
      })
    );
    setHistory((h) => [
      { time: new Date().toISOString(), winner: a.id, loser: b.id, prevA: a.elo, prevB: b.elo, newA, newB },
      ...h,
    ]);
    pickPair();
  }

  function exportCsv() {
    if (movies.length === 0) return;
    const rows = [
      ["Title", "Year", "Rating", "Elo", "Played", "Wins", "Losses"],
      ...movies
        .slice()
        .sort((a, b) => b.elo - a.elo)
        .map((m) => [m.title, m.year || "", m.rating ?? "", m.elo, m.played, m.wins, m.losses]),
    ];
    const csv = rows.map((r) => r.map(csvEscapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "movie_rankings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    if (!confirm("Clear all stored movie data? This cannot be undone.")) return;
    setMovies([]);
    setHistory([]);
    localStorage.removeItem("mb_movies");
    localStorage.removeItem("mb_history");
    setMessage("Cleared data.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md p-6">
        <h1 className="text-2xl font-semibold mb-2">Letterboxd Elo Ranker</h1>
        <p className="text-sm text-slate-600 mb-4">
          Upload your Letterboxd <span className="font-mono">ratings.csv</span> (Account &gt; Settings
          &gt; Data &gt; Export). The app assigns starting Elo from your ratings and lets you create
          a custom ranking by choosing which movie is better in pairwise matchups.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="col-span-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => importRatingsCsv(e.target.files[0], false)}
              className="mb-2"
            />
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded bg-indigo-600 text-white"
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                Upload (replace)
              </button>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => importRatingsCsv(e.target.files[0], true)}
                className="hidden"
                id="mergefile"
              />
              <label htmlFor="mergefile" className="px-3 py-1 rounded bg-emerald-600 text-white cursor-pointer">
                Add new movies
              </label>
              <button onClick={exportCsv} className="px-3 py-1 rounded bg-slate-700 text-white">
                Export rankings (.csv)
              </button>
              <button onClick={resetAll} className="px-3 py-1 rounded bg-red-600 text-white">
                Reset all
              </button>
            </div>
            <div className="mt-2 text-sm text-slate-600">{message}</div>
          </div>

          <div className="bg-slate-50 p-3 rounded">
            <div className="text-sm">Movies tracked</div>
            <div className="text-2xl font-medium">{movies.length}</div>
            <div className="mt-2 text-xs text-slate-500">Progress: {history.length} matchups</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">Matchup</h2>
          {movies.length < 2 ? (
            <div className="p-4 bg-yellow-50 rounded">Upload your ratings.csv to get started.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {[left, right].map((m, i) => (
                <div key={m ? m.id : i} className="bg-white p-4 rounded shadow-sm">
                  {m ? (
                    <>
                      <div className="text-sm text-slate-500">{i === 0 ? "A" : "B"}</div>
                      <div className="text-xl font-semibold">{m.title}</div>
                      <div className="text-sm text-slate-400">{m.year}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="text-sm text-slate-600">Elo: {m.elo}</div>
                        <div className="text-sm text-slate-600">Played: {m.played}</div>
                      </div>
                      <div className="mt-3">
                        <button
                          className="w-full px-3 py-2 rounded bg-indigo-600 text-white"
                          onClick={() => {
                            if (i === 0) handleChoice(m.id, (i === 0 ? right : left)?.id);
                            else handleChoice(m.id, (i === 1 ? left : right)?.id);
                          }}
                        >
                          Choose this as better
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">No movie</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-sm text-slate-500">Tip: the app tries to give you close Elo matchups so each choice matters.</div>
        </div>

        <div className="border-t mt-6 pt-4">
          <h2 className="text-lg font-semibold mb-2">Current Rankings</h2>
          <div className="overflow-auto max-h-72 border rounded">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Year</th>
                  <th className="p-2 text-left">Elo</th>
                  <th className="p-2 text-left">Played</th>
                </tr>
              </thead>
              <tbody>
                {movies
                  .slice()
                  .sort((a, b) => b.elo - a.elo)
                  .map((m, i) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-medium">{m.title}</td>
                      <td className="p-2">{m.year}</td>
                      <td className="p-2">{m.elo}</td>
                      <td className="p-2">{m.played}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t mt-6 pt-4">
          <h2 className="text-lg font-semibold mb-2">History (recent choices)</h2>
          <div className="text-xs text-slate-600">Most recent first</div>
          <div className="max-h-48 overflow-auto mt-2 text-sm">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Winner</th>
                  <th className="p-2 text-left">Loser</th>
                  <th className="p-2 text-left">Elo Δ</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 200).map((h, idx) => {
                  const w = movies.find((m) => m.id === h.winner) || {};
                  const l = movies.find((m) => m.id === h.loser) || {};
                  const deltaA = (h.newA || 0) - (h.prevA || 0);
                  const deltaB = (h.newB || 0) - (h.prevB || 0);
                  return (
                    <tr key={idx} className="border-t text-xs">
                      <td className="p-2">{new Date(h.time).toLocaleString()}</td>
                      <td className="p-2">{w.title || h.winner}</td>
                      <td className="p-2">{l.title || h.loser}</td>
                      <td className="p-2">+{deltaA} / {deltaB}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">Disclaimer: This is a single-file demo. Consider adding posters, reducing repetition, and
          improving pairing heuristics in a real app. Data is stored only in your browser's localStorage.</div>
      </div>
    </div>
  );
}
