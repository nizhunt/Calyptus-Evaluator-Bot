import { list } from "@vercel/blob";
import { VeltRecorderPlayer } from "@veltdev/react";

export default function Evaluation({ evaluation }) {
  let parsedData;

  // Handle both string and object evaluation data
  if (typeof evaluation === "string") {
    try {
      parsedData = JSON.parse(evaluation);
    } catch (e) {
      parsedData = null;
    }
  } else {
    // evaluation is already an object
    parsedData = evaluation;
  }

  if (!parsedData) {
    // Check if it's a "Not found" case or actual HTML error
    const isNotFound = evaluation === "Not found";
    const isHtmlError =
      typeof evaluation === "string" && evaluation.includes("<!DOCTYPE html>");

    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Evaluation Result</h1>
        {isNotFound ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              Evaluation Not Found
            </h2>
            <p className="text-yellow-700">
              The evaluation with this ID does not exist or may have been
              deleted.
            </p>
            <p className="text-sm text-yellow-600 mt-2">
              Please check the URL and try again.
            </p>
          </div>
        ) : isHtmlError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-red-800 mb-2">
              Access Error
            </h2>
            <p className="text-red-700">
              There was an error accessing the evaluation data.
            </p>
            <p className="text-sm text-red-600 mt-2">
              This might be due to network issues or security restrictions.
            </p>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
            {evaluation}
          </pre>
        )}
      </div>
    );
  }

  // Handle both old and new data structures
  const evaluationData = parsedData.data
    ? parsedData.data.evaluation
    : parsedData.evaluation || parsedData;
  const metadata = parsedData.data
    ? parsedData.data.metadata
    : parsedData.metadata;

  let parsedEval;
  try {
    // Handle double-encoded JSON strings
    let evalToParse = evaluationData;
    if (typeof evaluationData === "string") {
      evalToParse = JSON.parse(evaluationData);
      // If it's still a string after first parse, parse again
      if (typeof evalToParse === "string") {
        evalToParse = JSON.parse(evalToParse);
      }
    }
    parsedEval = evalToParse;
  } catch (e) {
    console.error("Error parsing evaluation data:", e);
    parsedEval = null;
  }

  if (!parsedEval) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Evaluation Result</h1>
        <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
          {typeof evaluationData === "string"
            ? evaluationData
            : JSON.stringify(evaluationData, null, 2)}
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
  } = parsedEval;

  // Extract metadata for recorder and files
  const recorderId = metadata?.recorderId;
  const recordingUrl = metadata?.recordingUrl;
  const submittedFiles = metadata?.submittedFiles || [];
  const candidate = metadata?.candidate || {};

  return (
    <div className="container mx-auto min-h-screen p-6 bg-white text-gray-800">
      <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
        Evaluation Dashboard
      </h1>

      {/* Candidate Information Section */}
      {candidate.name && candidate.email && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
          <h2 className="text-xl font-semibold mb-4">Candidate Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="text-lg font-semibold text-gray-800">{candidate.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-lg font-semibold text-gray-800">{candidate.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Velt Recorder Player Section */}
      {recorderId && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
          <h2 className="text-xl font-semibold mb-4">Screen Recording</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <VeltRecorderPlayer recorderId={recorderId} summary={false} />
          </div>
          {recordingUrl && (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Recording URL:{" "}
                <a
                  href={recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {recordingUrl}
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {(recordingUrl || submittedFiles?.length > 0) && (
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {recordingUrl && (
            <div
              className={`bg-white p-6 rounded-lg shadow-md border border-gray-200 ${
                submittedFiles?.length > 0 ? "md:w-[70%]" : "md:w-full"
              }`}
            >
              <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
              <iframe
                src={recordingUrl.replace("/share/", "/embed/")}
                frameBorder="0"
                allowFullScreen
                className="w-full h-64"
              ></iframe>
            </div>
          )}
          {submittedFiles?.length > 0 && (
            <div
              className={`bg-white p-6 rounded-lg shadow-md border border-gray-200 ${
                recordingUrl ? "md:w-[30%]" : "md:w-full"
              }`}
            >
              <h2 className="text-xl font-semibold mb-4">Submitted Files</h2>
              <ul className="list-disc pl-5">
                {submittedFiles.map((file, index) => (
                  <li key={index}>
                    <a
                      href={file.url}
                      download
                      className="text-blue-500 hover:underline"
                    >
                      {file.name || `File ${index + 1}`}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
            Diagnostic Score
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gray-200"></div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                clipPath: `inset(${
                  100 - (helperBotConversation?.score ?? 0) * 10
                }% 0 0 0)`,
              }}
            ></div>
            <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {helperBotConversation?.score ?? 0}/10
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {helperBotConversation?.comments ?? ""}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
            Solution Score
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gray-200"></div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                clipPath: `inset(${
                  100 - (outputQuality?.score ?? 0) * 10
                }% 0 0 0)`,
              }}
            ></div>
            <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {outputQuality?.score ?? 0}/10
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {outputQuality?.comments ?? ""}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-t-lg">
            Communication Score
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gray-200"></div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                clipPath: `inset(${
                  100 - (transcriptionQuality?.score ?? 0) * 10
                }% 0 0 0)`,
              }}
            ></div>
            <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
              {transcriptionQuality?.score ?? 0}/10
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {transcriptionQuality?.comments ?? ""}
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
            style={{
              clipPath: `inset(${100 - (overallScore ?? 0) * 10}% 0 0 0)`,
            }}
          ></div>
          <p className="absolute inset-0 flex items-center justify-center text-3xl font-bold">
            {overallScore ?? 0}/10
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Strengths</h2>
          <ul className="list-disc pl-5">
            {analysis?.strengths?.map((item, index) => (
              <li key={index}>{item}</li>
            )) ?? []}
          </ul>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Areas for Improvement</h2>
          <ul className="list-disc pl-5">
            {analysis?.areasForImprovement?.map((item, index) => (
              <li key={index}>{item}</li>
            )) ?? []}
          </ul>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-6">
        <h2 className="text-xl font-semibold mb-4">Key Observations</h2>
        <ul className="list-disc pl-5">
          {analysis?.keyObservations?.map((item, index) => (
            <li key={index}>{item}</li>
          )) ?? []}
        </ul>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-6">
        <h2 className="text-xl font-semibold mb-4">Recommendation</h2>
        <p>{analysis?.recommendation ?? ""}</p>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  let evaluation = "Not found";
  try {
    const { blobs } = await list({ prefix: `evaluations/${params.id}.json` });
    if (blobs.length > 0) {
      const response = await fetch(blobs[0].url);
      const rawData = await response.text();
      // Parse the JSON data to get the actual evaluation content
      const parsedData = JSON.parse(rawData);
      evaluation = parsedData; // Pass the full object including metadata
    }
  } catch (error) {
    console.error("Error fetching evaluation:", error);
  }
  return { props: { evaluation } };
}
