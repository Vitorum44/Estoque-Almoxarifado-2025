// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDUp-LymsHkgAoul4vh79xJ7yi7WtJ0-Go",
  authDomain: "almoxarifado-87f56.firebaseapp.com",
  projectId: "almoxarifado-87f56",
  storageBucket: "almoxarifado-87f56.appspot.com",
  messagingSenderId: "692693247686",
  appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

// Inicializa Firebase corretamente
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

console.log("Firebase inicializado:", firebase.apps.length > 0);

// Evento de login
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const email = document.getElementById('login').value.trim();
    const senha = document.getElementById('senha').value.trim();
    const loginMessage = document.getElementById('loginMessage');

    if (!email || !senha) {
        loginMessage.innerText = "Por favor, preencha todos os campos.";
        loginMessage.style.color = "red";
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, senha);
        console.log("Login bem-sucedido:", userCredential.user);
        localStorage.setItem("user", userCredential.user.email);
        window.location.href = 'estoque.html';
    } catch (error) {
        console.error("Erro no login:", error.code, error.message);

        // Tratamento de erros específicos
        if (error.code === "auth/configuration-not-found") {
            loginMessage.innerText = "Erro de configuração no Firebase. Verifique as credenciais.";
        } else if (error.code === "auth/wrong-password") {
            loginMessage.innerText = "Senha incorreta. Tente novamente.";
        } else if (error.code === "auth/user-not-found") {
            loginMessage.innerText = "Usuário não encontrado. Verifique o e-mail.";
        } else if (error.code === "auth/invalid-email") {
            loginMessage.innerText = "Formato de e-mail inválido.";
        } else {
            loginMessage.innerText = "Erro ao autenticar. Verifique suas credenciais.";
        }

        loginMessage.style.color = "red";
        document.getElementById('loginForm').classList.add("shake");
        setTimeout(() => {
            document.getElementById('loginForm').classList.remove("shake");
        }, 500);
    }
});
