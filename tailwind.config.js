/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Thêm dòng này để quét tất cả tệp React
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}