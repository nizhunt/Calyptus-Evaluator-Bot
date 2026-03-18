import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ThankYou() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorEmail, setCreatorEmail] = useState('');
  const [evaluationId, setEvaluationId] = useState('');
  const [hasEmployer, setHasEmployer] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const sendFeedback = async () => {
    const evaluationUrl = evaluationId
       ? `${window.location.origin}/evaluation/${evaluationId}`
       : '';

    const payload = {
      evaluationUrl,
      evaluationData: {},        // populate on server if needed
      metadata: {},             // populate on server if needed
      testCreator: {
        name: creatorName,
        email: creatorEmail || '',
      },
      candidate: {
        name: candidateName,
        email: candidateEmail || '',
      },
      rating,
      comment,
      timestamp: new Date().toISOString(),
    };

    try {
      const requests = [];

      if (process.env.NEXT_PUBLIC_FEEDBACK_API_URL) {
        requests.push(
          fetch(process.env.NEXT_PUBLIC_FEEDBACK_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        );
      }

      if (evaluationId) {
        requests.push(
          fetch('/api/save-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evaluationId,
              rating,
              comment,
            }),
          })
        );
      }

      await Promise.allSettled(requests);
      setFeedbackSent(true);        // show thank-you message
    } catch (e) {
      // silently ignore network errors
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    let hasStoredData = false;

    // Primary path: retrieve context from session storage to avoid URL data leakage.
    try {
      const raw = window.sessionStorage.getItem('thankYouContext');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.candidateName) setCandidateName(parsed.candidateName);
        if (parsed?.candidateEmail) setCandidateEmail(parsed.candidateEmail);
        if (parsed?.creatorName) setCreatorName(parsed.creatorName);
        if (parsed?.creatorEmail) setCreatorEmail(parsed.creatorEmail);
        if (parsed?.evaluationId) setEvaluationId(parsed.evaluationId);
        if (parsed?.hasEmployer !== undefined) setHasEmployer(parsed.hasEmployer);
        hasStoredData = true;
      }
    } catch (error) {
      console.error('Unable to read thank-you context:', error);
    }

    // Fallback for old links that still include query params.
    if (!hasStoredData) {
      const { name, email, creator, creatorEmail: creatorEmailFromQuery, evaluation } = router.query;

      if (typeof name === 'string') setCandidateName(decodeURIComponent(name));
      if (typeof email === 'string') setCandidateEmail(decodeURIComponent(email));
      if (typeof creator === 'string') setCreatorName(decodeURIComponent(creator));
      if (typeof creatorEmailFromQuery === 'string') {
        setCreatorEmail(decodeURIComponent(creatorEmailFromQuery));
      }
      if (typeof evaluation === 'string') setEvaluationId(decodeURIComponent(evaluation));
    }
  }, [router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Thank You!</h1>
          <p className="text-gray-600">
            {candidateName ? `Thanks ${candidateName},` : 'Thanks!'} Your test has been forwarded to {creatorName || 'the test creator'}.
          </p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            Your assessment has been submitted successfully. The evaluation team will review your submission and contact you if needed.
          </p>
        </div>

        {!hasEmployer && evaluationId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-sm font-semibold mb-1">Your evaluation results are ready</p>
            <a
              href={`/evaluation/${evaluationId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              View your evaluation report
            </a>
          </div>
        )}

        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            {!feedbackSent ? (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate your experience</label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        aria-label={`Rate ${star} out of 5 stars`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    rows={3}
                    placeholder="Optional comments..."
                  />
                </div>
                <button
                  onClick={sendFeedback}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 px-4 rounded-md text-sm font-semibold hover:from-blue-600 hover:to-purple-600"
                >
                  Send Feedback
                </button>
              </>
            ) : (
              <div className="text-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-700 font-semibold">Thanks for your feedback!</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <a
            href="https://calyptus.co"
            className="inline-block opacity-60 hover:opacity-100 transition-opacity duration-200"
            aria-label="Go to Calyptus homepage"
          >
            <img
              src="/calyptus_new_logo.avif"
              alt="Calyptus Logo"
              className="h-8 mx-auto"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
