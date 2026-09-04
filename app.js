// FINANZAS APP - SUPABASE AUTH

const SUPABASE_URL = 'https://pghhvymhdfsfedppxquy.supabase.co';
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
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');

function showLogin(message = '') {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
  loginStatus.textContent = message;
}

function showDashboard(user) {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');

  const name =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';

  userName.textContent = name ? `, ${name.split(' ')[0]}` : '';
  userEmail.textContent = user?.email || '';
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
    console.error('Google OAuth:', error);
    loginStatus.textContent = 'No se pudo iniciar sesión con Google.';
    googleButton.disabled = false;
  }
});

appleButton.addEventListener('click', () => {
  loginStatus.textContent = 'El inicio de sesión con Apple lo configuraremos después.';
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error('Sign out:', error);
    logoutButton.disabled = false;
    return;
  }

  logoutButton.disabled = false;
  showLogin('Sesión cerrada correctamente.');
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    showDashboard(session.user);
  }

  if (event === 'SIGNED_OUT') {
    showLogin();
  }
});

async function initializeApp() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('Session:', error);
    showLogin('No pudimos comprobar tu sesión.');
    return;
  }

  if (data.session) {
    showDashboard(data.session.user);
  } else {
    showLogin();
  }
}

initializeApp();
