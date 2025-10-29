// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDUp-LymsHkgAoul4vh7yi7WtJ0-Go",
    authDomain: "almoxarifado-87f56.firebaseapp.com",
    projectId: "almoxarifado-87f56",
    storageBucket: "almoxarifado-87f56.appspot.com",
    messagingSenderId: "692693247686",
    appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIÁVEIS GLOBAIS ---
let todosItens = [];
let itensFiltrados = [];
let sortOrder = 'desc';
let paginaAtual = 1;
const itensPorPagina = 21;


// --- FUNÇÕES AUXILIARES ---
function normalizarString(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function converterImagemParaBase64(imagem, callback) {
    const leitor = new FileReader();
    leitor.readAsDataURL(imagem);
    leitor.onload = () => callback(leitor.result);
}


// --- FUNÇÕES DE UX (Notificações e Modais) ---
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao-toast ${tipo}`;
    notificacao.textContent = mensagem;
    document.body.appendChild(notificacao);
    setTimeout(() => { notificacao.classList.add('visivel'); }, 10);
    setTimeout(() => {
        notificacao.classList.remove('visivel');
        notificacao.addEventListener('transitionend', () => notificacao.remove());
    }, 3000);
}

function mostrarConfirmacao({ titulo, mensagem, textoConfirmar = 'Confirmar', classeConfirmar = 'btn-confirmar', onConfirm }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-ux-overlay';
    overlay.innerHTML = `
        <div class="modal-ux-content">
            <div class="modal-ux-titulo">${titulo}</div>
            <p class="modal-ux-mensagem">${mensagem}</p>
            <div class="modal-ux-botoes">
                <button class="btn-cancelar">Cancelar</button>
                <button class="${classeConfirmar}">${textoConfirmar}</button>
            </div>
        </div>`;
    const btnConfirmar = overlay.querySelector(`.${classeConfirmar}`);
    const btnCancelar = overlay.querySelector('.btn-cancelar');
    const fecharModal = () => {
        overlay.classList.remove('visivel');
        overlay.addEventListener('transitionend', () => overlay.remove());
    };
    btnConfirmar.addEventListener('click', () => { onConfirm(); fecharModal(); });
    btnCancelar.addEventListener('click', fecharModal);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('visivel'), 10);
}


// --- FUNÇÕES DE LÓGICA OCR (LEITURA DE NOTA FISCAL) ---
async function chamarVisionAPI(file) {
    const apiKey = 'AIzaSyA9o2iKSAoIj1VTMZ-yqCjIpG9FWDwFN2E';
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const base64ImageData = await toBase64(file);

    const requestBody = {
        requests: [{
            image: { content: base64ImageData },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`Erro da API: ${response.statusText}`);

        const data = await response.json();
        const textoCompleto = data.responses[0]?.fullTextAnnotation?.text;
        if (!textoCompleto) throw new Error("Nenhum texto foi encontrado na imagem.");
        return textoCompleto;

    } catch (error) {
        console.error("Erro ao chamar a Vision API:", error);
        mostrarNotificacao("Erro ao ler a imagem. Verifique o console.", "erro");
        return null;
    }
}


// --- FUNÇÕES DE EXPORTAR/IMPORTAR ---
function abrirModalExportarImportar() {
    const modalId = 'modal-export-import';
    if (document.getElementById(modalId)) return;

    const modalHTML = `
        <div class="overlay-exportar" id="${modalId}">
            <div class="conteudo-exportar">
                <button class="fechar-modal-edicao">&times;</button>
                <h2>Exportar ou Importar Dados</h2>
                <p class="subtitulo-painel">Selecione uma opção para gerenciar os dados do seu estoque.</p>
                
                <div class="abas-exportar">
                    <button class="aba-exportar ativa" data-aba="exportar">Exportar</button>
                    <button class="aba-exportar" data-aba="importar">Importar</button>
                </div>

                <div id="conteudo-aba-exportar" class="conteudo-aba">
                    <div class="area-exportar">
                        <p>Exporte a lista completa de produtos para um arquivo CSV.</p>
                        <button id="botao-exportar-final" class="botao-exportar-final">
                            <img src="./img/icone-seta-baixo.png" alt="Exportar">
                            <span>Exportar CSV</span>
                        </button>
                    </div>
                </div>
                
                <div id="conteudo-aba-importar" class="conteudo-aba" style="display:none;">
                     <div class="area-importar">
                        <p class="descricao-importar">Importe produtos a partir de um arquivo CSV. Certifique-se que o arquivo tenha as colunas: <strong>nome, quantidade, categoria, subcategoria, dataEntrada</strong>.</p>
                        <input type="file" id="input-importar-csv" accept=".csv" style="display:none;">
                        <div class="caixa-upload" id="caixa-upload-csv">
                            <label for="input-importar-csv" class="label-upload">
                                <span class="icone-mais">+</span>
                                <span>Clique ou arraste o arquivo CSV aqui</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById(modalId);
    const abas = modal.querySelectorAll('.aba-exportar');
    const conteudos = modal.querySelectorAll('.conteudo-aba');

    abas.forEach(aba => {
        aba.addEventListener('click', () => {
            abas.forEach(a => a.classList.remove('ativa'));
            aba.classList.add('ativa');
            const abaId = aba.dataset.aba;
            conteudos.forEach(c => {
                c.style.display = (c.id === `conteudo-aba-${abaId}`) ? 'block' : 'none';
            });
        });
    });

    modal.querySelector('.fechar-modal-edicao').addEventListener('click', () => modal.remove());
    modal.querySelector('#botao-exportar-final').addEventListener('click', exportarParaCSV);

    const inputImportar = modal.querySelector('#input-importar-csv');
    modal.querySelector('#caixa-upload-csv').addEventListener('click', () => inputImportar.click());
    inputImportar.addEventListener('change', importarDeCSV);
}

function exportarParaCSV() {
    if (todosItens.length === 0) {
        mostrarNotificacao("Não há itens para exportar.", "erro");
        return;
    }
    const dataParaExportar = todosItens.map(({ id, imagem, ...resto }) => resto);
    const csv = Papa.unparse(dataParaExportar);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "estoque.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacao("Exportação concluída com sucesso!", "sucesso");
}

function importarDeCSV(event) {
    const file = event.target.files[0];
    if (!file) {
        mostrarNotificacao("Nenhum arquivo selecionado.", "erro");
        return;
    }
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const batch = db.batch();
            results.data.forEach(item => {
                if (item.nome && item.quantidade) {
                    const docRef = db.collection("estoque").doc();
                    batch.set(docRef, {
                        nome: item.nome || "",
                        quantidade: parseInt(item.quantidade, 10) || 0,
                        categoria: item.categoria || "",
                        subcategoria: item.subcategoria || "",
                        dataEntrada: item.dataEntrada || new Date().toISOString().split('T')[0],
                        imagem: ""
                    });
                }
            });
            try {
                await batch.commit();
                mostrarNotificacao(`${results.data.length} itens importados com sucesso!`, "sucesso");
                carregarEstoque();
                document.getElementById('modal-export-import').remove();
            } catch (e) {
                mostrarNotificacao("Erro ao importar dados.", "erro");
            }
        },
        error: () => {
            mostrarNotificacao("Erro ao ler o arquivo CSV.", "erro");
        }
    });
}

// --- SALVAR ITENS DA NOTA ---
async function salvarItensDaNota() {
    const linhas = document.querySelectorAll("#ocr-tabela-confirmacao tr");
    if (linhas.length === 0) return;
    mostrarNotificacao("Salvando itens no estoque...");
    const promessas = [];
    for (const linha of linhas) {
        const imagemArquivo = linha.querySelector(".ocr-item-foto")?.files?.[0];
        const dadosItem = {
            nome: linha.querySelector(".ocr-item-nome").value.trim(),
            unid: linha.querySelector(".ocr-item-unid").value.trim(),
            quantidade: parseInt(linha.querySelector(".ocr-item-qtd").value, 10),
            dataEntrada: linha.querySelector(".ocr-item-data").value,
            categoria: linha.querySelector(".ocr-item-cat").value,
            subcategoria: linha.querySelector(".ocr-item-subcat").value,
            imagem: ""
        };
        if (!dadosItem.nome || isNaN(dadosItem.quantidade)) continue;

        const promessa = new Promise(async (resolve, reject) => {
            try {
                if (imagemArquivo) {
                    converterImagemParaBase64(imagemArquivo, async (imagemBase64) => {
                        dadosItem.imagem = imagemBase64;
                        const id = await salvarItemFirestore(dadosItem);
                        // registra uma entrada no histórico ao criar
                        await registrarHistorico({
                            idProduto: id,
                            nome: dadosItem.nome,
                            quantidade: dadosItem.quantidade,
                            status: "Entrada",
                            usuario: "Sistema"
                        });
                        resolve();
                    });
                } else {
                    const id = await salvarItemFirestore(dadosItem);
                    await registrarHistorico({
                        idProduto: id,
                        nome: dadosItem.nome,
                        quantidade: dadosItem.quantidade,
                        status: "Entrada",
                        usuario: "Sistema"
                    });
                    resolve();
                }
            } catch (error) { reject(error); }
        });
        promessas.push(promessa);
    }
    try {
        await Promise.all(promessas);
        mostrarNotificacao(`${linhas.length} itens foram salvos com sucesso!`, "sucesso");
        document.getElementById('modal-ocr')?.remove();
        carregarEstoque();
    } catch (error) {
        console.error("Erro ao salvar itens da nota:", error);
        mostrarNotificacao("Ocorreu um erro ao salvar os itens.", "erro");
    }
}


// --- FUNÇÕES DE MANIPULAÇÃO DO FIRESTORE ---
async function salvarItemFirestore(item) {
    const ref = await db.collection("estoque").add({
        ...item,
        dataEntrada: item.dataEntrada || new Date().toISOString().split('T')[0],
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

async function atualizarQuantidadeFirestore(id, novaQuantidade, acao = "Ajuste") {
    await db.collection("estoque").doc(id).update({ quantidade: novaQuantidade });
    const snap = await db.collection("estoque").doc(id).get();
    if (snap.exists) {
        const { nome } = snap.data();
        await registrarHistorico({
            idProduto: id,
            nome,
            quantidade: novaQuantidade,
            status: acao,
            usuario: "Sistema"
        });
    }
}

async function removerItemFirestore(id) {
    const ref = db.collection("estoque").doc(id);
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data();
        await registrarHistorico({
            idProduto: id,
            nome: data?.nome || "Item",
            quantidade: data?.quantidade || 0,
            status: "Baixa no Estoque",
            usuario: "Sistema"
        });
    }
    await ref.delete();
}


// --- FUNÇÕES DE FILTRO E RENDERIZAÇÃO ---
function filtrarEAtualizarTabela() {
    const termo = normalizarString(document.getElementById("busca-geral")?.value?.trim());
    itensFiltrados = (!termo || termo === "")
        ? [...todosItens]
        : todosItens.filter(item =>
            normalizarString(item.nome).includes(termo) ||
            normalizarString(item.categoria).includes(termo) ||
            normalizarString(item.subcategoria).includes(termo)
        );

    paginaAtual = 1;
    mostrarPagina(paginaAtual);
    renderizarPaginacao();
    atualizarContadorTexto();
}

function filtrarPorMenu(termo) {
    const buscaInput = document.getElementById("busca-geral");
    if (buscaInput) {
        buscaInput.value = termo;
        buscaInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function filtrarPorCategoriaEsubcategoria(categoria, subcategoria) {
    const cat = normalizarString(categoria);
    const sub = normalizarString(subcategoria);

    itensFiltrados = todosItens.filter(item =>
        normalizarString(item.categoria) === cat &&
        normalizarString(item.subcategoria) === sub
    );

    const busca = document.getElementById("busca-geral");
    if (busca) busca.value = `${categoria} / ${subcategoria}`;

    paginaAtual = 1;
    mostrarPagina(paginaAtual);
    renderizarPaginacao();
    atualizarContadorTexto();
}


/* --- ORDENAR ITENS (por dataEntrada, com fallback por nome) --- */
function ordenarItens() {
    todosItens.sort((a, b) => {
        const aDate = (a.dataEntrada || '').toString();
        const bDate = (b.dataEntrada || '').toString();

        const cmpData = (sortOrder === 'desc')
            ? bDate.localeCompare(aDate)
            : aDate.localeCompare(bDate);

        if (cmpData !== 0) return cmpData;

        return (a.nome || '').localeCompare(b.nome || '');
    });
}

async function carregarEstoque() {
    const snapshot = await db.collection("estoque").get();
    todosItens = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            quantidade: parseInt(data.quantidade, 10) || 0 // ✅ força número
        };
    });

    ordenarItens();
    itensFiltrados = [...todosItens];

    mostrarPagina(paginaAtual);
    renderizarPaginacao();
    atualizarContadorTexto();
}


function mostrarPagina(pagina) {
  const cardGrid = document.getElementById("card-grid-container");
  if (!cardGrid) return;

  cardGrid.innerHTML = "";

  const inicio = (pagina - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;

  // passa o objeto inteiro pro card builder
  itensFiltrados.slice(inicio, fim).forEach((it) => adicionarItemAoDOM(it));
}


function renderizarPaginacao() {
    const container = document.getElementById("paginacao-container");
    if (!container) return;

    container.innerHTML = "";

    const totalPaginas = Math.ceil(itensFiltrados.length / itensPorPagina);

    if (paginaAtual > 1) {
        const btnAnterior = document.createElement("button");
        btnAnterior.textContent = "Anterior";
        btnAnterior.onclick = () => {
            paginaAtual--;
            mostrarPagina(paginaAtual);
            renderizarPaginacao();
        };
        container.appendChild(btnAnterior);
    }

    for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        if (i === paginaAtual) btn.classList.add("ativo");
        btn.onclick = () => {
            paginaAtual = i;
            mostrarPagina(paginaAtual);
            renderizarPaginacao();
        };
        container.appendChild(btn);
    }

    if (paginaAtual < totalPaginas) {
        const btnProximo = document.createElement("button");
        btnProximo.textContent = "Próximo";
        btnProximo.onclick = () => {
            paginaAtual++;
            mostrarPagina(paginaAtual);
            renderizarPaginacao();
        };
        container.appendChild(btnProximo);
    }
}

function atualizarContadorTexto() {
    const contadorTexto = document.getElementById("contador-texto");
    if (contadorTexto) {
        contadorTexto.textContent = `${itensFiltrados.length} produto${itensFiltrados.length !== 1 ? 's' : ''}`;
    }
}


function adicionarItemAoDOM(prod) {
  if (!prod) return; // segurança
  const {
    id,
    imagem,
    nome,
    dataEntrada,
    quantidade,
    categoria,
    subcategoria
  } = prod;

  const cardGrid = document.getElementById("card-grid-container");
  if (!cardGrid) return;

  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = id;
  card.setAttribute("data-categoria", categoria || "");
  card.setAttribute("data-subcategoria", subcategoria || "");

  const temImagemValida =
    imagem && (imagem.startsWith("http") || imagem.startsWith("./") || imagem.startsWith("data:image"));
  const imagemSrc = temImagemValida ? imagem : "https://via.placeholder.com/150?text=Sem+Imagem";

  card.innerHTML = `
    <div class="card-image-container">
      <img src="${imagemSrc}" alt="${nome || ""}" class="card-image">
    </div>
    <div class="card-content">
      <div class="card-category">${categoria || ""}${subcategoria ? ` / ${subcategoria}` : ""}</div>
      <h3 class="card-title">${nome || ""}</h3>
      <div class="card-details">
        <span>Qtd: <strong>${Number.isFinite(quantidade) ? quantidade : 0}</strong></span>
        <span>Entrada: ${dataEntrada || "N/A"}</span>
      </div>
    </div>
    <div class="card-actions">
      <button class="botao-acao-tabela editar-item" title="Editar Item">✏️</button>
      <button class="botao-acao-tabela remover-item" title="Remover Item">🗑️</button>
      <button class="botao-acao-tabela historico-item" title="Ver Histórico">📜</button>
    </div>
  `;

  cardGrid.appendChild(card);

  card.querySelector(".editar-item")?.addEventListener("click", () => {
  const itemAtual = todosItens.find((x) => x.id === id);
  if (itemAtual) abrirEditarProduto(itemAtual); // ✅ chama o modal profissional
});


  card.querySelector(".remover-item")?.addEventListener("click", () => {
    mostrarConfirmacao({
      titulo: "Confirmar Remoção",
      mensagem: `Tem certeza que deseja remover "${nome}"?`,
      textoConfirmar: "Remover",
      classeConfirmar: "btn-perigo",
      onConfirm: async () => {
        await removerItemFirestore(id);
        mostrarNotificacao(`"${nome}" foi removido com sucesso.`);
        carregarEstoque();
      }
    });
  });

  card.querySelector(".historico-item")?.addEventListener("click", () => {
    mostrarModalHistorico(id, nome);
  });
}



// --- HISTÓRICO DE ITENS ---
function mostrarModalHistorico(idProduto, nomeMaterial) {
    // remove modal antigo se existir (evita duplicação)
    document.getElementById("historico-modal")?.remove();

    const modalHtml = `
        <div id="historico-modal" class="historico-modal">
            <div class="historico-conteudo">
                <span class="fechar-modal" role="button" aria-label="Fechar">&times;</span>
                <h2>Histórico de "${nomeMaterial}"</h2>
                <div id="historico-lista">Carregando histórico...</div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // impede fechamento ao clicar dentro do conteúdo
    const modal = document.getElementById("historico-modal");
    modal.addEventListener("click", (e) => {
        if (e.target.id === "historico-modal") modal.remove();
    });
    modal.querySelector(".fechar-modal").addEventListener("click", () => modal.remove());

    carregarHistorico(idProduto);
}

// função genérica para registrar
async function registrarHistorico({ idProduto, nome, quantidade, status, usuario }) {
    try {
        await db.collection("historico").add({
            idProduto,
            nome,
            quantidade,
            status,
            usuario: usuario || "Sistema",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao registrar histórico:", error);
    }
}

async function carregarHistorico(idProduto) {
    const container = document.getElementById("historico-lista");
    if (!container) return;
    container.innerHTML = "Carregando...";

    try {
        // tenta usar orderBy (requer índice composto)
        const q = db.collection("historico")
            .where("idProduto", "==", idProduto)
            .orderBy("timestamp", "desc");

        const snapshot = await q.get();

        if (snapshot.empty) {
            container.innerHTML = '<p>Nenhum registro encontrado.</p>';
            return;
        }

        container.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataHora = data.timestamp ? data.timestamp.toDate() : new Date();
            container.insertAdjacentHTML("beforeend", formatarHistorico(data, dataHora));
        });
    } catch (err) {
        console.warn("⚠️ Sem índice para consulta com orderBy. Usando fallback...", err);

        // fallback sem orderBy → busca e ordena no JS
        const q = db.collection("historico").where("idProduto", "==", idProduto);
        const snapshot = await q.get();

        if (snapshot.empty) {
            container.innerHTML = '<p>Nenhum registro encontrado.</p>';
            return;
        }

        const registros = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataHora = data.timestamp ? data.timestamp.toDate() : new Date();
            registros.push({ data: dataHora, html: formatarHistorico(data, dataHora) });
        });

        registros
            .sort((a, b) => b.data - a.data)
            .forEach(reg => container.insertAdjacentHTML("beforeend", reg.html));
    }
}

function formatarHistorico(data, dataHora) {
    const dia = String(dataHora.getDate()).padStart(2, '0');
    const mes = String(dataHora.getMonth() + 1).padStart(2, '0');
    const ano = dataHora.getFullYear();
    const hora = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataFormatada = `${dia}/${mes}/${ano} às ${hora}`;

    const responsavel = data.usuario || "Desconhecido";
    let tipo, classe, icone, detalhes;

    if (data.status === "Baixa no Estoque" || data.status === "Saída") {
        tipo = "SAÍDA"; classe = "saida"; icone = "↓";
        detalhes = `Baixa definitiva de <strong>${data.quantidade} un.</strong> por <strong>${responsavel}</strong>.`;
    } else if (data.status === "Devolvido" || data.status === "Parcialmente Devolvido" || data.status === "Entrada") {
        tipo = "ENTRADA"; classe = "entrada"; icone = "↑";
        detalhes = `${data.status} de <strong>${data.quantidade} un.</strong> por <strong>${responsavel}</strong>.`;
    } else {
        tipo = "MOV"; classe = "movimentacao"; icone = "⇆";
        detalhes = `${data.status} - <strong>${data.quantidade} un.</strong> (${responsavel})`;
    }

    return `
        <div class="historico-item-timeline">
            <div class="timeline-marker">
                <div class="timeline-icon ${classe}">${icone}</div>
            </div>
            <div class="historico-detalhes-container">
                <p><span class="historico-badge ${classe}">${tipo}</span></p>
                <p class="historico-detalhes">${detalhes}</p>
                <p class="historico-data">${dataFormatada}</p>
            </div>
        </div>`;
}


// --- CATEGORIAS E SUBCATEGORIAS ---
async function carregarCategoriasNoMenu() {
    const dropdownContainer = document.querySelector(".dropdown-categorias");
    // seu HTML atual não tem esse container — então, só sai se não existir
    if (!dropdownContainer) return;

    try {
        const snapshot = await db.collection("categorias").get();
        if (snapshot.empty) {
            dropdownContainer.innerHTML = '<p style="color: #555; padding: 10px;">Nenhuma categoria cadastrada.</p>';
            return;
        }

        const categoriasMap = new Map();
        snapshot.forEach(doc => {
            const { categoria, subcategoria } = doc.data();
            if (!categoria) return;
            if (!categoriasMap.has(categoria)) {
                categoriasMap.set(categoria, new Set());
            }
            if (subcategoria) {
                categoriasMap.get(categoria).add(subcategoria);
            }
        });

        dropdownContainer.innerHTML = '';
        const multiColumnWrapper = document.createElement('div');
        multiColumnWrapper.className = 'categorias-wrapper';

        for (const [categoriaNome, subcategorias] of categoriasMap.entries()) {
            const categoriaDiv = document.createElement('div');
            categoriaDiv.className = 'categoria';
            const categoriaTitle = document.createElement('h4');
            categoriaTitle.textContent = categoriaNome;
            categoriaTitle.addEventListener('click', (event) => {
                event.preventDefault();
                filtrarPorMenu(categoriaNome);
            });
            categoriaDiv.appendChild(categoriaTitle);

            if (subcategorias.size > 0) {
                const subcategoriaList = document.createElement('ul');
                [...subcategorias].sort().forEach(sub => {
                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = "#";
                    link.textContent = sub;
                    link.addEventListener('click', (event) => {
                        event.preventDefault();
                        filtrarPorCategoriaEsubcategoria(categoriaNome, sub);
                    });
                    item.appendChild(link);
                    subcategoriaList.appendChild(item);
                });
                categoriaDiv.appendChild(subcategoriaList);
            }
            multiColumnWrapper.appendChild(categoriaDiv);
        }

        dropdownContainer.appendChild(multiColumnWrapper);

    } catch (error) {
        console.error("Erro ao carregar categorias no menu:", error);
        dropdownContainer.innerHTML = '<p style="color: red; padding: 15px;">Erro ao carregar.</p>';
    }
}

async function preencherSelectsCategoriaSubcategoria(categoriaSelect, subcategoriaSelect) {
    if (!categoriaSelect || !subcategoriaSelect) return;
    const snapshot = await db.collection("categorias").get();
    const categoriasMap = {};
    snapshot.forEach(doc => {
        const { categoria, subcategoria } = doc.data();
        if (!categoriasMap[categoria]) categoriasMap[categoria] = new Set();
        if (subcategoria) categoriasMap[categoria].add(subcategoria);
    });
    categoriaSelect.innerHTML = '<option value="">Todas</option>';
    Object.keys(categoriasMap).sort().forEach(cat => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        categoriaSelect.appendChild(option);
    });
    categoriaSelect.addEventListener("change", () => {
        const categoriaSelecionada = categoriaSelect.value;
        const subcategorias = categoriasMap[categoriaSelecionada] || [];
        subcategoriaSelect.innerHTML = '<option value="">Todas</option>';
        [...subcategorias].sort().forEach(sub => {
            const option = document.createElement("option");
            option.value = sub;
            option.textContent = sub;
            subcategoriaSelect.appendChild(option);
        });
    });
}


// --- MODAL DE EDIÇÃO ---
async function abrirModalEdicao(item) {
    document.querySelector('.modal-edicao-overlay')?.remove();

    const modalHtml = `
        <div class="modal-edicao-overlay">
            <div class="modal-edicao-content">
                <button class="fechar-modal-edicao">&times;</button>
                <h2>Editar Produto</h2>
                <div class="form-group-edicao">
                    <label for="edit-nome-item">Nome do Produto</label>
                    <input type="text" id="edit-nome-item" value="${item.nome}">
                </div>
                <div class="form-group-edicao">
                    <label for="edit-quantidade-item">Quantidade</label>
                    <input type="number" id="edit-quantidade-item" value="${item.quantidade}">
                </div>
                <div class="form-group-edicao">
                    <label for="edit-categoria-item">Categoria</label>
                    <select id="edit-categoria-item"></select>
                </div>
                <div class="form-group-edicao">
                    <label for="edit-subcategoria-item">Subcategoria</label>
                    <select id="edit-subcategoria-item"></select>
                </div>
                <button id="salvar-edicao-btn">Salvar Alterações</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const overlay = document.querySelector('.modal-edicao-overlay');
    const categoriaSelect = document.getElementById('edit-categoria-item');
    const subcategoriaSelect = document.getElementById('edit-subcategoria-item');

    await preencherSelectsCategoriaSubcategoria(categoriaSelect, subcategoriaSelect);
    categoriaSelect.value = item.categoria || '';
    categoriaSelect.dispatchEvent(new Event('change'));

    setTimeout(() => {
        subcategoriaSelect.value = item.subcategoria || '';
    }, 80);

    document.getElementById('salvar-edicao-btn').addEventListener('click', async () => {
        const dadosAtualizados = {
            nome: document.getElementById('edit-nome-item').value.trim(),
            quantidade: parseInt(document.getElementById('edit-quantidade-item').value, 10),
            categoria: categoriaSelect.value,
            subcategoria: subcategoriaSelect.value
        };

        try {
            await db.collection('estoque').doc(item.id).update(dadosAtualizados);
            mostrarNotificacao("Produto atualizado com sucesso!");
            overlay.remove();
            carregarEstoque();
        } catch (error) {
            console.error("Erro ao atualizar o item:", error);
            mostrarNotificacao("Erro ao salvar as alterações.", "erro");
        }
    });

    overlay.querySelector('.fechar-modal-edicao').addEventListener('click', () => {
        overlay.remove();
    });
}


// --- EVENTOS PRINCIPAIS ---
document.addEventListener("DOMContentLoaded", () => {
    // 🔍 Busca geral
    document.getElementById("busca-geral")?.addEventListener("input", filtrarEAtualizarTabela);

    
    // --- LÓGICA PARA BOTÕES DE AÇÃO (Desktop e Mobile) ---

    // 📄 Exportar/Importar
    document.getElementById("botao-exportar-importar")?.addEventListener("click", abrirModalExportarImportar);
    document.getElementById("botao-exportar-importar_mobile")?.addEventListener("click", (e) => {
        e.preventDefault(); // Links <a> precisam disso
        abrirModalExportarImportar();
    });

    // ➕ Cadastrar Categoria
    const abrirModalCategoria = (e) => {
        if (e) e.preventDefault();
        document.getElementById("modal-categoria").style.display = "flex";
    };
    document.getElementById("toggleCategoriaBtn")?.addEventListener("click", abrirModalCategoria);
    document.getElementById("toggleCategoriaBtn_mobile")?.addEventListener("click", abrirModalCategoria);
    
    // ➕ Adicionar Produto
    const modalProduto = document.getElementById("modal-produto"); // Definido aqui fora
    
    const abrirModalProduto = (e) => {
        if (e) e.preventDefault();
        if (modalProduto) { // Checa se o elemento existe
            modalProduto.style.display = "flex";
            const hoje = new Date().toISOString().split("T")[0];
            document.getElementById("produto-data").value = hoje;
            preencherSelectsCategoriaSubcategoria(
                document.getElementById("produto-categoria"),
                document.getElementById("produto-subcategoria")
            );
        } else {
            console.error("Modal de produto não encontrado!");
        }
    };
    document.getElementById("toggleButton")?.addEventListener("click", abrirModalProduto);
    document.getElementById("toggleButton_mobile")?.addEventListener("click", abrirModalProduto);

    
    // 📸 Adicionar por NF (Botão que estava faltando!)
    const handleAdicionarNF = (e) => {
        if (e) e.preventDefault();
        
        // 1. Cria um input de arquivo temporário
        const inputArquivo = document.createElement('input');
        inputArquivo.type = 'file';
        inputArquivo.accept = 'image/*'; // Aceita imagens
        
        // 2. Ouve a seleção do arquivo
        inputArquivo.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) {
                mostrarNotificacao("Nenhuma imagem selecionada.", "erro");
                return;
            }
            
            mostrarNotificacao("Processando imagem da NF...", "sucesso");
            
            try {
                // 3. Chama a API (função que já existe)
                const textoOCR = await chamarVisionAPI(file);
                
                if (textoOCR) {
                    // 4. Se funcionar, mostra o texto no console (a lógica de processamento não existe)
                    console.log("Texto extraído da NF:", textoOCR);
                    mostrarNotificacao("Texto da NF extraído! (Verifique o console)", "sucesso");
                    // NOTA: A lógica para *processar* o texto (processarTextoOCR) 
                    // não existe no seu arquivo. Por enquanto, só exibimos o resultado.
                }
            } catch (error) {
                mostrarNotificacao("Erro ao processar a NF.", "erro");
                console.error(error);
            }
        };
        
        // 3. Clica no input de arquivo
        inputArquivo.click();
    };

    document.getElementById("botao-adicionar-nf")?.addEventListener("click", handleAdicionarNF);
    document.getElementById("botao-adicionar-nf_mobile")?.addEventListener("click", handleAdicionarNF);

    // --- FIM DOS BOTÕES DE AÇÃO ---


    // Fechar modal categoria
    document.getElementById("cancelar-categoria")?.addEventListener("click", () => {
        document.getElementById("modal-categoria").style.display = "none";
    });

    // Salvar categoria
    document.getElementById("salvar-categoria")?.addEventListener("click", async () => {
        const categoria = document.getElementById("nova-categoria").value.trim();
        const subInputs = document.querySelectorAll(".nova-subcategoria");

        if (!categoria) {
            mostrarNotificacao("O campo Categoria é obrigatório.", "erro");
            return;
        }

        try {
            const batch = db.batch();
            let contador = 0;
            subInputs.forEach(input => {
                const sub = input.value.trim();
                const ref = db.collection("categorias").doc();
                batch.set(ref, { categoria, subcategoria: sub || "" });
                contador++;
            });
            await batch.commit();

            mostrarNotificacao(`Categoria salva com ${contador} subcategoria(s)!`, "sucesso");

            document.getElementById("nova-categoria").value = "";
            document.getElementById("subcategorias-container").innerHTML = `
              <label>Subcategoria:</label>
              <div class="subcategoria-item">
                  <input type="text" class="nova-subcategoria" placeholder="Ex: Fios, Tomadas..." />
                  <button type="button" class="remover-subcategoria" aria-label="Remover">🗑️</button>
              </div>
              <button type="button" id="adicionar-subcategoria" class="btn-add-sub">➕ Adicionar Subcategoria</button>
            `;

            carregarCategoriasNoMenu();
            preencherSelectsCategoriaSubcategoria(
                document.getElementById("filtro-categoria"),
                document.getElementById("filtro-subcategoria")
            );

            document.getElementById("modal-categoria").style.display = "none";
        } catch (error) {
            console.error("Erro ao salvar categoria:", error);
            mostrarNotificacao("Erro ao salvar a categoria.", "erro");
        }
    });

    // ↕ Ordenar
    const botaoOrdenar = document.getElementById("botao-ordenar");
    if (botaoOrdenar) {
        botaoOrdenar.addEventListener("click", () => {
            sortOrder = (sortOrder === 'desc') ? 'asc' : 'desc';
            const span = botaoOrdenar.querySelector('span');
            if (span) span.innerText = (sortOrder === 'desc') ? 'Mais novo' : 'Mais antigo';
            ordenarItens();
            filtrarEAtualizarTabela();
        });
    }

    // 🎯 FILTRO LATERAL
    const filtroBtn = document.getElementById("filtrar-btn");
    const filtroPanel = document.getElementById("filtro-panel");
    const filtroOverlay = document.getElementById("filtro-overlay");
    const fecharFiltro = document.getElementById("fechar-filtro");
    const aplicarFiltro = document.getElementById("aplicar-filtro");
    const limparFiltro = document.getElementById("limpar-filtro");

    preencherSelectsCategoriaSubcategoria(
        document.getElementById('filtro-categoria'),
        document.getElementById('filtro-subcategoria')
    );

    if (filtroBtn && filtroPanel && filtroOverlay) {
        filtroBtn.addEventListener("click", () => {
            filtroPanel.classList.add("show");
            filtroOverlay.classList.add("show");
        });

        function fecharPainel() {
            filtroPanel.classList.remove("show");
            filtroOverlay.classList.remove("show");
        }
        fecharFiltro?.addEventListener("click", fecharPainel);
        filtroOverlay?.addEventListener("click", fecharPainel);

        aplicarFiltro?.addEventListener("click", () => {
            const categoriaSel = (document.getElementById("filtro-categoria").value || "").trim();
            const subcategoriaSel = (document.getElementById("filtro-subcategoria").value || "").trim();

            itensFiltrados = todosItens.filter((item) => {
                const matchCat = categoriaSel
                    ? normalizarString(item.categoria) === normalizarString(categoriaSel)
                    : true;
                const matchSub = subcategoriaSel
                    ? normalizarString(item.subcategoria) === normalizarString(subcategoriaSel)
                    : true;
                return matchCat && matchSub;
            });

            paginaAtual = 1;
            mostrarPagina(paginaAtual);
            renderizarPaginacao();
            atualizarContadorTexto();
            fecharPainel();
        });

        limparFiltro?.addEventListener("click", () => {
            document.getElementById("filtro-categoria").value = "";
            document.getElementById("filtro-subcategoria").value = "";
            itensFiltrados = [...todosItens];
            paginaAtual = 1;
            mostrarPagina(paginaAtual);
            renderizarPaginacao();
            atualizarContadorTexto();
        });
    }

    // === MODAL ADICIONAR PRODUTO ===
    const btnCancelarProduto = document.getElementById("cancelar-produto");
    const btnSalvarProduto = document.getElementById("salvar-produto");

    // Cancelar
    btnCancelarProduto?.addEventListener("click", () => {
        if (modalProduto) modalProduto.style.display = "none";
    });

    // Salvar
    btnSalvarProduto?.addEventListener("click", async () => {
        const nome = document.getElementById("produto-nome").value.trim();
        const quantidade = parseInt(document.getElementById("produto-quantidade").value, 10) || 0;
        const categoria = document.getElementById("produto-categoria").value;
        const subcategoria = document.getElementById("produto-subcategoria").value;
        const dataEntrada = document.getElementById("produto-data").value;
        const imagemFile = document.getElementById("produto-imagem").files[0];

        if (!nome || quantidade <= 0) {
            mostrarNotificacao("Preencha o nome e a quantidade corretamente.", "erro");
            return;
        }

        let imagemBase64 = "";
        if (imagemFile) {
            imagemBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(imagemFile);
            });
        }

        try {
            const id = await salvarItemFirestore({
                nome,
                quantidade,
                categoria,
                subcategoria,
                dataEntrada,
                imagem: imagemBase64
            });

            await registrarHistorico({
                idProduto: id,
                nome,
                quantidade,
                status: "Entrada",
                usuario: "Sistema"
            });

            mostrarNotificacao("Produto adicionado com sucesso!");
            if (modalProduto) modalProduto.style.display = "none";
            carregarEstoque();
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            mostrarNotificacao("Erro ao salvar produto.", "erro");
        }
    });


    // === MODAL EDITAR PRODUTO ===
const modalEditar = document.getElementById("modal-editar-produto");
const btnCancelarEditar = document.getElementById("cancelar-editar");
const btnSalvarEditar = document.getElementById("salvar-editar");

// Cancelar
btnCancelarEditar?.addEventListener("click", () => {
  modalEditar.style.display = "none";
});

// Função para abrir modal com dados
window.abrirEditarProduto = async (item) => {
  modalEditar.style.display = "flex";

  document.getElementById("editar-id").value = item.id;
  document.getElementById("editar-nome").value = item.nome;
  document.getElementById("editar-quantidade").value = item.quantidade;
  document.getElementById("editar-data").value = item.dataEntrada || "";

  const selectCategoria = document.getElementById("editar-categoria");
  const selectSubcategoria = document.getElementById("editar-subcategoria");

  // Aguarda preencher categorias e subcategorias antes de selecionar
  await preencherSelectsCategoriaSubcategoria(selectCategoria, selectSubcategoria);

  // Define categoria e subcategoria atuais
  selectCategoria.value = item.categoria || "";
  selectCategoria.dispatchEvent(new Event("change")); // atualiza subcategorias do select

  // Aguarda um pequeno delay para garantir que as subcategorias carregaram antes de definir
  setTimeout(() => {
    selectSubcategoria.value = item.subcategoria || "";
  }, 100);
};


// Salvar alterações
btnSalvarEditar?.addEventListener("click", async () => {
  const id = document.getElementById("editar-id").value;
  const nome = document.getElementById("editar-nome").value.trim();
  const quantidade = parseInt(document.getElementById("editar-quantidade").value, 10) || 0;
  const categoria = document.getElementById("editar-categoria").value;
  const subcategoria = document.getElementById("editar-subcategoria").value;
  const dataEntrada = document.getElementById("editar-data").value;
  const imagemFile = document.getElementById("editar-imagem").files[0];

  if (!id || !nome) {
    mostrarNotificacao("Preencha os campos corretamente.", "erro");
    return;
  }

  let imagemBase64 = "";
  if (imagemFile) {
    imagemBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(imagemFile);
    });
  }

  try {
    await db.collection("estoque").doc(id).update({
      nome,
      quantidade,
      categoria,
      subcategoria,
      dataEntrada,
      ...(imagemBase64 && { imagem: imagemBase64 })
    });

    mostrarNotificacao("Produto atualizado com sucesso!");
    modalEditar.style.display = "none";
    carregarEstoque();
  } catch (error) {
    console.error("Erro ao editar produto:", error);
    mostrarNotificacao("Erro ao editar produto.", "erro");
  }
});


    // 🚀 Chamadas iniciais
    carregarEstoque();
    carregarCategoriasNoMenu();
});


// ➕ Adicionar subcategoria (delegação) + 🗑️ remover
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("#adicionar-subcategoria");
  if (addBtn) {
    const container = document.getElementById("subcategorias-container");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "subcategoria-item";
    div.innerHTML = `
      <input type="text" class="nova-subcategoria" placeholder="Outra subcategoria..." />
      <button type="button" class="remover-subcategoria" aria-label="Remover subcategoria">🗑️</button>
    `;
    container.appendChild(div);
  }

  const removeBtn = e.target.closest(".remover-subcategoria");
  if (removeBtn) {
    removeBtn.closest(".subcategoria-item")?.remove();
  }
});

// --- MENU DE USUÁRIO / LOGOUT ---
document.addEventListener("DOMContentLoaded", () => {
  const userProfile = document.getElementById("userProfile");
  const logoutLink = document.getElementById("logoutLink");

  if (userProfile && logoutLink) {
    userProfile.addEventListener("click", () => {
      logoutLink.classList.toggle("show");
    });
  } else {
    console.warn("⚠️ Elementos de perfil ou logout não encontrados na sidebar.");
  }
});


// ==================== AUTO LOGOUT POR INATIVIDADE ====================
(function ativarAutoLogout() {
  const TEMPO_LIMITE = 30 * 60 * 1000; // 30 minutos em milissegundos
  let temporizadorLogout;

  function resetarTimer() {
    clearTimeout(temporizadorLogout);
    temporizadorLogout = setTimeout(() => {
      // Limpa qualquer dado de login salvo
      localStorage.removeItem("user");
      sessionStorage.clear();

      // Mostra aviso rápido antes do redirecionamento
      const aviso = document.createElement("div");
      aviso.className = "notificacao-toast erro";
      aviso.textContent = "Sessão expirada. Faça login novamente.";
      document.body.appendChild(aviso);
      setTimeout(() => { aviso.classList.add("visivel"); }, 10);

      setTimeout(() => {
        window.location.href = "login.html";
      }, 2500);
    }, TEMPO_LIMITE);
  }

  // Eventos que indicam atividade
  ["mousemove", "mousedown", "keypress", "scroll", "touchstart"].forEach(evt => {
    document.addEventListener(evt, resetarTimer, false);
  });

  resetarTimer(); // inicia o contador
})();


// Drawer mobile (hambúrguer)
(function () {
  const btn = document.getElementById('btnMobileMenu');
  const overlay = document.getElementById('sidebarOverlay');

  function openMenu(){
    document.body.classList.add('sidebar-open');
    btn?.setAttribute('aria-expanded','true');
    if (overlay) overlay.hidden = false;
  }
  function closeMenu(){
    document.body.classList.remove('sidebar-open');
    btn?.setAttribute('aria-expanded','false');
    setTimeout(() => { if (overlay) overlay.hidden = true; }, 200);
  }

  btn?.addEventListener('click', () => {
    document.body.classList.contains('sidebar-open') ? closeMenu() : openMenu();
  });

  overlay?.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // fecha ao clicar em um link do menu
  document.querySelectorAll('.sidebar a[href]').forEach(a => {
    a.addEventListener('click', () => closeMenu());
  });
})();