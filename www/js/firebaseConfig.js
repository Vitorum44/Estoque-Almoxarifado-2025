// Importa os módulos do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Configuração do Firebase (substitua pelos seus dados reais do Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyDUp-LymsHkgAoul4vh79xJ7yi7WtJ0-Go",
    authDomain: "almoxarifado-87f56.firebaseapp.com",
    projectId: "almoxarifado-87f56",
    storageBucket: "almoxarifado-87f56.firebasestorage.app",
    messagingSenderId: "692693247686",
    appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
