// Copia este archivo como "config.js" y coloca tus propios datos.
// config.js está en .gitignore y NO debe subirse al repositorio.
window.PORCIGESTOR_CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_SUPABASE_ANON_KEY',

  // Usuarios de la app. rol: 'Administrador' (puede editar) o 'Lector' (solo ver)
  USUARIOS: [
    { email: 'admin@ejemplo.com', password: 'cambia-esta-clave', nombre: 'Administrador', rol: 'Administrador' },
    { email: 'demo@ejemplo.com',  password: 'demo1234',          nombre: 'Usuario Demo',  rol: 'Lector' },
  ],
};
