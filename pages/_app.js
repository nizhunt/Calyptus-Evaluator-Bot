import "../styles/globals.css";
import { FeedbackProvider } from "../contexts/FeedbackContext";

function MyApp({ Component, pageProps }) {
  return (
    <FeedbackProvider>
      <Component {...pageProps} />
    </FeedbackProvider>
  );
}

export default MyApp;
