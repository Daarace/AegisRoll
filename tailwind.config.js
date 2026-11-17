/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oxford: {
          900: '#0A1523',
          800: '#0F2137', // Brand Dark / Oxford Navy
          700: '#152E4D',
          600: '#1D3B62',
          100: '#E6ECF5',
        },
        teal: {
          brand: '#26B9A8', // Academic Teal
          hover: '#1FA394',
          light: '#E6F8F6',
          dark: '#14635A'
        },
        gold: {
          brand: '#D9B354', // Prestige Gold
          light: '#FBF6EA',
          dark: '#A68430'
        },
        surface: {
          DEFAULT: '#F8FAFC', // Crisp Off-White
          card: '#FFFFFF',
          border: '#E2E8F0' // Slate border
        }
      },
      fontFamily: {
        serif: ['Merriweather', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'academic': '0 4px 20px -2px rgba(15, 33, 55, 0.08), 0 2px 6px -1px rgba(15, 33, 55, 0.04)',
        'academic-lg': '0 10px 30px -4px rgba(15, 33, 55, 0.12), 0 4px 10px -2px rgba(15, 33, 55, 0.06)'
      }
    },
  },
  plugins: [],
}
