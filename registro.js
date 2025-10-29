// Importações Firebase (COM A ADIÇÃO DE 'writeBatch' ✅)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, onSnapshot, collection, getDocs, doc, updateDoc,
  deleteDoc, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Configuração Firebase (mantida como está)
const firebaseConfig = {
  apiKey: "AIzaSyDUp-LymsHkgAoul4vh79xJ7yi7WtJ0-Go",
  authDomain: "almoxarifado-87f56.firebaseapp.com",
  projectId: "almoxarifado-87f56",
  storageBucket: "almoxarifado-87f56.firebasestorage.app",
  messagingSenderId: "692693247686",
  appId: "1:692693247686:web:f75ba07012ffbb206e99c7"
};

// Inicializa app Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth();

// Função principal para carregar o histórico de empréstimos (mantida como está)
export async function carregarHistoricoEmprestimos() {
  const historicoContainer = document.getElementById("historicoEmprestimos");
  const relatorioContainer = document.getElementById("relatorioContainer");

  if (!historicoContainer || !relatorioContainer) {
    console.error("❌ Elementos essenciais do relatório não encontrados no DOM.");
    return;
  }

  relatorioContainer.style.display = 'block';
  historicoContainer.innerHTML = "<p>Carregando relatórios...</p>";

  const imagensEstoque = new Map();
  try {
    const snapshotEstoque = await getDocs(collection(db, "estoque"));
    snapshotEstoque.forEach(doc => {
      const { nome, imagem } = doc.data();
      if (nome && imagem) imagensEstoque.set(nome.toLowerCase(), imagem);
    });
  } catch (error) {
    console.error("Erro ao carregar imagens do estoque:", error);
  }

  const filtroInput = document.getElementById("filtroData");
  let dataSelecionada;

  if (filtroInput && filtroInput.value) {
    dataSelecionada = filtroInput.value.split("-").reverse().join("/");
  } else {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    dataSelecionada = `${dia}/${mes}/${ano}`;
  }

  const q = query(collection(db, "historico"), where("dataEmprestimo", "==", dataSelecionada));

  onSnapshot(q, (querySnapshot) => {
    if (querySnapshot.empty) {
      historicoContainer.innerHTML = "<p>Nenhum registro encontrado para esta data.</p>";
      return;
    }

    historicoContainer.innerHTML = "";
    
    const funcionariosMap = {};
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const nomeFunc = data.nomeFuncionario || "Sem nome";
      if (!funcionariosMap[nomeFunc]) {
        funcionariosMap[nomeFunc] = {
          empresa: data.nomeEmpresa || "Não Registrada",
          registros: []
        };
      }
      funcionariosMap[nomeFunc].registros.push({
        ...data,
        id: doc.id,
        quantidade: parseInt(data.quantidade) || 0,
        qtdDevolvida: parseInt(data.qtdDevolvida) || 0,
        status: data.status || "Emprestado"
      });
    });

    for (const [nomeFuncionario, dadosFuncionario] of Object.entries(funcionariosMap)) {
        const empresa = dadosFuncionario.empresa;
        const logoEmpresa = empresa === "Bossa Empreendimento" ? "img/logo_bossa.png"
            : empresa === "Maxi Instalações" ? "img/logo_maxi.png"
            : empresa === "JM Empreiteira" ? "img/logo_jm.png"
            : "";
        
        let fotoFuncionario = "";
        switch (nomeFuncionario.toLowerCase()) {
            case "alessandro": fotoFuncionario = "./img/foto_alessandro.png"; break;
            case "ramon": fotoFuncionario = "./img/foto_ramon.png"; break;
            case "lailton": fotoFuncionario = "./img/foto_lailton.png"; break;
            case "josué": case "josue": fotoFuncionario = "./img/foto_josue.png"; break;
            case "argenis": fotoFuncionario = "./img/foto_argenis.png"; break;
        }

        const ficha = document.createElement("div");
        ficha.classList.add("ficha-funcionario");

        ficha.innerHTML = `
            <header class="ficha-header">
                <div class="funcionario-info">
                    ${fotoFuncionario ? `<img src="${fotoFuncionario}" alt="Foto de ${nomeFuncionario}" class="foto-funcionario">` : ""}
                    <h3 class="nome-funcionario">${nomeFuncionario}</h3>
                </div>
                ${logoEmpresa ? `<img src="./${logoEmpresa}" alt="Logo ${empresa}" class="logo-empresa">` : `<span>${empresa}</span>`}
                <button class="edit-button" data-funcionario="${nomeFuncionario}">✎ Editar</button>
            </header>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Material/Ferramenta</th>
                            <th>Qtd Total</th>
                            <th>Qtd Devolvida</th>
                            <th>Data</th>
                            <th>Hora</th>
                            <th>Observação</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dadosFuncionario.registros.map(registro => {
                            const status = registro.status.toLowerCase().replace(/\s+/g, '-');
                            const statusClasse = {
                                "devolvido": "status-devolvido",
                                "emprestado": "status-emprestado",
                                "pendente": "status-pendente",
                                "parcialmente-devolvido": "status-parcialmente-devolvido",
                                "baixa-no-estoque": "status-baixa"
                            }[status] || "";

                            return `<tr>
                                <td>
                                    <div class="material-info">
                                        ${imagensEstoque.has(registro.descricao?.toLowerCase()) ? `<img src="${imagensEstoque.get(registro.descricao.toLowerCase())}" alt="${registro.descricao}">` : ""}
                                        <span>${registro.descricao || "Item Desconhecido"}</span>
                                    </div>
                                </td>
                                <td>${registro.quantidade}</td>
                                <td>${registro.qtdDevolvida}</td>
                                <td>${registro.dataEmprestimo || "-"}</td>
                                <td>${registro.horaEmprestimo || "-"}</td>
                                <td>${registro.observacao || "-"}</td>
                                <td><span class="status-badge ${statusClasse}">${registro.status}</span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        historicoContainer.appendChild(ficha);
    }
    
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', (e) => {
            abrirEditor(e.target.dataset.funcionario);
        });
    });
  }, (error) => {
      console.error("Erro no listener do snapshot:", error);
      historicoContainer.innerHTML = "<p>Ocorreu um erro ao carregar os dados. Tente novamente.</p>";
  });
}

// --- INICIALIZAÇÃO E EVENT LISTENERS ---

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Inicializando monitoramento do histórico...");
  carregarHistoricoEmprestimos();

  const filtroData = document.getElementById("filtroData");
  if(filtroData) {
      filtroData.value = new Date().toISOString().split('T')[0];
      filtroData.addEventListener("change", carregarHistoricoEmprestimos);
  }
});

const userIcon = document.querySelector(".user-icon");
const logoutButton = document.getElementById("logoutButton");
if (userIcon && logoutButton) {
  userIcon.addEventListener("click", () => logoutButton.classList.toggle("show"));
  logoutButton.addEventListener("click", () => window.location.href = "login.html");
}

// --- FUNÇÕES DO MODAL ---

export async function abrirEditor(nomeFuncionario) {
  try {
    const filtroInput = document.getElementById("filtroData");
    let dataSelecionada;

    if (filtroInput && filtroInput.value) {
      dataSelecionada = filtroInput.value.split("-").reverse().join("/");
    } else {
      const hoje = new Date();
      dataSelecionada = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    }

    const q = query(
      collection(db, "historico"),
      where("nomeFuncionario", "==", nomeFuncionario),
      where("dataEmprestimo", "==", dataSelecionada)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      alert(`Nenhum empréstimo para ${nomeFuncionario} na data ${dataSelecionada}.`);
      return;
    }

    const modalExistente = document.querySelector('.modal');
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement('div');
    modal.classList.add('modal');
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Editar Empréstimos de ${nomeFuncionario} - ${dataSelecionada}</h3>
        <div class="modal-body">
          
          <div id="marcar-todos-container-modal" class="marcar-todos-modal-container">
            <input type="checkbox" id="check-todos-modal">
            <label for="check-todos-modal">Marcar Todos</label>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Selecionar</th>
                <th>Material/Ferramenta</th>
                <th>Quantidade</th>
                <th>Observação</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="tabela-edicao"></tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button id="fecharModalBtn">Fechar</button>
          <button id="salvarAlteracoesBtn">Salvar Alterações</button>
          <button id="excluirSelecionadosBtn">Excluir Selecionados</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const tabelaEdicaoBody = document.getElementById("tabela-edicao");
    querySnapshot.forEach(docSnap => {
      const registro = docSnap.data();
      const id = docSnap.id;
      const linha = document.createElement("tr");
      linha.innerHTML = `
        <td><input type="checkbox" class="registro-checkbox" data-id="${id}"></td>
        <td><input type="text" value="${registro.descricao || ''}" data-id="${id}" data-campo="descricao"></td>
        <td><input type="number" value="${registro.quantidade || 0}" data-id="${id}" data-campo="quantidade"></td>
        <td><input type="text" value="${registro.observacao || ''}" data-id="${id}" data-campo="observacao"></td>
        <td>
          <select data-id="${id}" data-campo="status">
            <option value="Emprestado" ${registro.status === "Emprestado" ? "selected" : ""}>Emprestado</option>
            <option value="Pendente" ${registro.status === "Pendente" ? "selected" : ""}>Pendente</option>
            <option value="Parcialmente Devolvido" ${registro.status === "Parcialmente Devolvido" ? "selected" : ""}>Parcialmente Devolvido</option>
            <option value="Devolvido" ${registro.status === "Devolvido" ? "selected" : ""}>Devolvido</option>
          </select>
        </td>
        <td><button class="excluir-registro-btn" data-id="${id}">Excluir</button></td>
      `;
      tabelaEdicaoBody.appendChild(linha);
    });
    
    // --- NOVA LÓGICA PARA CONTROLAR O "MARCAR TODOS" ---
    
    const marcarTodosContainer = document.getElementById('marcar-todos-container-modal');
    const checkTodosModal = document.getElementById('check-todos-modal');
    const checkboxes = tabelaEdicaoBody.querySelectorAll('.registro-checkbox');

    function gerenciarVisibilidadeMarcarTodos() {
        const algumMarcado = tabelaEdicaoBody.querySelector('.registro-checkbox:checked');
        const todosMarcados = checkboxes.length > 0 && checkboxes.length === tabelaEdicaoBody.querySelectorAll('.registro-checkbox:checked').length;

        // Mostra o container se pelo menos uma caixa estiver marcada
        if (algumMarcado) {
            marcarTodosContainer.classList.add('visivel');
        } else {
            marcarTodosContainer.classList.remove('visivel');
        }
        
        // Atualiza o estado do "Marcar Todos" (marcado ou não)
        checkTodosModal.checked = todosMarcados;
    }
    
    // Adiciona um listener para a tabela inteira (mais eficiente)
    tabelaEdicaoBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('registro-checkbox')) {
            gerenciarVisibilidadeMarcarTodos();
        }
    });

    // Adiciona o listener para o botão "Marcar Todos"
    checkTodosModal.addEventListener('click', () => {
        checkboxes.forEach(cb => {
            cb.checked = checkTodosModal.checked;
        });
    });


    // Adiciona eventos aos botões do modal
    document.getElementById('fecharModalBtn').addEventListener('click', fecharModal);
    document.getElementById('salvarAlteracoesBtn').addEventListener('click', salvarAlteracoes);
    document.getElementById('excluirSelecionadosBtn').addEventListener('click', excluirSelecionados);
    document.querySelectorAll('.excluir-registro-btn').forEach(btn => {
        btn.addEventListener('click', (e) => excluirRegistro(e.target.dataset.id));
    });
    
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);

  } catch (error) {
    console.error("Erro ao abrir editor:", error);
    alert("Erro ao carregar registros.");
  }
}

function fecharModal() {
  const modal = document.querySelector(".modal");
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
        modal.remove();
    }, 300);
  }
}

// ✅ FUNÇÃO SALVAR ALTERAÇÕES (CORRIGIDA)
async function salvarAlteracoes() {
  const inputs = document.querySelectorAll("#tabela-edicao input[type='text'], #tabela-edicao input[type='number'], #tabela-edicao select");
  const atualizacoes = {};

  inputs.forEach(input => {
    const id = input.dataset.id;
    const campo = input.dataset.campo;
    const valor = input.value;
    if (!atualizacoes[id]) atualizacoes[id] = {};
    atualizacoes[id][campo] = campo === "quantidade" ? Number(valor) : valor;
  });

  try {
    // Inicia um 'batch' para agrupar todas as operações
    const batch = writeBatch(db);

    for (const id in atualizacoes) {
      const docRef = doc(db, "historico", id);
      batch.update(docRef, atualizacoes[id]);
    }
    
    // Envia todas as atualizações para o Firebase de uma só vez
    await batch.commit();

    alert("Alterações salvas com sucesso!");
    fecharModal();
  } catch (error) {
    console.error("Erro ao salvar alterações:", error);
    alert("Erro ao salvar alterações.");
  }
}

// ✅ FUNÇÃO EXCLUIR REGISTRO ÚNICO (CORRIGIDA)
async function excluirRegistro(id) {
  if (!confirm("Tem certeza que deseja excluir este registro?")) return;
  try {
    await deleteDoc(doc(db, "historico", id));
    // Remove a linha da tabela na interface
    document.querySelector(`tr[data-id='${id}']`).remove();
    alert("Registro excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir registro:", error);
    alert("Erro ao excluir registro.");
  }
}

// ✅ FUNÇÃO EXCLUIR SELECIONADOS (CORRIGIDA)
async function excluirSelecionados() {
  const checkboxes = document.querySelectorAll(".registro-checkbox:checked");
  if (checkboxes.length === 0) {
      alert("Nenhum registro selecionado para excluir.");
      return;
  }
  if (!confirm(`Tem certeza que deseja excluir os ${checkboxes.length} registros selecionados?`)) return;

  try {
    // Inicia um 'batch' para agrupar todas as exclusões
    const batch = writeBatch(db);

    for (const checkbox of checkboxes) {
      const docRef = doc(db, "historico", checkbox.dataset.id);
      batch.delete(docRef);
    }
    
    // Envia todas as exclusões para o Firebase de uma só vez
    await batch.commit();

    alert("Registros selecionados excluídos com sucesso!");
    fecharModal();
  } catch (error) {
    console.error("Erro ao excluir registros:", error);
    alert("Erro ao excluir um ou mais registros.");
  }
}