// FINANZAS APP - SUPABASE AUTH + DASHBOARD

const SUPABASE_URL = 'https://pghhvymhdfsfedppxquy.supabase.co';

// Publishable Key de Supabase.
// Nunca colocar aquí una Secret Key / service_role.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jhL89bDrMEJKsuStNkp0kw_daup7Rna';

const REDIRECT_URL = 'https://alexgasca27-cloud.github.io/finanzas-app/';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const googleButton = document.getElementById('google-login');
const appleButton = document.getElementById('apple-login');
const logoutButton = document.getElementById('logout-button');
const loginStatus = document.getElementById('login-status');
const welcomeText = document.getElementById('welcome-text');

function showLogin() {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard(user) {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');

  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'usuario';

  welcomeText.textContent = `Sesión activa: ${name}`;
}

googleButton.addEventListener('click', async () => {
  googleButton.disabled = true;
  loginStatus.textContent = 'Conectando con Google...';

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: REDIRECT_URL
    }
  });

  if (error) {
    console.error('Error Google OAuth:', error);
    loginStatus.textContent = 'No se pudo iniciar sesión con Google.';
    googleButton.disabled = false;
  }
});

appleButton.addEventListener('click', () => {
  loginStatus.textContent = 'El inicio de sesión con Apple lo configuraremos después.';
});

logoutButton.addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error('Error al cerrar sesión:', error);
    return;
  }

  showLogin();
  loginStatus.textContent = 'Sesión cerrada correctamente.';
  googleButton.disabled = false;
});

async function initializeApp() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('Error al obtener sesión:', error);
    showLogin();
    return;
  }

  if (data.session) {
    showDashboard(data.session.user);
  } else {
    showLogin();
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    showDashboard(session.user);
  }

  if (event === 'SIGNED_OUT') {
    showLogin();
  }
});

initializeApp();
