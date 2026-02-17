import Head from "next/head";
import Link from "next/link";
import { list } from "@vercel/blob";
import { requireAdminPageSession } from "../../../lib/admin-auth";
import {
  parseEvaluationObject,
  safeJsonParse,
  toAdminSummaryRecord,
  unwrapStoredEvaluation,
} from "../../../lib/evaluation-schema";

function safeText(value) {
  if (value === undefined || value === null || value === "") return "[nil]";
  return String(value);
}

function starLine(value) {
  if (typeof value !== "number") return "[nil]";
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function scoreValue(value) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function EvaluationDetail({ record, summary, id }) {
  const { evaluation, metadata } = unwrapStoredEvaluation(record);
  const parsedEvaluation = parseEvaluationObject(evaluation);

  const helperBotConversation = parsedEvaluation?.helperBotConversation || {};
  const outputQuality = parsedEvaluation?.outputQuality || {};
  const transcriptionQuality = parsedEvaluation?.transcriptionQuality || {};
  const overallScore = scoreValue(parsedEvaluation?.overallScore);
  const analysis = parsedEvaluation?.analysis || {};

  const fallbackRaw =
    typeof evaluation === "string"
      ? safeJsonParse(evaluation) || evaluation
      : evaluation;

  return (
    <>
      <Head>
        <title>Evaluation {id} | Calyptus Admin</title>
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
        <div className="max-w-6xl mx-auto">
          <header className="rounded-3xl border border-[#d8dfd7] bg-white/90 shadow-xl p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.22em] uppercase text-[#0f766e] font-semibold mb-2">
                  Evaluation Detail
                </p>
                <h1
                  className="text-2xl md:text-3xl text-[#132018] break-all"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}
                >
                  {id}
                </h1>
                <p className="text-[#374151] mt-2">Submitted: {safeText(summary.createdAt)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/evaluations"
                  className="px-4 py-2 rounded-xl border border-[#bfc9c3] hover:bg-[#f3f6f4]"
                >
                  Back to Dashboard
                </Link>
                <Link
                  href={summary.publicEvaluationPath}
                  className="px-4 py-2 rounded-xl bg-[#0f766e] text-white hover:bg-[#0e6b63]"
                  target="_blank"
                >
                  Open Public View
                </Link>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Company</p>
              <p className="text-lg font-semibold mt-1">{safeText(summary.companyName)}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Test Creator</p>
              <p className="text-lg font-semibold mt-1">{safeText(summary.testCreatorName)}</p>
              <p className="text-sm text-[#4b5563] mt-1">{safeText(summary.testCreatorEmail)}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Candidate</p>
              <p className="text-lg font-semibold mt-1">{safeText(summary.candidateName)}</p>
              <p className="text-sm text-[#4b5563] mt-1">{safeText(summary.candidateEmail)}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Feedback</p>
              <p className="text-lg font-semibold mt-1">{starLine(summary.feedbackStars)}</p>
              <p className="text-sm text-[#4b5563] mt-2">{safeText(summary.feedbackComment)}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Overall Score</p>
              <p className="text-lg font-semibold mt-1">{safeText(summary.overallScore)}</p>
            </article>
            <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
              <p className="text-sm text-[#4a5a52]">Recording URL</p>
              <p className="text-sm mt-1 break-all">{safeText(metadata?.recordingUrl)}</p>
            </article>
          </section>

          {parsedEvaluation ? (
            <>
              <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <p className="text-sm text-[#4a5a52]">Conversation</p>
                  <p className="text-3xl font-semibold mt-1">{scoreValue(helperBotConversation.score)}/10</p>
                </article>
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <p className="text-sm text-[#4a5a52]">Output</p>
                  <p className="text-3xl font-semibold mt-1">{scoreValue(outputQuality.score)}/10</p>
                </article>
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <p className="text-sm text-[#4a5a52]">Transcription</p>
                  <p className="text-3xl font-semibold mt-1">{scoreValue(transcriptionQuality.score)}/10</p>
                </article>
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <p className="text-sm text-[#4a5a52]">Overall</p>
                  <p className="text-3xl font-semibold mt-1">{overallScore}/10</p>
                </article>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <h2 className="font-semibold text-[#1f2937] mb-3">Conversation Feedback</h2>
                  <p className="text-sm text-[#374151]">{safeText(helperBotConversation.comments)}</p>
                </article>
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <h2 className="font-semibold text-[#1f2937] mb-3">Output Feedback</h2>
                  <p className="text-sm text-[#374151]">{safeText(outputQuality.comments)}</p>
                </article>
                <article className="rounded-2xl border border-[#d8dfd7] bg-white p-5 shadow-lg">
                  <h2 className="font-semibold text-[#1f2937] mb-3">Transcription Feedback</h2>
                  <p className="text-sm text-[#374151]">{safeText(transcriptionQuality.comments)}</p>
                </article>
              </section>

              <section className="rounded-3xl border border-[#d8dfd7] bg-white p-6 shadow-xl">
                <h2 className="text-xl font-semibold mb-4">Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <article className="rounded-2xl bg-[#f7faf8] border border-[#dfe8e2] p-4">
                    <h3 className="font-semibold mb-2">Strengths</h3>
                    <ul className="list-disc pl-5 text-sm text-[#374151]">
                      {(analysis?.strengths || []).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-2xl bg-[#f7faf8] border border-[#dfe8e2] p-4">
                    <h3 className="font-semibold mb-2">Areas For Improvement</h3>
                    <ul className="list-disc pl-5 text-sm text-[#374151]">
                      {(analysis?.areasForImprovement || []).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>
                <article className="rounded-2xl bg-[#f7faf8] border border-[#dfe8e2] p-4 mb-4">
                  <h3 className="font-semibold mb-2">Key Observations</h3>
                  <ul className="list-disc pl-5 text-sm text-[#374151]">
                    {(analysis?.keyObservations || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl bg-[#f7faf8] border border-[#dfe8e2] p-4">
                  <h3 className="font-semibold mb-2">Recommendation</h3>
                  <p className="text-sm text-[#374151]">{safeText(analysis?.recommendation)}</p>
                </article>
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-[#d8dfd7] bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-4">Raw Evaluation</h2>
              <pre className="bg-[#f7faf8] border border-[#dfe8e2] p-4 rounded-2xl overflow-auto text-xs">
                {typeof fallbackRaw === "string"
                  ? fallbackRaw
                  : JSON.stringify(fallbackRaw, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  const { redirect } = requireAdminPageSession(context);

  if (redirect) {
    return { redirect };
  }

  const { id } = context.params;

  try {
    const { blobs } = await list({ prefix: `evaluations/${id}.json` });

    if (!blobs.length) {
      return {
        notFound: true,
      };
    }

    const response = await fetch(blobs[0].url);
    const text = await response.text();
    const record = JSON.parse(text);
    const summary = toAdminSummaryRecord({
      id,
      rawRecord: record,
      blob: blobs[0],
    });

    return {
      props: {
        id,
        record,
        summary,
      },
    };
  } catch {
    return {
      notFound: true,
    };
  }
}
