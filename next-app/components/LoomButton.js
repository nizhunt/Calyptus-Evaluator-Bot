import { useEffect, useRef } from 'react';

export default function LoomButton({ onRecordingStart, onRecordingComplete, onInsertClick }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    async function initLoom() {
      try {
        const { setup } = await import("@loomhq/record-sdk");
        const { isSupported } = await import("@loomhq/record-sdk/is-supported");

        const { supported, error } = await isSupported();
        if (!supported) {
          console.warn(`Error setting up Loom: ${error}`);
          return;
        }

        const button = buttonRef.current;
        if (!button) return;

        const { configureButton } = await setup({
          publicAppId: process.env.NEXT_PUBLIC_LOOM_PUBLIC_APP_ID,
        });

        const sdkButton = configureButton({ element: button });

        sdkButton.on("recording-start", () => {
          onRecordingStart();
        });

        sdkButton.on("recording-complete", () => {
          onRecordingComplete();
        });

        sdkButton.on("insert-click", async (video) => {
          const { sharedUrl } = video;
          onInsertClick(sharedUrl);
        });
      } catch (err) {
        console.error("Error initializing Loom SDK:", err);
      }
    }

    initLoom();
  }, [onRecordingStart, onRecordingComplete, onInsertClick]);

  return (
    <button
      ref={buttonRef}
      className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
    >
      Record Test
    </button>
  );
}