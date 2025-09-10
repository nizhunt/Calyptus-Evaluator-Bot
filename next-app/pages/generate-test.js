import { useState } from 'react';
import { useRouter } from 'next/router';

export default function GenerateTest() {
  const [employerName, setEmployerName] = useState('');
  const [question, setQuestion] = useState('');
  const [expiresIn, setExpiresIn] = useState('7d');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerName, question, expiresIn })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }

    setLoading(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="container mx-auto min-h-screen p-6 bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="logo-container mb-6 text-center">
          <img
            src="/calyptus_new_logo.avif"
            alt="Calyptus Logo"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-800">Test Generator</h1>
          <p className="text-gray-600 mt-2">Create custom assessment links with JWT tokens</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Employer Name *
              </label>
              <input
                type="text"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter employer/company name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Assessment Question *
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 h-32"
                placeholder="Enter the assessment question or task description"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Token Expiration
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="1d">1 Day</option>
                <option value="3d">3 Days</option>
                <option value="7d">7 Days (Default)</option>
                <option value="14d">14 Days</option>
                <option value="30d">30 Days</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Test Link'}
            </button>
          </form>

          {result && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-4">✓ Test Link Generated Successfully!</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Test URL:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={result.testUrl}
                      readOnly
                      className="flex-1 p-2 border border-gray-300 rounded bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(result.testUrl)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">JWT Token:</label>
                  <div className="flex gap-2">
                    <textarea
                      value={result.token}
                      readOnly
                      className="flex-1 p-2 border border-gray-300 rounded bg-gray-50 text-sm h-20 resize-none"
                    />
                    <button
                      onClick={() => copyToClipboard(result.token)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <p><strong>Employer:</strong> {result.employerName}</p>
                  <p><strong>Expires:</strong> {result.expiresIn}</p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => window.open(result.testUrl, '_blank')}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Test Link
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}