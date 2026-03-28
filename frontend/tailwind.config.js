/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-jb-purple', 'bg-jb-accent', 'bg-jb-orange', 'bg-emerald-500',
    'from-jb-purple', 'from-jb-accent', 'from-jb-orange', 'from-emerald-500',
    'to-jb-purple', 'to-jb-accent', 'to-jb-orange', 'to-emerald-500',
    'border-jb-purple', 'border-jb-accent', 'border-jb-orange',
    'text-jb-purple', 'text-jb-accent', 'text-jb-orange',
    'bg-jb-purple/5', 'bg-jb-accent/5', 'bg-jb-orange/5',
    'border-jb-purple/20', 'border-jb-accent/20', 'border-jb-orange/20',
  ],
  theme: {
    extend: {
      colors: {
        jb: {
          dark: '#020205',
          panel: '#050508',
          hover: '#12141C',
          border: 'rgba(255, 255, 255, 0.06)',  // Was 0.03
          text: '#C0C2C8',
          accent: '#3C71F7',
          'accent-400': '#5B8AF9',
          'accent-600': '#1d4ed8',
          'accent-glow': 'rgba(60,113,247,0.3)',
          purple: '#9D5BD2',
          'purple-400': '#B47DE0',
          'purple-600': '#6d28d9',
          'purple-glow': 'rgba(157,91,210,0.3)',
          orange: '#FB923C',
          'orange-400': '#FDAE6B',
          'orange-600': '#ea580c',
          'orange-glow': 'rgba(251,146,60,0.3)',
          cyan: '#06B6D4',
          'cyan-400': '#22D3EE',
          'cyan-600': '#0e7490',
          'cyan-glow': 'rgba(6,182,212,0.3)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter Tight', 'Inter', 'Plus Jakarta Sans', 'sans-serif'],
        header: ['Geist Sans', 'Inter Tight', 'sans-serif'],
      },
      backdropBlur: {
        '3xl': '40px',
      },
      animation: {
        'blob': 'blob 12s infinite',
        'slow-spin': 'spin 20s linear infinite',
        'border-flow': 'border-flow 3s linear infinite',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(60px, -80px) scale(1.15)' },
          '66%': { transform: 'translate(-40px, 40px) scale(0.9)' },
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
