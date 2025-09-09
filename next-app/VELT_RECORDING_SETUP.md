# Velt Basic Recording Setup Guide

This guide provides a step-by-step process to integrate a basic screen recording feature using the Velt SDK into an existing Next.js application. It covers setup, environment variables, authentication, document management, and the recorder component. This is based on a simplified implementation that focuses on screen-only recording with automatic playback after processing, without microphone input.

## Prerequisites
- A Next.js project (version 15 or compatible).
- Node.js and npm installed.
- A Velt account with an API key (sign up at [velt.dev](https://velt.dev) if needed).
- Basic knowledge of React and Next.js.

## Step 1: Install Dependencies
Install the required Velt packages:

```bash
npm install @veltdev/react @veltdev/types
```

These provide the React components and types for Velt integration.

## Step 2: Set Up Environment Variables
Create or update your `.env.local` file in the root of your project with your Velt API key:

```
NEXT_PUBLIC_VELT_API_KEY=your_velt_api_key_here
```

**Note:** Keep this file in `.gitignore` to avoid committing sensitive information.

## Step 3: Set Up Velt Provider
Wrap your application with the `VeltProvider` to initialize the SDK. Create a `providers.tsx` file in `src/app/` (or adjust your layout accordingly):

```tsx
// src/app/providers.tsx
"use client";

import { VeltProvider } from "@veltdev/react";
import VeltAuth from "@/components/VeltAuth"; // Adjust path as needed
import VeltDocument from "@/components/VeltDocument"; // Adjust path as needed

export default function Providers({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_VELT_API_KEY || "";

  return (
    <VeltProvider apiKey={apiKey}>
      <VeltAuth />
      <VeltDocument />
      {children}
    </VeltProvider>
  );
}
```

Then, in your root layout (`src/app/layout.tsx`), import and use the provider:

```tsx
// src/app/layout.tsx (excerpt)
import Providers from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Step 4: User Authentication (VeltAuth)
Create a `VeltAuth.tsx` component in `src/components/` to identify users with Velt. This uses mock data; replace with your auth system.

```tsx
// src/components/VeltAuth.tsx
"use client";

import { useIdentify } from "@veltdev/react";

export default function VeltAuth() {
  // Replace with your actual user data
  const user = {
    userId: "user123",
    organizationId: "org123",
    name: "Test User",
    email: "test@example.com",
    photoUrl: "https://i.pravatar.cc/300",
    color: "#FF5733",
    textColor: "#FFFFFF",
  };

  useIdentify(user);

  return null; // This component doesn't render anything
}
```

## Step 5: Document Management (VeltDocument)
Create a `VeltDocument.tsx` component in `src/components/` to set a unique document ID for the recording session.

```tsx
// src/components/VeltDocument.tsx
"use client";

import { useSetDocument } from "@veltdev/react";

export default function VeltDocument() {
  useSetDocument("screen-recording-app", {
    documentName: "Screen Recording Session",
  });

  return null; // This component doesn't render anything
}
```

## Step 6: Recorder Component (VeltRecorder)
Create the main recorder component in `src/components/VeltRecorder.tsx`. This handles starting recordings, processing, and playback.

```tsx
// src/components/VeltRecorder.tsx
"use client";

import {
  VeltRecorderTool,
  VeltRecorderControlPanel,
  VeltRecorderPlayer,
  useRecorderUtils,
  useRecorderEventCallback,
} from "@veltdev/react";
import { useEffect, useState } from "react";

export default function VeltRecorder() {
  const recorderUtils = useRecorderUtils();
  const [recorderId, setRecorderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const recordingStopped = useRecorderEventCallback("recordingStopped");
  const recordingDone = useRecorderEventCallback("recordingDone");

  useEffect(() => {
    if (recordingDone) {
      if (recordingDone.recorderId) {
        setRecorderId(recordingDone.recorderId);
      }
      setIsLoading(false);
    }
  }, [recordingDone]);

  useEffect(() => {
    if (recordingStopped) {
      setIsLoading(true);
    }
  }, [recordingStopped]);

  useEffect(() => {
    if (recorderUtils) {
      recorderUtils.disableRecordingMic(); // Screen-only recording
    }
  }, [recorderUtils]);

  return (
    <div className="recorder-container">
      <div className="toolbar">
        <VeltRecorderTool type="screen" buttonLabel="Start Recording Now" />
        <VeltRecorderControlPanel mode="floating" />
      </div>
      <div className="video-player mt-6">
        {isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <h3 className="text-lg font-medium mb-2">Processing Recording...</h3>
            <div className="flex items-center justify-center p-6">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </div>
        )}
        {!isLoading && recorderId && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <h3 className="text-lg font-medium mb-2">Latest Recording</h3>
            <VeltRecorderPlayer
              key={recorderId}
              recorderId={recorderId}
              summary={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

## Step 7: Integrate into Your Page
Add the recorder to your desired page, e.g., `src/app/page.tsx`:

```tsx
// src/app/page.tsx
import VeltRecorder from "@/components/VeltRecorder";

export default function Home() {
  return (
    <main>
      <VeltRecorder />
    </main>
  );
}
```

## Step 8: Styling and Customization
- Add Tailwind CSS or your preferred styling if needed (e.g., for dark mode support in the components).
- Customize further: Refer to Velt docs for more options like enabling mic, changing UI, or adding transcription.

## Step 9: Run and Test
- Start your app: `npm run dev`
- Visit `http://localhost:3000` (or your port).
- Click "Start Recording Now," record your screen, stop, and watch the playback.

## Troubleshooting
- **Build Errors:** Ensure TypeScript types are correct; use `@veltdev/types` for type safety.
- **API Key Issues:** Verify `NEXT_PUBLIC_VELT_API_KEY` is set correctly.
- **Auth:** Customize `VeltAuth` with real user data from your backend.
- **Docs:** For advanced features, check [Velt Documentation](https://docs.velt.dev).

This setup provides a minimal, functional screen recorder. Expand as needed!