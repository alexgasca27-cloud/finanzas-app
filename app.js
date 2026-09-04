// Punto de entrada de la aplicación.
// Más adelante conectaremos aquí Supabase Auth, la base de datos y la IA.

const googleBtn = document.getElementById("googleBtn");
const appleBtn = document.getElementById("appleBtn");
const status = document.getElementById("status");

function comingSoon(provider) {
  status.textContent = `Inicio de sesión con ${provider}: lo conectaremos en el siguiente paso.`;
}

googleBtn.addEventListener("click", () => comingSoon("Google"));
appleBtn.addEventListener("click", () => comingSoon("Apple"));
