/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        calyptus: "10px",
        "calyptus-lg": "20px",
      },
      boxShadow: {
        "calyptus-elevated": "0px 4px 10px 0px rgba(16, 24, 40, 0.15)",
      },
      colors: {
        calyptus: {
          tint: "#F3F6FF",
          "accent-periwinkle": "#AAB9F2",
          "surface-bar": "#F5F7FA",
          "border-card": "#DFDEF5",
          subtle: "#C0C1C0",
          muted: "#A5A7A5",
          body: "#383D3A",
          strong: "#1A1A1A",
          nav: "#6E7270",
          "nav-hover": "#4B5563",
          purple: "#8C65DE",
          "purple-hover": "#7A56C9",
          "purple-muted": "#6D4EC4",
          "blue-deep": "#0C30AD",
          "surface-input": "#F6F6F6",
          "border-input": "#F2F2F3",
          "border-field": "#DBDCDB",
          "primary-green": "#008E33",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "calyptus-chat-header":
          "linear-gradient(253deg, #8C65DE 33.95%, #0C30AD 92.22%)",
      },
    },
  },
  plugins: [],
};
