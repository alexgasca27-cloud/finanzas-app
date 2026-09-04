// FINANZAS APP - SUPABASE AUTH

const SUPABASE_URL = 'https://pghhvymhdfsfedppxquy.supabase.co';

// Pega aquí la Publishable Key de Supabase.
// NUNCA pongas aquí la Secret Key / service_role.
const SUPABASE_PUBLISHABLE_KEY = 'PEGA_AQUI_TU_PUBLISHABLE_KEY';

const REDIRECT_URL = 'https://alexgasca27-cloud.github.io/finanzas-app/';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const googleButton = document.getElementById('google-login');
const appleButton = document.getElementById('apple-login');
const statusElement = document.getElementById('status');

function setStatus(message) {
  statusElement.textContent = message;
}

googleButton.addEventListener('click', async () => {
  if (SUPABASE_PUBLISHABLE_KEY === 'PEGA_AQUI_TU_PUBLISHABLE_KEY') {
    setStatus('Primero configura la Publishable Key de Supabase en app.js.');
    return;
  }

  googleButton.disabled = true;
  setStatus('Conectando con Google...');

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_URL }
  });

  if (error) {
    console.error(error);
    setStatus('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    googleButton.disabled = false;
  }
});

appleButton.addEventListener('click', () => {
  setStatus('El inicio de sesión con Apple lo configuraremos después.');
});

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  if (data.session) {
    setStatus(`Sesión iniciada como ${data.session.user.email || 'usuario'}.`);
  }
}

checkSession();

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    setStatus(`Sesión iniciada como ${session.user.email || 'usuario'}.`);
    console.log('Usuario autenticado:', session.user);
  }
});
