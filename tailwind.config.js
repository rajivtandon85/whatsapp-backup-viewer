/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WhatsApp color palette
        whatsapp: {
          primary: '#00a884',
          'primary-dark': '#008069',
          // Message bubble colors
          incoming: '#202c33',           // Dark grey for incoming (light mode)
          'incoming-dark': '#202c33',    // Dark grey for incoming (dark mode)
          outgoing: '#005c4b',            // Green for outgoing (light mode)
          'outgoing-dark': '#005c4b',    // Green for outgoing (dark mode)
          // Background colors
          background: '#efeae2',          // Light beige (light mode)
          'background-dark': '#0b141a',  // Very dark (dark mode)
          'panel': '#f0f2f5',
          'panel-dark': '#111b21',
          'header': '#f0f2f5',
          'header-dark': '#202c33',
          'border': '#e9edef',
          'border-dark': '#2a3942',
          // Text colors
          'text': '#111111',
          'text-dark': '#e9edef',
          'text-secondary': '#667781',
          'text-secondary-dark': '#8696a0',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Lucida Grande', 'Arial', 'Ubuntu', 'Cantarell', 'Fira Sans', 'sans-serif'],
      },
      keyframes: {
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'slide-down': 'slide-down 0.3s ease-out',
      }
    },
  },
  plugins: [],
}

