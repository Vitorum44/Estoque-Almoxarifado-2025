// ✅ Inicializa Firebase (compat)
const firebaseConfig = {
  apiKey: "AIzaSyDUp-LymsHkgAoul4vh79xJ7yi7WtJ0-Go",
  authDomain: "almoxarifado-87f56.firebaseapp.com",
  projectId: "almoxarifado-87f56",
  storageBucket: "almoxarifado-87f56.appspot.com",
  messagingSenderId: "692693247686",
  appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 🔍 Obtém o ID do produto via URL
const params = new URLSearchParams(window.location.search);
const idProduto = params.get("id");

if (!idProduto) {
  alert("Produto não encontrado.");
  throw new Error("ID do produto ausente.");
}

async function carregarProduto() {
  try {
    const docRef = db.collection("estoque").doc(idProduto);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      alert("Produto não encontrado.");
      return;
    }

    const dados = docSnap.data();

    document.getElementById("imagem-produto").src = dados.imagem || "";
    document.getElementById("nome-produto").textContent = dados.nome;
    document.getElementById("descricao-produto").textContent = dados.descricaoLonga || "Descrição não cadastrada.";

    // ✅ QR Code
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = ""; // Limpa antes
    QRCode.toCanvas(document.createElement("canvas"), `ID: ${idProduto}`, { width: 160 }, function (err, canvas) {
      if (!err) qrContainer.appendChild(canvas);
    });

    // ✅ Histórico
    await carregarHistorico(idProduto);

    // ✅ Galeria
    carregarGaleria(dados.galeria || []);
  } catch (error) {
    console.error("Erro ao carregar produto:", error);
  }
}

async function carregarHistorico(id) {
  const ul = document.getElementById("historico-lista");
  ul.innerHTML = "";

  const snapshot = await db.collection("historico").where("idProduto", "==", id).get();

  snapshot.forEach((doc) => {
    const h = doc.data();
    const li = document.createElement("li");
    li.textContent = `[${h.data || ""}] ${h.tipo} - ${h.quantidade} - ${h.usuario || ""}`;
    ul.appendChild(li);
  });
}

function carregarGaleria(imagens) {
  const galeria = document.getElementById("galeria-imagens");
  galeria.innerHTML = "";
  imagens.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.style.width = "150px";
    img.style.margin = "8px";
    img.style.borderRadius = "10px";
    img.style.objectFit = "cover";
    galeria.appendChild(img);
  });
}

carregarProduto();
