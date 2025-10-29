// Importações Firebase (Corrigido ✅)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, enableIndexedDbPersistence, collection, query, where, getDocs, setDoc, doc, updateDoc, deleteDoc, addDoc, Timestamp, writeBatch, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDUp-LymsHkgAoul4vh79xJ7yi7WtJ0-Go",
  authDomain: "almoxarifado-87f56.firebaseapp.com",
  projectId: "almoxarifado-87f56",
  storageBucket: "almoxarifado-87f56.firebasestorage.app",
  messagingSenderId: "692693247686",
  appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Adicione este bloco para habilitar o cache
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Múltiplas abas abertas, o cache não funcionará.");
    } else if (err.code == 'unimplemented') {
      console.warn("O navegador não suporta o cache offline.");
    }
  });

// Mapa para guardar os dados das empresas e funcionários
const empresasMap = new Map();
const funcionariosMap = new Map();

// Função para remover acentos e converter para minúsculas
function normalizarString(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Preenche o menu <select> com nomes de empresas do Firestore e os fixos
async function preencherSugestoesEmpresas() {
  const selectEmpresa = document.getElementById("nomeEmpresa");
  if (!selectEmpresa) return;

  try {
    while (selectEmpresa.options.length > 1) {
      selectEmpresa.remove(1);
    }

    const empresasFijas = ["Bossa Empreendimento", "Maxi Instalações", "JM Empreiteira"];
    empresasFijas.forEach(nome => {
      const option = document.createElement("option");
      option.value = nome;
      option.textContent = nome;
      selectEmpresa.appendChild(option);
    });

    const empresasSnapshot = await getDocs(collection(db, "empresas"));
    empresasSnapshot.forEach(doc => {
      const { nome, logoUrl } = doc.data();
      if (nome) {
        empresasMap.set(normalizarString(nome), logoUrl);

        let empresaJaExiste = false;
        for (let i = 0; i < selectEmpresa.options.length; i++) {
          if (selectEmpresa.options[i].value === nome) {
            empresaJaExiste = true;
            break;
          }
        }

        if (!empresaJaExiste) {
          const option = document.createElement("option");
          option.value = nome;
          option.textContent = nome;
          selectEmpresa.appendChild(option);
        }
      }
    });
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
  }
}

// Carrega os dados dos funcionários para usar as fotos
async function carregarDadosFuncionarios() {
  try {
    const funcionariosSnapshot = await getDocs(collection(db, "funcionarios"));
    funcionariosMap.clear();
    funcionariosSnapshot.forEach(doc => {
      const { nome, fotoUrl } = doc.data();
      if (nome) {
        funcionariosMap.set(normalizarString(nome), fotoUrl);
      }
    });
  } catch (error) {
    console.error("Erro ao carregar dados dos funcionários:", error);
  }
}

// Preenche o datalist com nomes do estoque
async function preencherSugestoesEstoque() {
  const sugestoesDatalist = document.getElementById("sugestoesMateriais");
  if (!sugestoesDatalist) return;

  try {
    const estoqueSnapshot = await getDocs(collection(db, "estoque"));
    estoqueSnapshot.forEach(doc => {
      const nome = doc.data().nome;
      if (nome) {
        const option = document.createElement("option");
        option.value = nome;
        sugestoesDatalist.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Erro ao buscar sugestões do estoque:", error);
  }
}

// Exportar para uso em outros módulos
export { db, collection, query, where, getDocs, setDoc, doc, updateDoc, deleteDoc, addDoc, Timestamp };

async function buscarImagemDoEstoque(material) {
  const estoqueRef = collection(db, 'estoque');
  const q = query(estoqueRef, where("nome", "==", material));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return doc.data().imagem || '';
  }
  return '';
}

// 🔁 Corrigir duplicatas no Firestore (Mantido ✅)
async function corrigirDuplicatasFirestore() {
  const emprestimosSnapshot = await getDocs(collection(db, "emprestimos"));
  for (const docSnap of emprestimosSnapshot.docs) {
    const nomeFuncionario = docSnap.id;
    const lista = docSnap.data().itens || [];

    const idsVistos = new Set();
    const listaFiltrada = lista.filter(item => {
      if (idsVistos.has(item.id)) {
        console.warn(`Duplicata encontrada e removida:`, item);
        return false;
      }
      idsVistos.add(item.id);
      return true;
    });

    if (listaFiltrada.length !== lista.length) {
      await setDoc(doc(db, "emprestimos", nomeFuncionario), {
        itens: listaFiltrada
      }, { merge: true });
      console.log(`Duplicatas corrigidas para: ${nomeFuncionario}`);
    }
  }
  console.log("✔️ Todas as duplicatas foram corrigidas no Firestore.");
}

// Executa correção ao iniciar
corrigirDuplicatasFirestore();

window.darBaixaEstoque = async function darBaixaEstoque(nomeFuncionario) {
  const containerFuncionario = document.getElementById(`tabela-${normalizarString(nomeFuncionario)}`).closest('.container2');
  const checkboxes = containerFuncionario.querySelectorAll(".select-item:checked");

  if (checkboxes.length === 0) {
    mostrarNotificacao("Selecione pelo menos um item para dar baixa.", "info");
    return;
  }

  const ok = await confirmarAcao({
  title: "Confirmar Baixa no Estoque",
  message: `Tem certeza de que deseja dar baixa em <strong>${checkboxes.length}</strong> item(ns)?<br>
            <small>Esta ação não pode ser desfeita.</small>`,
  confirmText: "Dar baixa",
  cancelText: "Cancelar",
  variant: "danger"
});
if (!ok) return;


  try {
    const batch = writeBatch(db);

    for (const checkbox of checkboxes) {
      const row = checkbox.closest('tr');
      const emprestimoId = row.dataset.id;

      const emprestimoDocRef = doc(db, "emprestimos", emprestimoId);
      const emprestimoDoc = await getDoc(emprestimoDocRef);
      if (!emprestimoDoc.exists()) continue;

      const emprestimo = emprestimoDoc.data();
      const nomeItem = emprestimo.descricao;
      const quantidadeBaixa = emprestimo.quantidade;

      const estoqueQuery = query(collection(db, "estoque"), where("nome", "==", nomeItem));
      const estoqueSnapshot = await getDocs(estoqueQuery);

      let estoqueId = null;

      if (!estoqueSnapshot.empty) {
        const estoqueDoc = estoqueSnapshot.docs[0];
        estoqueId = estoqueDoc.id;
        const estoqueData = estoqueDoc.data();
        const novaQuantidadeEstoque = (estoqueData.quantidade || 0) - quantidadeBaixa;

        batch.update(estoqueDoc.ref, {
          quantidade: novaQuantidadeEstoque < 0 ? 0 : novaQuantidadeEstoque
        });
      }

      // Atualiza o registro de histórico existente, adicionando o ID do produto
      const historicoRef = doc(db, "historico", emprestimoId);
      batch.update(historicoRef, {
        status: "Baixa no Estoque",
        observacao: `Baixa de ${quantidadeBaixa} un. repassadas por ${nomeFuncionario}.`,
        idProduto: estoqueId,
        usuario: nomeFuncionario
      });

      // Remove o item da lista de empréstimos ativos
      batch.delete(emprestimoDocRef);
    }

    await batch.commit();

    mostrarNotificacao("Baixa no estoque efetuada com sucesso!", "sucesso");
    atualizarEmprestimos();

  } catch (error) {
    console.error("❌ Erro ao dar baixa no estoque:", error);
    mostrarNotificacao("Erro ao dar baixa no estoque.", "erro");
  }
};

function toggleLogoutButton() {
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.classList.toggle("show");
  } else {
    console.error("Elemento logoutButton não encontrado!");
  }
}

const userIcon = document.querySelector(".user-icon img");
if (userIcon) {
  userIcon.addEventListener("click", toggleLogoutButton);
} else {
  console.error("Ícone do usuário não encontrado!");
}

let prevScrollPos = window.pageYOffset;

window.addEventListener("scroll", () => {
  const currentScrollPos = window.pageYOffset;
  const header = document.querySelector(".main-header");
  const logo = document.querySelector(".logo img");
  const menu = document.querySelector(".menu");

  if (prevScrollPos > currentScrollPos) {
    header.style.height = "215px";
    menu.classList.remove("hide");
    logo.style.width = "200px";
  } else {
    header.style.height = "60px";
    menu.classList.add("hide");
    logo.style.width = "110px";
  }

  prevScrollPos = currentScrollPos;
});

document.getElementById('emprestimoForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  const descricaoInput = document.getElementById('descricao').value.trim();
  const quantidadePadrao = parseInt(document.getElementById('quantidade').value, 10);
  const nomeFuncionario = document.getElementById('nomeFuncionario').value.trim();
  const nomeEmpresa = document.getElementById('nomeEmpresa').value.trim();
  const observacao = "-";

  if (!descricaoInput || !nomeFuncionario || !nomeEmpresa || isNaN(quantidadePadrao) || quantidadePadrao <= 0) {
    mostrarNotificacao("Preencha todos os campos obrigatórios corretamente.", "info");
    return;
  }

  // NOVA LÓGICA PARA PROCESSAR MATERIAIS E QUANTIDADES
  const materiaisParaProcessar = [];
  const itensInput = descricaoInput.split(',').map(item => item.trim());

  // Regex para encontrar uma quantidade no formato (X) no início do item
  const regexQuantidade = /^\s*\((\d+)\)\s*/;

  itensInput.forEach(itemTexto => {
    const match = itemTexto.match(regexQuantidade);
    let quantidadeItem = quantidadePadrao;
    let nomeItem = itemTexto;

    if (match) {
      quantidadeItem = parseInt(match[1], 10);
      nomeItem = itemTexto.replace(regexQuantidade, '').trim();
    }

    if (nomeItem) {
      materiaisParaProcessar.push({ nome: nomeItem, quantidade: quantidadeItem });
    }
  });
  // FIM DA NOVA LÓGICA

  const dataAtual = new Date();
  const dataEmprestimo = dataAtual.toLocaleDateString('pt-BR');
  const horaEmprestimo = dataAtual.toLocaleTimeString('pt-BR');

  let logoEmpresa = empresasMap.get(normalizarString(nomeEmpresa));

  if (!logoEmpresa) {
    if (nomeEmpresa === 'Bossa Empreendimento') logoEmpresa = 'img/logo_bossa.png';
    else if (nomeEmpresa === 'Maxi Instalações') logoEmpresa = 'img/logo_maxi.png';
    else if (nomeEmpresa === 'JM Empreiteira') logoEmpresa = 'img/logo_jm.png';
    else logoEmpresa = '';
  }

  try {
    const estoqueMap = new Map();
    const estoqueSnapshot = await getDocs(collection(db, 'estoque'));
    estoqueSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.nome) {
        const nomeNormalizado = normalizarString(data.nome);
        estoqueMap.set(nomeNormalizado, { imagem: data.imagem || "", nomeOriginal: data.nome });
      }
    });

    const emprestimosExistentesMap = new Map();
    const qEmprestimos = query(collection(db, 'emprestimos'), where("nomeFuncionario", "==", nomeFuncionario));
    const emprestimosSnapshot = await getDocs(qEmprestimos);
    emprestimosSnapshot.forEach(doc => {
      emprestimosExistentesMap.set(doc.data().descricao, { id: doc.id, data: doc.data() });
    });

    const batch = writeBatch(db);

    // MODIFICADO: Loop sobre a nova lista de materiais processados
    for (const item of materiaisParaProcessar) {
      const emprestimoExistente = emprestimosExistentesMap.get(item.nome);

      if (emprestimoExistente) {
        const docRef = doc(db, 'emprestimos', emprestimoExistente.id);
        const dadosAntigos = emprestimoExistente.data;
        const novaQuantidade = dadosAntigos.quantidade + item.quantidade;
        batch.update(docRef, { quantidade: novaQuantidade, quantidadeOriginal: novaQuantidade, status: "Emprestado" });
        const historicoRef = doc(db, 'historico', emprestimoExistente.id);
        batch.update(historicoRef, { quantidade: novaQuantidade });

      } else {
        let imagem = "";
        let nomeCorreto = item.nome;
        let melhorMatch = { nomeOriginal: "", imagem: "", tamanho: Infinity };
        const palavrasInput = normalizarString(item.nome).split(' ').filter(p => p.length > 2);

        for (const [nomeEstoqueNormalizado, dadosEstoque] of estoqueMap.entries()) {
          const encontrouTodasPalavras = palavrasInput.every(palavra => nomeEstoqueNormalizado.includes(palavra));
          if (encontrouTodasPalavras) {
            if (dadosEstoque.nomeOriginal.length < melhorMatch.tamanho) {
              melhorMatch.nomeOriginal = dadosEstoque.nomeOriginal;
              melhorMatch.imagem = dadosEstoque.imagem;
              melhorMatch.tamanho = dadosEstoque.nomeOriginal.length;
            }
          }
        }

        if (melhorMatch.tamanho !== Infinity) {
          nomeCorreto = melhorMatch.nomeOriginal;
          imagem = melhorMatch.imagem;
        }

        const emprestimoNovo = {
          idFuncionario: nomeFuncionario,
          descricao: nomeCorreto,
          imagem,
          quantidade: item.quantidade,
          quantidadeOriginal: item.quantidade,
          qtdDevolvida: 0,
          dataEmprestimo,
          horaEmprestimo,
          nomeFuncionario,
          nomeEmpresa,
          logoEmpresa,
          observacao,
          status: "Emprestado",
          timestamp: Timestamp.now()
        };

        const novoEmprestimoRef = doc(collection(db, 'emprestimos'));
        batch.set(novoEmprestimoRef, emprestimoNovo);
        const historicoRef = doc(db, 'historico', novoEmprestimoRef.id);
        batch.set(historicoRef, emprestimoNovo);
      }
    }

    await batch.commit();
    mostrarNotificacao("Empréstimo(s) registrado(s) com sucesso!", "sucesso");

    document.getElementById('emprestimoForm').reset();
    atualizarEmprestimos();

  } catch (error) {
    console.error("Erro ao registrar empréstimo em lote:", error);
    mostrarNotificacao("Erro ao registrar empréstimo.", "erro");
  }
});

// 🧩 Controle de render para evitar duplicações e piscadas
let __renderToken = 0;
let __isRendering = false;

window.atualizarEmprestimos = async function atualizarEmprestimos() {
  console.log("🔄 Atualizando lista de empréstimos...");

  const myToken = ++__renderToken; // versão desta atualização
  __isRendering = true;

  const scrollY = window.scrollY;
  const container = document.getElementById('emprestimosPorFuncionarioContainer');
  if (!container) return;

  container.style.opacity = '0.85'; // leve efeito de atualização

  try {
    const emprestimosSnapshot = await getDocs(collection(db, 'emprestimos'));

    // ⚠️ Se outra atualização começou antes dessa terminar, aborta
    if (myToken !== __renderToken) return;

    container.innerHTML = ''; // limpa apenas quando for seguro

    const emprestimosPorFuncionario = {};
    if (emprestimosSnapshot.empty) {
      container.innerHTML = `<p>Nenhum empréstimo registrado até o momento.</p>`;
      return;
    }

    // Monta agrupando por funcionário
    emprestimosSnapshot.forEach(docSnap => {
      const item = docSnap.data();
      const nomeFuncionario = item.nomeFuncionario || "Funcionário não informado";
      const nomeEmpresa = item.nomeEmpresa || "Empresa não informada";

      (emprestimosPorFuncionario[nomeFuncionario] ||= []).push({
        ...item, nomeFuncionario, nomeEmpresa, docId: docSnap.id
      });
    });

    // 🔹 Agora reconstrói os cards normalmente
    for (const nomeFuncionario in emprestimosPorFuncionario) {
      const lista = emprestimosPorFuncionario[nomeFuncionario];
      if (!Array.isArray(lista) || lista.length === 0) continue;

      const nomeEmpresa = lista[0]?.nomeEmpresa || 'Não Registrada';
      const logoEmpresa = lista[0]?.logoEmpresa || '';

      const divFuncionario = document.createElement('div');
      divFuncionario.classList.add('container2');

      let fotoFuncionario = '';
      switch (nomeFuncionario.toLowerCase()) {
        case 'alessandro': fotoFuncionario = './img/foto_alessandro.png'; break;
        case 'ramon': fotoFuncionario = './img/foto_ramon.png'; break;
        case 'lailton': fotoFuncionario = './img/foto_lailton.png'; break;
        case 'josué':
        case 'josue': fotoFuncionario = './img/foto_josue.png'; break;
        case 'argenis': fotoFuncionario = './img/foto_argenis.png'; break;
      }

      const idTabela = `tabela-${normalizarString(nomeFuncionario)}`;

      let html = `
      <header>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${fotoFuncionario ? `<img src="${fotoFuncionario}" alt="Foto de ${nomeFuncionario}" class="foto-funcionario">` : ''}
          <h2>Funcionário: <span class="nome-funcionario">${nomeFuncionario}</span></h2>
        </div>
        <div class="empresa-info">
          <strong>Nome da Empresa:</strong> ${nomeEmpresa}
          ${logoEmpresa ? `<img src="./${logoEmpresa}" alt="Logo da Empresa" class="logo-empresa-centralizada">` : ''}
        </div>
      </header>
      <section>
        <div class="marcar-todos-container" data-tabela-alvo="${idTabela}">
          <input type="checkbox" class="marcar-todos-checkbox">
          <label>Marcar Todos</label>
        </div>
        <table id="${idTabela}">
          <thead>
            <tr>
              <th>Selecionar</th>
              <th>Material/Ferramenta</th>
              <th>Quantidade</th>
              <th>Data do Empréstimo</th>
              <th>Hora do Empréstimo</th>
              <th>Qtd Devolvida</th>
              <th>Observação</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;

      lista.forEach((item) => {
        const status = item.status || "Emprestado";
        const backgroundColor = status === "Pendente" ? "#f8d7da" : "";

        html += `
        <tr data-id="${item.docId}" style="background-color: ${backgroundColor}">
          <td><input type="checkbox" class="select-item"></td>
          <td>${item.imagem ? `<img src="${item.imagem}" class="img-material" loading="lazy">` : ''}${item.descricao}</td>
          <td>${item.quantidade}</td>
          <td>${item.dataEmprestimo}</td>
          <td>${item.horaEmprestimo}</td>
          <td><input type="number" value="${item.qtdDevolvida || 0}" max="${item.quantidade}" /></td>
          <td><textarea>${item.observacao || ''}</textarea></td>
          <td class="status">${status}</td>
        </tr>`;
      });

      html += `</tbody></table>
        <div class="buttons">
          <button class="btn-devolver" onclick="marcarComoDevolvido('${nomeFuncionario}')">Devolver</button>
          <button class="btn-pendente" onclick="marcarComoPendente('${nomeFuncionario}')">Pendente</button>
          <button class="btn-baixa" onclick="darBaixaEstoque('${nomeFuncionario}')">Baixa</button>
        </div>
      </section>`;

      divFuncionario.innerHTML = html;
      container.appendChild(divFuncionario);
    }

  } catch (error) {
    console.error("❌ Erro ao atualizar empréstimos:", error);
    container.innerHTML = `<p>Erro ao carregar empréstimos. Tente novamente.</p>`;
  } finally {
    if (myToken === __renderToken) {
      __isRendering = false;
      container.style.opacity = '1';
      setTimeout(() => window.scrollTo(0, scrollY), 50);
    }
  }
};


// ✅ Chama TODAS as funções necessárias ao carregar a página
window.addEventListener('load', () => {
  preencherSugestoesEstoque();
  preencherSugestoesEmpresas();
  carregarDadosFuncionarios().then(() => {
    atualizarEmprestimos();
  });
});

document.addEventListener('input', (event) => {
  if (event.target.tagName.toLowerCase() === 'textarea') {
    const textarea = event.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight} px`;
  }
});

document.addEventListener('input', (event) => {
  if (event.target.tagName.toLowerCase() === 'textarea') {
    const textarea = event.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight} px`;
  }
});
window.marcarComoPendente = async function marcarComoPendente(nomeFuncionario) {
  try {
    // ✅ Mostra UMA única vez o modal de confirmação
    const ok = await (window.confirmarAcao
      ? window.confirmarAcao({
          title: "Marcar como Pendente",
          message: "Deseja marcar os itens selecionados como <strong>pendentes</strong>?",
          confirmText: "Marcar",
          cancelText: "Cancelar",
          variant: "primary"
        })
      : Promise.resolve(confirm("Deseja marcar os itens selecionados como pendentes?"))
    );
    if (!ok) return;

    const q = query(collection(db, 'emprestimos'), where('nomeFuncionario', '==', nomeFuncionario));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      mostrarNotificacao("Nenhum empréstimo encontrado para este funcionário.", "info");
      return;
    }

    let algumAtualizado = false;

    for (const docSnap of querySnapshot.docs) {
      const row = document.querySelector(`tr[data-id="${CSS.escape(docSnap.id)}"]`);

      if (row) {
        const checkbox = row.querySelector(".select-item");

        if (checkbox && checkbox.checked) {
          const textarea = row.querySelector("textarea");
          const observacao = textarea?.value || "-";

          await updateDoc(doc(db, 'emprestimos', docSnap.id), {
            status: "Pendente",
            observacao: observacao
          });

          await updateDoc(doc(db, 'historico', docSnap.id), {
            status: "Pendente",
            observacao: observacao
          });

          const statusCell = row.querySelector(".status");
          if (statusCell) statusCell.textContent = "Pendente";
          row.style.backgroundColor = "#f8d7da";

          algumAtualizado = true;
        }
      }
    }

    if (algumAtualizado) {
      mostrarNotificacao("Itens marcados como pendentes.", "info");
      atualizarEmprestimos();
    } else {
      mostrarNotificacao("Selecione pelo menos um item para marcar como pendente.", "info");
    }

    if (window.location.pathname.includes("registro.html")) {
      carregarHistoricoEmprestimos();
    }

  } catch (error) {
    console.error("Erro ao marcar como pendente:", error);
    mostrarNotificacao("Erro ao marcar como pendente.", "erro");
  }
};



window.marcarComoDevolvido = async function marcarComoDevolvido(nomeFuncionario) {
  try {
    const q = query(collection(db, "emprestimos"), where("nomeFuncionario", "==", nomeFuncionario));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      mostrarNotificacao("Nenhum empréstimo encontrado para este funcionário.", "info");
      return;
    }

    let algumAtualizado = false;

    for (const docSnap of querySnapshot.docs) {
      const item = docSnap.data();
      const row = document.querySelector(`tr[data-id="${CSS.escape(docSnap.id)}"]`);

      if (row) {
        const checkbox = row.querySelector(".select-item");
        const inputDevolvida = row.querySelector("input[type='number']");
        const textarea = row.querySelector("textarea");

        if (checkbox && checkbox.checked && inputDevolvida) {
          const valorDigitado = parseInt(inputDevolvida.value, 10);
          const devolvida = isNaN(valorDigitado) || valorDigitado < 1 ? 1 : valorDigitado;
          const observacao = textarea?.value || "-";
          const qtdJaDevolvida = item.qtdDevolvida || 0;
          const quantidadeRestante = item.quantidadeOriginal - qtdJaDevolvida;

          if (devolvida > quantidadeRestante) {
            mostrarNotificacao(`A quantidade devolvida não pode exceder ${quantidadeRestante}.`, "info");
            return;
          }

          const novaQtdDevolvidaTotal = qtdJaDevolvida + devolvida;
          const status = novaQtdDevolvidaTotal >= item.quantidadeOriginal ? "Devolvido" : "Parcialmente Devolvido";
          const dataDevolucao = status === "Devolvido"
            ? new Date().toLocaleDateString()
            : (item.dataDevolucao || "Ainda não devolvido");

          const docRef = doc(db, "emprestimos", docSnap.id);
          const novaQuantidadeIndex = Math.max(item.quantidade - devolvida, 0);

          await updateDoc(docRef, {
            quantidade: novaQuantidadeIndex,
            qtdDevolvida: novaQtdDevolvidaTotal,
            status: status,
            dataDevolucao: dataDevolucao,
            observacao: observacao
          });

          const historicoRef = doc(db, "historico", docSnap.id);
          await updateDoc(historicoRef, {
            qtdDevolvida: novaQtdDevolvidaTotal,
            status: status,
            dataDevolucao: dataDevolucao,
            observacao: observacao,
            quantidade: item.quantidadeOriginal
          });

          row.querySelector("td:nth-child(3)").textContent = novaQuantidadeIndex;
          row.querySelector("td:nth-child(6) input").value = novaQtdDevolvidaTotal;
          const statusCell = row.querySelector(".status");
          if (statusCell) statusCell.textContent = status;
          row.style.backgroundColor = status === "Devolvido" ? "#d4edda" : "#fff3cd";

          if (novaQtdDevolvidaTotal >= item.quantidadeOriginal) {
            await deleteDoc(doc(db, "emprestimos", docSnap.id));
            row.remove();
          }

          checkbox.checked = false;
          algumAtualizado = true;
        }
      }
    }

    if (algumAtualizado) {
      const btn =
        document
          .querySelector(`#tabela-${normalizarString(nomeFuncionario)}`)
          ?.closest('.container2')
          ?.querySelector('.btn-devolver')
        || document.querySelector('.btn-devolver');

      const originalText = btn ? btn.innerHTML : null;

      if (btn) {
        btn.innerHTML = `Processando <div class="loading-spinner"></div>`;
        btn.disabled = true;
      }

      await atualizarEmprestimos(); // atualiza uma única vez, sem timeout

      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }

      mostrarNotificacao("Devolução registrada com sucesso!", "sucesso");
    } else {
      mostrarNotificacao("Selecione pelo menos um item para marcar como devolvido.", "info");
    }

  } catch (error) {
    console.error("Erro ao marcar como devolvido:", error);
    mostrarNotificacao("Erro ao atualizar status de devolução.", "erro");
  }
};



export async function atualizarHistoricoRegistro(funcionarioId, dataEmprestimo, horaEmprestimo, novosDados) {
  console.log("✅ atualizarHistoricoRegistro chamado:", { funcionarioId, dataEmprestimo, horaEmprestimo, novosDados });

  try {
    const historicoRef = collection(db, 'historico');
    const q = query(
      historicoRef,
      where("idFuncionario", "==", funcionarioId),
      where("dataEmprestimo", "==", dataEmprestimo),
      where("horaEmprestimo", "==", horaEmprestimo)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn("Nenhum documento encontrado para atualizar! Criando um novo documento com ID fixo.");

      const docId = `${funcionarioId}_${dataEmprestimo}_${horaEmprestimo} `;
      const docRef = doc(db, 'historico', docId);

      await setDoc(docRef, {
        idFuncionario: funcionarioId,
        dataEmprestimo,
        horaEmprestimo,
        ...novosDados
      }, { merge: true });
  console.log("✔️ Documento novo criado no histórico com ID fixo:", docId);
      return;
    }

    for (const docSnap of querySnapshot.docs) {
      await updateDoc(docSnap.ref, novosDados);
      console.log(`✔️ Documento ${docSnap.id} atualizado.`);
    }

  } catch (error) {
    console.error("Erro ao atualizar histórico:", error);
  }
}
    

// --- LÓGICA PARA O CHECKBOX 'MARCAR TODOS' ---
function gerenciarMarcarTodos(containerFuncionario) {
  const marcarTodosContainer = containerFuncionario.querySelector('.marcar-todos-container');
  const marcarTodosCheckbox = containerFuncionario.querySelector('.marcar-todos-checkbox');
  const itensCheckbox = containerFuncionario.querySelectorAll('.select-item');
  const itensMarcados = containerFuncionario.querySelectorAll('.select-item:checked').length;
  const btns = containerFuncionario.querySelectorAll('.buttons button');

  if (itensMarcados > 0) {
    marcarTodosContainer.classList.add('visivel');
    btns.forEach(btn => btn.style.display = 'inline-block');
  } else {
    marcarTodosContainer.classList.remove('visivel');
    btns.forEach(btn => btn.style.display = 'none');
  }

  marcarTodosCheckbox.checked = itensCheckbox.length > 0 && itensMarcados === itensCheckbox.length;
}

const containerPrincipal = document.getElementById('emprestimosPorFuncionarioContainer');
if (containerPrincipal) {
  containerPrincipal.addEventListener('click', function (event) {
    const target = event.target;
    const containerFuncionario = target.closest('.container2');

    if (containerFuncionario) {
      if (target.classList.contains('select-item')) {
        gerenciarMarcarTodos(containerFuncionario);
      }

      if (target.classList.contains('marcar-todos-checkbox')) {
        const isChecked = target.checked;
        const idTabelaAlvo = target.closest('.marcar-todos-container').dataset.tabelaAlvo;
        const tabelaAlvo = document.getElementById(idTabelaAlvo);
        if (tabelaAlvo) {
          const itensCheckbox = tabelaAlvo.querySelectorAll('.select-item');
          itensCheckbox.forEach(checkbox => {
            checkbox.checked = isChecked;
          });
        }
        gerenciarMarcarTodos(containerFuncionario);
      }
    }
  });
}

// ------------------ ALERTAS MODERNOS (TOAST PROFISSIONAL) ------------------
function mostrarNotificacao(mensagem, tipo = "sucesso") {
  const toast = document.createElement("div");
  toast.className = `toast-notificacao ${tipo}`;
  toast.innerHTML = `
    <span class="toast-icone">${
      tipo === "sucesso" ? "✅" : tipo === "erro" ? "❌" : "ℹ️"
    }</span>
    <span class="toast-texto">${mensagem}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("visivel"), 50);

  setTimeout(() => {
    toast.classList.remove("visivel");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}


// ===== Modal de confirmação (global) =====
window.confirmarAcao = function confirmarAcao({
  title = "Confirmação",
  message = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary" // "primary" | "danger"
} = {}) {
  return new Promise((resolve) => {
    // remove instância anterior, se existir
    let overlay = document.getElementById("cm-modal-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "cm-modal-overlay";
    overlay.innerHTML = `
      <div class="cm-modal-card" role="dialog" aria-modal="true" aria-labelledby="cm-modal-title">
        <div class="cm-modal-head">
          <div class="cm-modal-icon ${variant === "danger" ? "danger" : "primary"}">
            ${variant === "danger" ? "!" : "i"}
          </div>
          <h3 id="cm-modal-title" class="cm-modal-title">${title}</h3>
        </div>
        <div class="cm-modal-body">${message}</div>
        <div class="cm-modal-foot">
          <button type="button" class="cm-btn cm-btn-neutral" data-action="cancel">${cancelText}</button>
          <button type="button" class="cm-btn ${variant === "danger" ? "cm-btn-danger" : "cm-btn-primary"}" data-action="confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");

    // animação de entrada
    requestAnimationFrame(() => overlay.classList.add("show"));

    const close = (val) => {
      overlay.classList.remove("show");
      setTimeout(() => {
        overlay.remove();
        document.body.classList.remove("modal-open");
        resolve(val);
      }, 200);
    };

    // fechar clicando fora
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });

    // botões
    overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => close(true));
  });
};
