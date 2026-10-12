/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bảng màu thương hiệu E-Master (nguồn: docs / READ_ME_FIRST)
        master: {
          DEFAULT: '#2A4272',
          light: '#3B567F',
          dark: '#1E3054',
        },
        emblue: {
          DEFAULT: '#3A8FDB',
          light: '#5FA6E3',
          dark: '#2C74B4',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
