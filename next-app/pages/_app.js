import "../styles/globals.css";
import { AppProps } from "next/app";
import { VeltProvider } from "@veltdev/react";
import VeltAuth from "../components/VeltAuth";
import VeltDocument from "../components/VeltDocument";

function MyApp({ Component, pageProps }) {
  const apiKey = process.env.NEXT_PUBLIC_VELT_API_KEY || "";

  return (
    <VeltProvider apiKey={apiKey}>
      <VeltAuth />
      <VeltDocument />
      <Component {...pageProps} />
    </VeltProvider>
  );
}

export default MyApp;
