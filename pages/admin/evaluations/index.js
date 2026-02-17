import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { requireAdminPageSession } from "../../../lib/admin-auth";

function renderStars(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "[nil]";
  }

  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function safeText(value) {
  if (value === undefined || value === null || value === "") return "[nil]";
  return String(value);
}

function formatDate(value) {
  if (!value || value === "[nil]") return "[nil]";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "[nil]";
  return date.toLocaleString();
}

export default function AdminEvaluationsDashboard({ session }) {
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [companyFilter, setCompanyFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [candidateFilter, setCandidateFilter] = useState("");
  const [minStars, setMinStars] = useState("");

  const fetchRecords = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/evaluations");
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error || "Unable to load evaluations.");
        return;
      }

      setRecords(payload.records || []);
    } catch {
      setError("Unable to load evaluations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const companyOk = safeText(record.companyName)
        .toLowerCase()
        .includes(companyFilter.toLowerCase());

      const creatorOk = safeText(record.testCreatorEmail)
        .toLowerCase()
        .includes(creatorFilter.toLowerCase());

      const candidateOk = safeText(record.candidateEmail)
        .toLowerCase()
        .includes(candidateFilter.toLowerCase());

      const minStarsNumber = Number(minStars);
      const starsOk =
        !minStars ||
        (typeof record.feedbackStars === "number" &&
          !Number.isNaN(minStarsNumber) &&
          record.feedbackStars >= minStarsNumber);

      return companyOk && creatorOk && candidateOk && starsOk;
    });
  }, [records, companyFilter, creatorFilter, candidateFilter, minStars]);

  const stats = useMemo(() => {
    const feedbackRecords = filteredRecords.filter(
      (record) => typeof record.feedbackStars === "number"
    );

    const averageStars = feedbackRecords.length
      ? (
          feedbackRecords.reduce((sum, record) => sum + record.feedbackStars, 0) /
          feedbackRecords.length
        ).toFixed(1)
      : "[nil]";

    return {
      total: filteredRecords.length,
      withFeedback: feedbackRecords.length,
      averageStars,
    };
  }, [filteredRecords]);

  const deleteEvaluation = async (id) => {
    const confirmed = window.confirm(
      `Delete evaluation ${id}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);

    try {
      const res = await fetch(`/api/admin/evaluations/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = await res.json();
        window.alert(payload?.error || "Failed to delete evaluation.");
        return;
      }

      setRecords((prev) => prev.filter((record) => record.id !== id));
    } catch {
      window.alert("Failed to delete evaluation.");
    } finally {
      setDeletingId("");
    }
  };

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  return (
    <>
      <Head>
        <title>Evaluations Dashboard | Calyptus Admin</title>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <main
        className="min-h-screen p-5 md:p-8"
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          background:
            "radial-gradient(circle at 5% 5%, #eaf9f6 0, transparent 28%), radial-gradient(circle at 90% 12%, #fff1d7 0, transparent 32%), #f4f6f1",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <header className="rounded-3xl border border-[#d8dfd7] bg-white/90 backdrop-blur-xl shadow-xl p-6 md:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.22em] uppercase text-[#0f766e] font-semibold mb-2">
                  Admin Dashboard
                </p>
                <h1
                  className="text-3xl md:text-4xl text-[#132018]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}
                >
                  Evaluation Registry
                </h1>
                <p className="text-[#2e3d35] mt-2">
                  Signed in as {safeText(session?.email)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchRecords}
                  className="px-4 py-2 rounded-xl border border-[#b7c4be] text-[#1e2b24] bg-white hover:bg-[#f4faf8] transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-xl bg-[#1f2937] text-white hover:bg-[#111827] transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Visible Submissions</p>
              <p className="text-3xl font-semibold text-[#112019] mt-1">{stats.total}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">With Feedback</p>
              <p className="text-3xl font-semibold text-[#112019] mt-1">{stats.withFeedback}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Average Stars</p>
              <p className="text-3xl font-semibold text-[#112019] mt-1">{stats.averageStars}</p>
            </article>
          </section>

          <section className="rounded-3xl border border-[#d8dfd7] bg-white/95 shadow-xl p-5 md:p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#17231d] mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                placeholder="Company"
                className="w-full rounded-xl border border-[#c7d1cb] px-3 py-2 bg-[#fbfdfb]"
              />
              <input
                type="text"
                value={creatorFilter}
                onChange={(event) => setCreatorFilter(event.target.value)}
                placeholder="Test Creator Email"
                className="w-full rounded-xl border border-[#c7d1cb] px-3 py-2 bg-[#fbfdfb]"
              />
              <input
                type="text"
                value={candidateFilter}
                onChange={(event) => setCandidateFilter(event.target.value)}
                placeholder="Candidate Email"
                className="w-full rounded-xl border border-[#c7d1cb] px-3 py-2 bg-[#fbfdfb]"
              />
              <input
                type="number"
                min="1"
                max="5"
                value={minStars}
                onChange={(event) => setMinStars(event.target.value)}
                placeholder="Min Stars"
                className="w-full rounded-xl border border-[#c7d1cb] px-3 py-2 bg-[#fbfdfb]"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-[#d8dfd7] bg-white/95 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#102018] text-[#f2f8f4]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Submission</th>
                    <th className="text-left px-4 py-3 font-semibold">Company</th>
                    <th className="text-left px-4 py-3 font-semibold">Test Creator</th>
                    <th className="text-left px-4 py-3 font-semibold">Candidate</th>
                    <th className="text-left px-4 py-3 font-semibold">Feedback</th>
                    <th className="text-left px-4 py-3 font-semibold">Overall</th>
                    <th className="text-left px-4 py-3 font-semibold">Submitted</th>
                    <th className="text-left px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-[#edf0ec] hover:bg-[#f5f9f7] cursor-pointer"
                      onClick={() => router.push(record.evaluationPath)}
                    >
                      <td className="px-4 py-3 font-medium text-[#0f172a]">{record.id}</td>
                      <td className="px-4 py-3">{safeText(record.companyName)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111827]">
                          {safeText(record.testCreatorName)}
                        </p>
                        <p className="text-xs text-[#4b5563]">
                          {safeText(record.testCreatorEmail)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111827]">
                          {safeText(record.candidateName)}
                        </p>
                        <p className="text-xs text-[#4b5563]">
                          {safeText(record.candidateEmail)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{renderStars(record.feedbackStars)}</p>
                        <p className="text-xs text-[#4b5563] max-w-[240px] truncate">
                          {safeText(record.feedbackComment)}
                        </p>
                      </td>
                      <td className="px-4 py-3">{safeText(record.overallScore)}</td>
                      <td className="px-4 py-3">{formatDate(record.createdAt)}</td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(record.evaluationPath)}
                            className="px-3 py-1.5 rounded-lg border border-[#bfc9c3] hover:bg-[#f3f6f4]"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => deleteEvaluation(record.id)}
                            disabled={deletingId === record.id}
                            className="px-3 py-1.5 rounded-lg bg-[#b91c1c] text-white hover:bg-[#991b1b] disabled:opacity-50"
                          >
                            {deletingId === record.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && !loading && (
                    <tr>
                      <td colSpan="8" className="px-4 py-10 text-center text-[#374151]">
                        No evaluations match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {loading && <p className="p-4 text-center">Loading evaluations...</p>}
            {error && <p className="p-4 text-center text-[#b91c1c]">{error}</p>}
          </section>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  const { session, redirect } = requireAdminPageSession(context);

  if (redirect) {
    return { redirect };
  }

  return {
    props: {
      session: {
        email: session.email,
      },
    },
  };
}
