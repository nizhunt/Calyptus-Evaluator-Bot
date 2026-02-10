import { useState } from "react";
import InhousePluginRecorder from "../components/InhousePluginRecorder";

export default function TestInteraction() {
  const [clickCount, setClickCount] = useState(0);
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Screen Recording Interaction Test
        </h1>
        
        {/* Recording Component */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Recording Controls</h2>
          <InhousePluginRecorder />
        </div>

        {/* Test Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Button Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Button Interaction Test</h3>
            <button
              onClick={() => setClickCount(prev => prev + 1)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Click Me! (Count: {clickCount})
            </button>
            <p className="mt-2 text-sm text-gray-600">
              This button should be clickable even during recording
            </p>
          </div>

          {/* Input Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Input Interaction Test</h3>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type here during recording..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-2 text-sm text-gray-600">
              Current value: "{inputValue}"
            </p>
          </div>

          {/* Dropdown Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Dropdown Test</h3>
            <select className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
            <p className="mt-2 text-sm text-gray-600">
              This dropdown should work during recording
            </p>
          </div>

          {/* Scroll Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Scroll Test</h3>
            <div className="h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="py-1 border-b border-gray-200 last:border-b-0">
                  Scrollable item {i + 1}
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-600">
              This area should be scrollable during recording
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-700">
            <li>Start recording using the "Start Recording Now" button above</li>
            <li>Try interacting with all the test components below</li>
            <li>Check if buttons are clickable, inputs are typeable, dropdowns work, and scrolling functions</li>
            <li>If any component becomes unresponsive during recording, that indicates an overlay issue</li>
            <li>Stop recording and verify if interactions work again</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
