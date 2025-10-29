// Importa as funções do Firebase (Firestore e agora também o Storage)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDUp-LymsHkgAoul4vh79xJ7yi7WtJ0-Go",
    authDomain: "almoxarifado-87f56.firebaseapp.com",
    projectId: "almoxarifado-87f56",
    storageBucket: "almoxarifado-87f56.appspot.com", // Verifique se este nome está correto no seu projeto Firebase
    messagingSenderId: "692693247686",
    appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

// Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app); // Inicializa o Storage
const massasCollection = collection(db, "massas");

// --- FUNÇÕES DE LÓGICA ---
// (Estas funções ajudam a formatar datas e a verificar o vencimento)

function formatarDataBrasileira(dataISO) {
    if (!dataISO || !/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return dataISO;
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarDataISO(dataStr) {
    if (!dataStr || /^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
    const partes = dataStr.split("/");
    if (partes.length === 3) {
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
    return dataStr;
}

function vencimentoProximo(dataVencimento) {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);
    const diffDias = (vencimento - hoje) / (1000 * 60 * 60 * 24);
    return diffDias <= 30 && diffDias >= 0;
}

// --- FUNÇÕES DE INTERFACE ---
// (Estas funções controlam o que aparece no ecrã)

function adicionarMassaNaTela(massa) {
    const container = document.getElementById("massa-lista");
    if (!container) return;

    let novaMassa = document.createElement("div");
    novaMassa.classList.add("massa-item");
    novaMassa.setAttribute('data-id', massa.id);

    if (new Date(massa.vencimento) < new Date()) {
        novaMassa.classList.add("vencido");
    } else if (vencimentoProximo(massa.vencimento)) {
        novaMassa.classList.add("alerta-vencimento");
    }

    const alertaIcone = vencimentoProximo(massa.vencimento) || new Date(massa.vencimento) < new Date() ? "⚠️ " : "";

    novaMassa.innerHTML = `
        <img src="${massa.imagem}" alt="${massa.material}">
        <div class="info">
            <p><strong>Material:</strong> ${alertaIcone}${massa.material}</p>
            <p><strong>Fabricação:</strong> ${formatarDataBrasileira(massa.fabricacao)}</p>
            <p><strong>Validade:</strong> ${massa.validade} meses</p>
            <p><strong>Vencimento:</strong> ${formatarDataBrasileira(massa.vencimento)}</p>
            <p><strong>Quantidade:</strong> <input type="number" class="quantidade-input" value="${massa.quantidade}" disabled></p>
            <div class="actions">
                <button class="toggle-edit-btn">✏️ Editar</button>
                <button class="delete-btn">❌ Excluir</button>
            </div>
        </div>
    `;
    container.appendChild(novaMassa);
}


// --- LÓGICA PRINCIPAL (EVENTOS) ---
// (Esta parte faz os botões e formulários funcionarem)

// Evento para o formulário de adicionar nova massa
document.getElementById("formulario")?.addEventListener("submit", async function (event) {
    event.preventDefault();
    const submitButton = this.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerText = "A enviar...";

    const imagemInput = document.getElementById("imagem").files[0];
    const material = document.getElementById("material").value;
    const fabricacao = document.getElementById("fabricacao").value;
    const validade = document.getElementById("validade").value;
    const vencimento = document.getElementById("vencimento").value;
    const quantidade = document.getElementById("quantidade").value;

    if (!imagemInput) {
        alert('Por favor, selecione uma imagem.');
        submitButton.disabled = false;
        submitButton.innerText = "Adicionar";
        return;
    }

    try {
        const nomeFicheiro = `${Date.now()}-${imagemInput.name}`;
        const storageRef = ref(storage, `massas-imagens/${nomeFicheiro}`);
        const snapshot = await uploadBytes(storageRef, imagemInput);
        const imageUrl = await getDownloadURL(snapshot.ref);

        const novaMassa = {
            imagem: imageUrl,
            material,
            fabricacao,
            validade,
            vencimento,
            quantidade: Number(quantidade)
        };
        
        await addDoc(massasCollection, novaMassa);

        alert('Massa cadastrada com sucesso!');
        this.reset();
        document.getElementById("form-container")?.classList.add("hidden");
        document.getElementById("toggle-form-btn").innerText = "Cadastrar Nova Massa";

    } catch (error) {
        console.error("Erro no processo de upload: ", error);
        alert('Ocorreu um erro ao salvar. Verifique a consola para mais detalhes.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerText = "Adicionar";
    }
});

// Evento para os botões de editar, salvar e excluir na lista
document.getElementById("massa-lista")?.addEventListener("click", async function (event) {
    const target = event.target;
    const massaItem = target.closest(".massa-item");
    if (!massaItem) return;

    const docId = massaItem.getAttribute('data-id');

    if (target.classList.contains("delete-btn")) {
        if (confirm('Tem certeza que deseja excluir este item?')) {
            try {
                await deleteDoc(doc(db, "massas", docId));
                alert('Item excluído com sucesso.');
            } catch (error) {
                console.error("Erro ao excluir do Firestore: ", error);
                alert('Ocorreu um erro ao excluir.');
            }
        }
        return;
    }

    if (target.classList.contains("toggle-edit-btn")) {
        const quantidadeInput = massaItem.querySelector(".quantidade-input");
        const infoDiv = massaItem.querySelector(".info");
        const fabricacaoEl = infoDiv.querySelector("p:nth-child(2)");
        const validadeEl = infoDiv.querySelector("p:nth-child(3)");
        const vencimentoEl = infoDiv.querySelector("p:nth-child(4)");

        if (quantidadeInput.disabled) {
            quantidadeInput.disabled = false;
            target.innerText = "💾 Salvar";

            const fabricacaoTexto = fabricacaoEl.innerText.split(":")[1]?.trim() || "";
            const validadeTexto = validadeEl.innerText.split(":")[1]?.replace("meses", "").trim() || "";
            const vencimentoTexto = vencimentoEl.innerText.split(":")[1]?.trim() || "";

            fabricacaoEl.innerHTML = `<strong>Fabricação:</strong> <input type="date" class="fabricacao-input" value="${formatarDataISO(fabricacaoTexto)}">`;
            validadeEl.innerHTML = `<strong>Validade:</strong> <input type="number" class="validade-input" value="${validadeTexto}"> meses`;
            vencimentoEl.innerHTML = `<strong>Vencimento:</strong> <input type="date" class="vencimento-input" value="${formatarDataISO(vencimentoTexto)}">`;
        } else {
            const novaQuantidade = massaItem.querySelector(".quantidade-input").value;
            const novaFabricacao = massaItem.querySelector(".fabricacao-input").value;
            const novaValidade = massaItem.querySelector(".validade-input").value;
            const novoVencimento = massaItem.querySelector(".vencimento-input").value;

            if (novaQuantidade.trim() === "") {
                alert("A quantidade não pode estar vazia!");
                return;
            }

            const dadosAtualizados = {
                quantidade: Number(novaQuantidade),
                fabricacao: novaFabricacao,
                validade: novaValidade,
                vencimento: novoVencimento
            };

            try {
                await updateDoc(doc(db, "massas", docId), dadosAtualizados);
                alert('Alterações salvas com sucesso!');
            } catch (error) {
                console.error("Erro ao atualizar no Firestore: ", error);
                alert('Ocorreu um erro ao salvar as alterações.');
            }
        }
    }
});

// Eventos para os botões gerais da página
document.getElementById("toggle-form-btn")?.addEventListener("click", function () {
    let formContainer = document.getElementById("form-container");
    if (formContainer) {
        formContainer.classList.toggle("hidden");
        this.innerText = formContainer.classList.contains("hidden") ? "Cadastrar Nova Massa" : "Ocultar Cadastro";
    }
});

document.getElementById("print-btn")?.addEventListener("click", () => window.print());

// --- SINCRONIZAÇÃO COM O BANCO DE DADOS ---

onSnapshot(massasCollection, (snapshot) => {
    const container = document.getElementById("massa-lista");
    if (!container) return;
    container.innerHTML = '';
    snapshot.docs.forEach(documento => {
        adicionarMassaNaTela({ id: documento.id, ...documento.data() });
    });
});


// --- CÓDIGO DO CABEÇALHO ---

const header = document.querySelector(".main-header");
const logo = document.querySelector(".logo img");
const menu = document.querySelector(".menu");
let lastScrollTop = 0;
window.addEventListener("scroll", () => {
    if (!header) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    header.style.height = scrollTop > lastScrollTop ? "80px" : "215px";
    if (logo) logo.style.width = scrollTop > lastScrollTop ? "100px" : "200px";
    if (menu) menu.style.opacity = scrollTop > lastScrollTop ? "0" : "1";
    lastScrollTop = scrollTop;
});

const userIcon = document.querySelector(".user-icon");
const logoutButton = document.getElementById("logoutButton");
if (userIcon && logoutButton) {
    userIcon.addEventListener("click", () => logoutButton.classList.toggle("show"));
    logoutButton.addEventListener("click", () => window.location.href = "login.html");
}