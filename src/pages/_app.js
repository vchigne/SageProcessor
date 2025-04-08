import "../styles/globals.css";
import Layout from "../components/Layout";
import { useRouter } from "next/router";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "../services/queryClient";
import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  // Efecto para gestionar el tema
  useEffect(() => {
    // Para portal-externo, siempre tema claro sin importar la preferencia
    if (router.pathname.startsWith("/portal-externo")) {
      document.documentElement.classList.remove("dark");
      return;
    }
    
    // Para el resto de la aplicación, leer la preferencia guardada
    const storedTheme = localStorage.getItem('theme');
    
    // Por defecto usamos tema oscuro, o el tema guardado si existe
    const prefersDark = storedTheme === 'dark' || (storedTheme === null);
    
    // Aplicar el tema correspondiente
    document.documentElement.classList.toggle("dark", prefersDark);
  }, [router.pathname]);

  // Si la página tiene su propio layout, úsalo
  if (Component.getLayout) {
    return Component.getLayout(<Component {...pageProps} />);
  }

  // Si es una ruta del portal externo o del historial, NO usar el layout general ni React Query
  // Portal externo y sus secciones tienen sus propios layouts
  if (router.pathname.startsWith("/portal-externo")) {
    return (
      <>
        <Component {...pageProps} />
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    );
  }

  // Para el resto de las páginas, usar el layout de SAGE con React Query
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <ToastContainer position="top-right" autoClose={3000} />
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  );
}
