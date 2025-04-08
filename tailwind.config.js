/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class', // Activamos el modo oscuro basado en clases
  theme: {
    extend: {
      colors: {
        // Colores para tema oscuro inspirados en la referencia
        dark: {
          background: '#1E1E2D', // Fondo principal más suave
          sidebar: '#1A1A27', // Color para sidebar
          card: '#28293D', // Fondo de cards más claro
          cardHover: '#2E2F44', // Color hover para cards
          input: '#2B2C3E', // Fondo de inputs y controles
          border: '#32334A', // Bordes sutiles
          divider: '#383952', // Divisores
          text: '#FFFFFF', // Texto principal más brillante
          'text-secondary': '#C0C8E8', // Texto secundario más claro
          accent: '#A08CFF', // Acento principal aún más vibrante
          success: '#4DFFB4', // Verde éxito más saturado
          warning: '#FFCB5E', // Naranja advertencia más brillante
          error: '#FF7D8C', // Rojo error más brillante
          info: '#59F2FF', // Azul información más intenso
          chart: {
            purple: '#7367F0',
            blue: '#00CFE8',
            green: '#28C76F',
            yellow: '#FF9F43',
            red: '#EA5455',
            indigo: '#5A5EF8',
            cyan: '#16BDCA'
          }
        },
      },
      boxShadow: {
        'dark-card': '0 4px 24px 0 rgba(0,0,0,0.24)',
        'dark-hover': '0 6px 30px 0 rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
