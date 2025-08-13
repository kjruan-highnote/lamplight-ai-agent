/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vault-yellow': '#F7CE00',
        'vault-blue': '#41A5EE', 
        'vault-green': '#41F76B',
        'vault-amber': '#FFA500',
      },
      fontFamily: {
        'mono': ['Courier New', 'monospace'],
        'terminal': ['VT323', 'monospace'],
      }
    },
  },
  plugins: [],
}