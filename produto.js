const firebaseConfig = {
  apiKey: "AIzaSyBU5KMYU7mIRmS6v1nOif6arKJv5o7fBbI",
  authDomain: "almoxarifado-87f56.firebaseapp.com",
  projectId: "almoxarifado-87f56",
  storageBucket: "almoxarifado-87f56.appspot.com",
  messagingSenderId: "312250085459",
  appId: "1:312250085459:web:eeb54823b1ee32ab62b19e"
};


if (typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
} else {
  console.error("Firebase não foi carregado corretamente!");
}
const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", async function () {
  const produtosContainer = document.getElementById("produtos");
  const caixaBusca = document.getElementById("search-box");
  const suggestionsContainer = document.getElementById("search-suggestions");
  const categoriaSelect = document.getElementById("categoria-select");
  const subcategoriaSelect = document.getElementById("subcategoria-select");
  let todosProdutos = [];

  async function carregarCategorias() {
    const categoriasSet = new Set();
    const snapshot = await db.collection("estoque").get();
    snapshot.forEach(doc => {
      const { categoria } = doc.data();
      if (categoria) categoriasSet.add(categoria);
    });
    categoriaSelect.innerHTML = `<option value="todas">Todas</option>`;
    categoriasSet.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      categoriaSelect.appendChild(option);
    });
  }

  async function carregarSubcategorias() {
    const subcategoriasSet = new Set();
    const snapshot = await db.collection("estoque").get();
    snapshot.forEach(doc => {
      const { subcategoria } = doc.data();
      if (subcategoria) subcategoriasSet.add(subcategoria);
    });
    subcategoriaSelect.innerHTML = `<option value="todas">Todas</option>`;
    subcategoriasSet.forEach(sub => {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      subcategoriaSelect.appendChild(option);
    });
  }

  async function carregarTodosProdutos() {
    const snapshot = await db.collection("estoque").get();
    todosProdutos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function exibirProdutos(produtosFiltrados) {
    produtosContainer.innerHTML = "";
    produtosFiltrados.forEach(produto => {
      const divProduto = document.createElement("div");
      divProduto.classList.add("produto");
      divProduto.innerHTML = `
        <img src="${produto.imagem}" class="produto-img" alt="${produto.nome}">
        <h2>${produto.nome}</h2>
        <p>Categoria: ${produto.categoria || "Não informada"}</p>
        <p>Subcategoria: ${produto.subcategoria || "Não informada"}</p>
        <p>Data de Entrada: ${produto.dataEntrada || "Não informada"}</p>
        <p>
          Quantidade: 
          <input type="number" class="quantidade-input" value="${produto.quantidade}" data-id="${produto.id}" disabled>
          <button class="editar-icone" data-id="${produto.id}">
            <img src="./img/icone_editar.png" alt="Editar">
          </button>
        </p>
        <button class="salvar-btn" data-id="${produto.id}" style="display: none;">Salvar</button>
        <button class="excluir-btn" data-id="${produto.id}" style="display: none;">Excluir</button>
      `;
      produtosContainer.appendChild(divProduto);
    });

    ativarEventosEdicao();
  }

  function ativarEventosEdicao() {
    document.querySelectorAll(".editar-icone").forEach(botao => {
      botao.addEventListener("click", (event) => {
        const produtoId = event.target.closest("button").dataset.id;
        const campoQuantidade = document.querySelector(`.quantidade-input[data-id='${produtoId}']`);
        const botaoSalvar = document.querySelector(`.salvar-btn[data-id='${produtoId}']`);
        const botaoExcluir = document.querySelector(`.excluir-btn[data-id='${produtoId}']`);
        campoQuantidade.disabled = !campoQuantidade.disabled;
        if (!campoQuantidade.disabled) {
          campoQuantidade.focus();
          botaoSalvar.style.display = "inline-block";
          botaoExcluir.style.display = "inline-block";
        } else {
          botaoSalvar.style.display = "none";
          botaoExcluir.style.display = "none";
        }
      });
    });

    document.querySelectorAll(".salvar-btn").forEach(botao => {
      botao.addEventListener("click", async (event) => {
        const produtoId = event.target.dataset.id;
        const campoQuantidade = document.querySelector(`.quantidade-input[data-id='${produtoId}']`);
        const novaQuantidade = campoQuantidade.value;
        if (!isNaN(novaQuantidade) && novaQuantidade.trim() !== "") {
          await db.collection("estoque").doc(produtoId).update({ quantidade: novaQuantidade });
          alert("Quantidade atualizada com sucesso!");
          campoQuantidade.disabled = true;
          event.target.style.display = "none";
          document.querySelector(`.excluir-btn[data-id='${produtoId}']`).style.display = "none";
        } else {
          alert("Valor inválido! Digite um número válido.");
        }
      });
    });

    document.querySelectorAll(".excluir-btn").forEach(botao => {
      botao.addEventListener("click", async (event) => {
        const produtoId = event.target.dataset.id;
        if (confirm("Tem certeza que deseja excluir este produto?")) {
          await db.collection("estoque").doc(produtoId).delete();
          event.target.parentElement.remove();
          alert("Produto excluído com sucesso!");
        }
      });
    });
  }

  function filtrarProdutos() {
    const termoBusca = caixaBusca.value.toLowerCase().trim();
    const categoria = categoriaSelect.value;
    const subcategoria = subcategoriaSelect.value;

    const produtosFiltrados = todosProdutos.filter(produto => {
      const nomeOK = produto.nome.toLowerCase().includes(termoBusca);
      const categoriaOK = categoria === "todas" || produto.categoria === categoria;
      const subcategoriaOK = subcategoria === "todas" || produto.subcategoria === subcategoria;
      return nomeOK && categoriaOK && subcategoriaOK;
    });

    exibirProdutos(produtosFiltrados);
  }

  caixaBusca.addEventListener("input", () => {
    filtrarProdutos();
    const termoBusca = caixaBusca.value.toLowerCase().trim();
    suggestionsContainer.innerHTML = "";
    if (termoBusca === "") {
      suggestionsContainer.style.display = "none";
      return;
    }
    const resultados = todosProdutos.filter(produto =>
      produto.nome.toLowerCase().includes(termoBusca)
    );
    if (resultados.length > 0) {
      suggestionsContainer.style.display = "block";
      resultados.forEach(produto => {
        const item = document.createElement("div");
        item.classList.add("suggestion-item");
        const img = document.createElement("img");
        img.src = produto.imagem;
        img.classList.add("suggestion-img");
        const texto = document.createElement("span");
        texto.textContent = `${produto.nome} - ${produto.quantidade} unidades`;
        item.appendChild(img);
        item.appendChild(texto);
        item.addEventListener("click", () => {
          caixaBusca.value = produto.nome;
          suggestionsContainer.style.display = "none";
          filtrarProdutos();
        });
        suggestionsContainer.appendChild(item);
      });
    } else {
      suggestionsContainer.style.display = "none";
    }
  });

  document.addEventListener("click", (event) => {
    if (!caixaBusca.contains(event.target) && !suggestionsContainer.contains(event.target)) {
      suggestionsContainer.style.display = "none";
    }
  });

  categoriaSelect.addEventListener("change", filtrarProdutos);
  subcategoriaSelect.addEventListener("change", filtrarProdutos);

  await carregarCategorias();
  await carregarSubcategorias();
  await carregarTodosProdutos();
  filtrarProdutos();
});


  // Menu do usuário e logout
  const userIcon = document.querySelector(".user-icon");
  const logoutButton = document.getElementById("logoutButton");
  if (userIcon && logoutButton) {
    userIcon.addEventListener("click", () => logoutButton.classList.toggle("show"));
    logoutButton.addEventListener("click", () => window.location.href = "login.html");
  }

  // Cabeçalho animado ao rolar
  const header = document.querySelector("header");
  const logo = document.querySelector(".logo-bossa");
  const menu = document.querySelector(".menu-container");
  let lastScrollTop = 0;
  window.addEventListener("scroll", () => {
    let scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop) {
      header.style.height = "80px";
      logo.style.width = "100px";
      menu.style.opacity = "0";
    } else {
      header.style.height = "215px";
      logo.style.width = "120px";
      menu.style.opacity = "1";
    }
    lastScrollTop = scrollTop;
  });