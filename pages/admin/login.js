import Head from "next/head";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function AdminLogin() {
  const router = useRouter();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredentialResponse = async (response) => {
    if (!response?.credential) {
      setError("Google sign-in did not return a credential.");
      return;
    }

    try {
      const loginRes = await fetch("/api/admin/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });

      const payload = await loginRes.json();
      if (!loginRes.ok) {
        setError(payload?.error || "Sign-in failed.");
        return;
      }

      router.replace("/admin/evaluations");
    } catch {
      setError("Unable to sign in right now.");
    }
  };

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const sessionRes = await fetch("/api/admin/auth/session");
        const sessionData = await sessionRes.json();

        if (!mounted) return;

        if (sessionData?.authenticated) {
          router.replace("/admin/evaluations");
          return;
        }
      } catch {
        // Ignore session check failures; user can still sign in.
      }

      if (mounted) {
        setIsCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  const initializeGoogle = () => {
    if (!clientId) {
      setError("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in environment.");
      return;
    }

    if (!window.google || !buttonRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      shape: "pill",
      theme: "outline",
      text: "signin_with",
      size: "large",
      width: 320,
    });
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f5f7f2] text-[#1e2a23]">
        <p className="text-sm tracking-wide uppercase">Checking admin session...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Login | Calyptus Evaluations</title>
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
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGoogle}
      />

      <main
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background:
            "radial-gradient(circle at 10% 20%, #e5f5ea 0%, transparent 40%), radial-gradient(circle at 90% 10%, #ffecc9 0%, transparent 35%), linear-gradient(160deg, #f4f6ef 0%, #eef3ff 100%)",
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        <section className="w-full max-w-xl rounded-3xl border border-[#1f2937]/10 bg-white/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-[#0f766e] via-[#0891b2] to-[#f59e0b]" />
          <div className="p-8 md:p-10">
            <p className="uppercase tracking-[0.2em] text-xs text-[#0f766e] font-semibold mb-3">
              Calyptus Admin
            </p>
            <h1
              className="text-3xl md:text-4xl text-[#15221e] mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}
            >
              Evaluation Control Center
            </h1>
            <p className="text-[#2f3f38] mb-8 leading-relaxed">
              Sign in with your Google account. Access is restricted to
              <span className="font-semibold"> @calyptus.co </span>
              email addresses.
            </p>

            <div className="rounded-2xl border border-[#d7ddd5] bg-[#f9fbf7] p-6">
              <div ref={buttonRef} className="min-h-[44px] flex justify-center" />
              {error && (
                <p className="mt-4 text-sm text-[#b91c1c] text-center font-medium">{error}</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
