import fs from "fs";
import path from "path";
import { useState } from "react";

export default function Evaluation({ evaluation }) {
  let parsedEval;
  try {
    parsedEval = JSON.parse(evaluation);
  } catch (e) {
    parsedEval = null;
  }

  if (!parsedEval) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Evaluation Result</h1>
        <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
          {evaluation}
        </pre>
      </div>
    );
  }

  const {
    helperBotConversation,
    outputQuality,
    transcriptionQuality,
    overallScore,
    analysis,
  } = parsedEval.evaluation;

  return (
    <div className="container mx-auto min-h-screen p-6 bg-white text-gray-800">
      <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
        Evaluation Dashboard
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
            Helper Bot Conversation
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gray-200"></div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                clipPath: `inset(0 0 ${
                  100 - helperBotConversation.score * 10
                }% 0)`,
              }}
            ></div>
            <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {helperBotConversation.score}/10
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {helperBotConversation.comments}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
            Output Quality
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gray-200"></div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                clipPath: `inset(0 0 ${100 - outputQuality.score * 10}% 0)`,
              }}
            ></div>
            <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {outputQuality.score}/10
            </p>
          </div>
          <p className="text-sm text-gray-600">{outputQuality.comments}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
            Transcription Quality
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gray-200"></div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                clipPath: `inset(0 0 ${
                  100 - transcriptionQuality.score * 10
                }% 0)`,
              }}
            ></div>
            <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {transcriptionQuality.score}/10
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {transcriptionQuality.comments}
          </p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <h2 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
          Overall Score
        </h2>
        <div className="relative w-32 h-32 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-gray-200"></div>
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{ clipPath: `inset(0 0 ${100 - overallScore * 10}% 0)` }}
          ></div>
          <p className="absolute inset-0 flex items-center justify-center text-3xl font-bold">
            {overallScore}/10
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Strengths</h2>
          <ul className="list-disc pl-5">
            {analysis.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Areas for Improvement</h2>
          <ul className="list-disc pl-5">
            {analysis.areasForImprovement.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-6">
        <h2 className="text-xl font-semibold mb-4">Key Observations</h2>
        <ul className="list-disc pl-5">
          {analysis.keyObservations.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-6">
        <h2 className="text-xl font-semibold mb-4">Recommendation</h2>
        <p>{analysis.recommendation}</p>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const dataPath = path.join(process.cwd(), "data", "evaluations.json");
  let evaluation = "Not found";
  try {
    const evaluations = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const evalItem = evaluations.find((e) => e.id === params.id);
    if (evalItem) {
      evaluation = evalItem.evaluation;
    }
  } catch (error) {
    console.error(error);
  }
  return { props: { evaluation } };
}
