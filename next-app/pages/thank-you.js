import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ThankYou() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState('');
  const [creatorName, setCreatorName] = useState('');

  useEffect(() => {
    // Get data from URL parameters
    const { name, creator } = router.query;
    if (name) {
      setCandidateName(decodeURIComponent(name));
    }
    if (creator) {
      setCreatorName(decodeURIComponent(creator));
    }
  }, [router.query]);

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

        <div className="space-y-3">
          <button
            onClick={() => window.close()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md"
          >
            Close Window
          </button>
          
          <button
            onClick={() => window.location.href = 'https://calyptus.co'}
            className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
          >
            Return to Homepage
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <img
            src="/calyptus_new_logo.avif"
            alt="Calyptus Logo"
            className="h-8 mx-auto opacity-60"
          />
        </div>
      </div>
    </div>
  );
}