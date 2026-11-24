
const $ = id => document.getElementById(id);

const CHAVE_SENHA = 'ds-fashion-password';
const CHAVE_DADOS = 'ds-fashion-data';
const CHAVE_BACKUP = 'ds-fashion-backup';

const SUPABASE_URL = 'https://prufsnmbdiiuvdtczuqj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IN5G1_tyftVkbKwgXViaoQ_1LxzmB1S';
const TABELA_NUVEM = 'ds_fashion_cloud';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let supabaseClient = null;
let chaveCriptografia = null;
let senhaAplicativoAtual = '';
let metadadosSenha = null;
let clienteDetalhadoId = null;
let salvamentoEmAndamento = Promise.resolve();
let sincronizacaoEmAndamento = false;
let carregandoNuvem = false;
let envioNuvemPendente = false;

let dados = {
  clientes: [],
  produtos: [],
  vendas: [],
  pagamentos: []
};

const dinheiro = valor => Number(valor || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const numero = valor => Number(valor || 0);
const centavos = valor => Math.round(numero(valor) * 100);

const percentual = (custo, venda) => {
  venda = numero(venda);
  return venda <= 0 ? 0 : ((venda - numero(custo)) / venda) * 100;
};

const gerarId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

function mostrarMensagem(texto) {
  if ($('mensagem')) $('mensagem').textContent = texto;
}

function mostrarStatusNuvem(texto) {
  if ($('statusNuvem')) $('statusNuvem').textContent = texto;
}

function atualizarBotoesNuvem() {
  if (!supabaseClient) return;

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) return;

    const conectado = !!data.session;

    if ($('botaoCriarContaNuvem')) {
      $('botaoCriarContaNuvem').classList.toggle('oculto', conectado);
    }

    if ($('botaoEntrarNuvem')) {
      $('botaoEntrarNuvem').classList.toggle('oculto', conectado);
    }

    if ($('botaoSairNuvem')) {
      $('botaoSairNuvem').classList.toggle('oculto', !conectado);
    }

    if (conectado) {
      mostrarStatusNuvem(
        'Conta conectada. A sincronização está disponível.'
      );
    }
  });
}

/* =========================================
   SUPABASE
========================================= */

function iniciarSupabase() {
  if (!window.supabase) {
    mostrarStatusNuvem('Biblioteca Supabase indisponível.');
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  supabaseClient.auth.onAuthStateChange((evento, sessao) => {
    atualizarBotoesNuvem();

    if (evento === 'SIGNED_IN' && chaveCriptografia) {
      setTimeout(() => sincronizarComNuvem(), 0);
    }

    if (evento === 'SIGNED_OUT') {
      mostrarStatusNuvem('Conta da nuvem desconectada.');
    }
  });

  atualizarBotoesNuvem();

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      mostrarStatusNuvem('Não foi possível verificar a conta.');
      return;
    }

    if (data.session) {
      mostrarStatusNuvem('Conta conectada. Verificando sincronização...');

      if (chaveCriptografia) {
        sincronizarComNuvem();
      }
    }
  });
}

async function criarContaNuvem() {
  if (!supabaseClient) {
    alert('A conexão com o Supabase não foi inicializada.');
    return;
  }

  const email = $('emailNuvem').value.trim();
  const senha = $('senhaNuvem').value;

  if (!email || !senha || senha.length < 6) {
    alert('Informe um e-mail válido e uma senha com pelo menos 6 caracteres.');
    return;
  }

  mostrarStatusNuvem('Criando sua conta...');

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: senha
  });

  if (error) {
    mostrarStatusNuvem(error.message);
    alert('Não foi possível criar a conta: ' + error.message);
    return;
  }

  if (data.session) {
    mostrarStatusNuvem('Conta criada e conectada com sucesso.');

    if (chaveCriptografia) {
      await sincronizarComNuvem();
    }
  } else {
    mostrarStatusNuvem(
      'Conta criada. Verifique seu e-mail para confirmar o cadastro.'
    );

    alert('Confira seu e-mail para confirmar a conta Supabase.');
  }

  atualizarBotoesNuvem();
}

async function entrarNuvem() {
  if (!supabaseClient) {
    alert('A conexão com o Supabase não foi inicializada.');
    return;
  }

  const email = $('emailNuvem').value.trim();
  const senha = $('senhaNuvem').value;

  if (!email || !senha) {
    alert('Informe o e-mail e a senha da nuvem.');
    return;
  }

  mostrarStatusNuvem('Conectando à nuvem...');

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    mostrarStatusNuvem(error.message);
    alert('Não foi possível entrar: ' + error.message);
    return;
  }

  $('senhaNuvem').value = '';

  atualizarBotoesNuvem();

  mostrarStatusNuvem('Conta conectada.');

  if (chaveCriptografia) {
    await sincronizarComNuvem();
  }
}

async function sairNuvem() {
  if (!supabaseClient) return;

  if (!confirm('Deseja desconectar a conta da nuvem?')) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert('Não foi possível sair: ' + error.message);
    return;
  }

  atualizarBotoesNuvem();
  mostrarStatusNuvem('Conta desconectada. Os dados locais foram preservados.');
}

async function obterRegistroNuvem() {
  const { data: sessaoData, error: erroSessao } =
    await supabaseClient.auth.getSession();

  if (erroSessao) throw erroSessao;

  const sessao = sessaoData.session;

  if (!sessao) {
    throw new Error('Entre na conta da nuvem primeiro.');
  }

  const { data, error } = await supabaseClient
    .from(TABELA_NUVEM)
    .select('user_id,password_metadata,encrypted_data,updated_at')
    .eq('user_id', sessao.user.id)
    .maybeSingle();

  if (error) throw error;

  return { data, sessao };
}

async function enviarDadosNuvem() {
  if (!supabaseClient || !chaveCriptografia || !metadadosSenha) return;

  const { data: sessaoData, error: erroSessao } =
    await supabaseClient.auth.getSession();

  if (erroSessao) throw erroSessao;

  const sessao = sessaoData.session;

  if (!sessao) return;

  const registro = localStorage.getItem(CHAVE_DADOS);

  if (!registro) return;

  const payload = {
    user_id: sessao.user.id,
    password_metadata: metadadosSenha,
    encrypted_data: registro,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from(TABELA_NUVEM)
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;

  envioNuvemPendente = false;

  mostrarStatusNuvem(
    'Sincronização concluída em ' +
    new Date().toLocaleString('pt-BR')
  );
}

async function sincronizarComNuvem() {
  if (
    !supabaseClient ||
    !chaveCriptografia ||
    sincronizacaoEmAndamento ||
    carregandoNuvem
  ) return;

  sincronizacaoEmAndamento = true;

  try {
    mostrarStatusNuvem('Sincronizando dados...');

    const { data: registro } = await obterRegistroNuvem();

    if (!registro) {
      await enviarDadosNuvem();

      mostrarStatusNuvem(
        'Primeiro envio concluído. Dados protegidos na nuvem.'
      );

      return;
    }

    const meta = typeof registro.password_metadata === 'string'
      ? JSON.parse(registro.password_metadata)
      : registro.password_metadata;

    if (!meta || !meta.salt || !meta.iv || !meta.teste) {
      throw new Error('Metadados de criptografia inválidos na nuvem.');
    }

    const chaveRemota = await derivarChave(
      senhaAplicativoAtual,
      new Uint8Array(meta.salt)
    );

    const teste = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(meta.iv)
      },
      chaveRemota,
      new Uint8Array(meta.teste)
    );

    if (decoder.decode(teste) !== 'DS Fashion') {
      throw new Error(
        'A senha do aplicativo não corresponde aos dados da nuvem.'
      );
    }

    const conteudo = typeof registro.encrypted_data === 'string'
      ? JSON.parse(registro.encrypted_data)
      : registro.encrypted_data;

    const resultado = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(conteudo.iv)
      },
      chaveRemota,
      new Uint8Array(conteudo.dados)
    );

    const carregado = JSON.parse(decoder.decode(resultado));

    const novosDados = {
      clientes: Array.isArray(carregado.clientes) ? carregado.clientes : [],
      produtos: Array.isArray(carregado.produtos) ? carregado.produtos : [],
      vendas: Array.isArray(carregado.vendas) ? carregado.vendas : [],
      pagamentos: Array.isArray(carregado.pagamentos) ? carregado.pagamentos : []
    };

    const localExiste = !!localStorage.getItem(CHAVE_DADOS);

    if (localExiste) {
      const resposta = confirm(
        'Encontramos dados sincronizados na nuvem.\n\n' +
        'Deseja carregar a versão da nuvem neste aparelho?\n\n' +
        'Isso substituirá os dados locais atualmente carregados.'
      );

      if (!resposta) {
        mostrarStatusNuvem(
          'Dados locais mantidos. A versão da nuvem não foi carregada.'
        );
        return;
      }
    }

    carregandoNuvem = true;

    dados = novosDados;
    chaveCriptografia = chaveRemota;
    metadadosSenha = meta;

    localStorage.setItem(CHAVE_SENHA, JSON.stringify(meta));

    await salvarLocalSemNuvem();

    carregandoNuvem = false;

    atualizarTudo();

    mostrarStatusNuvem(
      'Dados da nuvem carregados com sucesso.'
    );

  } catch (erro) {
    carregandoNuvem = false;

    console.error('Erro na sincronização:', erro);

    mostrarStatusNuvem(
      'Falha na sincronização: ' + erro.message
    );

  } finally {
    carregandoNuvem = false;
    sincronizacaoEmAndamento = false;

    if (envioNuvemPendente && chaveCriptografia && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getSession();

        if (data.session) {
          await enviarDadosNuvem();
        }
      } catch (erro) {
        console.error('Erro ao concluir envio pendente:', erro);

        mostrarStatusNuvem(
          'Dados salvos no aparelho. Envio pendente: ' + erro.message
        );
      }
    }
  }
}

/* =========================================
   CRIPTOGRAFIA
========================================= */

async function derivarChave(senha, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(senha),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function criarMetadadosSenha(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const chave = await derivarChave(senha, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const teste = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chave,
    encoder.encode('DS Fashion')
  );

  return {
    chave,
    metadados: {
      salt: Array.from(salt),
      iv: Array.from(iv),
      teste: Array.from(new Uint8Array(teste))
    }
  };
}

/* =========================================
   SALVAMENTO LOCAL E BACKUP
========================================= */

async function salvarLocalSemNuvem() {
  if (!chaveCriptografia) {
    throw new Error('Aplicativo bloqueado.');
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const criptografado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chaveCriptografia,
    encoder.encode(JSON.stringify(dados))
  );

  const registro = JSON.stringify({
    iv: Array.from(iv),
    dados: Array.from(new Uint8Array(criptografado))
  });

  localStorage.setItem(CHAVE_DADOS, registro);

  const backup = {
    versao: 2,
    data: new Date().toISOString(),
    senha: localStorage.getItem(CHAVE_SENHA),
    dados: registro
  };

  localStorage.setItem(CHAVE_BACKUP, JSON.stringify(backup));

  atualizarStatusBackup();
}

async function salvarDados() {
  if (!chaveCriptografia) {
    throw new Error('Aplicativo bloqueado.');
  }

  const operacao = salvamentoEmAndamento
    .catch(() => {})
    .then(async () => {
      await salvarLocalSemNuvem();

      if (
        carregandoNuvem ||
        !supabaseClient
      ) {
        return;
      }

      const { data, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error('Erro ao verificar sessão:', error);
        return;
      }

      if (!data.session) return;

      if (sincronizacaoEmAndamento) {
        envioNuvemPendente = true;
        mostrarStatusNuvem(
          'Dados salvos no aparelho. Envio para a nuvem aguardando sincronização.'
        );
        return;
      }

      try {
        await enviarDadosNuvem();
      } catch (erro) {
        console.error('Erro ao enviar dados para a nuvem:', erro);

        envioNuvemPendente = true;

        mostrarStatusNuvem(
          'Dados salvos no aparelho. Falha ao sincronizar: ' +
          erro.message
        );
      }
    });

  salvamentoEmAndamento = operacao;

  return operacao;
}

async function carregarDados() {
  const registro = localStorage.getItem(CHAVE_DADOS);

  if (!registro) {
    dados = {
      clientes: [],
      produtos: [],
      vendas: [],
      pagamentos: []
    };

    return;
  }

  const item = JSON.parse(registro);

  const resultado = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(item.iv)
    },
    chaveCriptografia,
    new Uint8Array(item.dados)
  );

  const carregado = JSON.parse(decoder.decode(resultado));

  dados = {
    clientes: Array.isArray(carregado.clientes) ? carregado.clientes : [],
    produtos: Array.isArray(carregado.produtos) ? carregado.produtos : [],
    vendas: Array.isArray(carregado.vendas) ? carregado.vendas : [],
    pagamentos: Array.isArray(carregado.pagamentos) ? carregado.pagamentos : []
  };

  await salvarLocalSemNuvem();
}

/* =========================================
   SENHA E ACESSO
========================================= */

async function configurarSenha() {
  const senha = $('senha').value;
  const confirmacao = $('confirmacao').value;

  if (senha.length < 8) {
    mostrarMensagem('A senha precisa ter pelo menos 8 caracteres.');
    return;
  }

  if (senha !== confirmacao) {
    mostrarMensagem('As senhas não são iguais.');
    return;
  }

  try {
    const resultado = await criarMetadadosSenha(senha);

    chaveCriptografia = resultado.chave;
    metadadosSenha = resultado.metadados;
    senhaAplicativoAtual = senha;

    localStorage.setItem(
      CHAVE_SENHA,
      JSON.stringify(metadadosSenha)
    );

    dados = {
      clientes: [],
      produtos: [],
      vendas: [],
      pagamentos: []
    };

    await salvarLocalSemNuvem();

    await entrarNoAplicativo();

  } catch (erro) {
    console.error(erro);
    chaveCriptografia = null;

    mostrarMensagem('Erro ao configurar a senha. Tente novamente.');
  }
}

async function verificarSenha() {
  const senha = $('senha').value;
  const registroSalvo = localStorage.getItem(CHAVE_SENHA);

  if (!senha) {
    mostrarMensagem('Digite sua senha.');
    return;
  }

  if (!registroSalvo) {
    mostrarMensagem('Configuração de senha não encontrada.');
    return;
  }

  try {
    const registro = JSON.parse(registroSalvo);

    chaveCriptografia = await derivarChave(
      senha,
      new Uint8Array(registro.salt)
    );

    const resultado = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(registro.iv)
      },
      chaveCriptografia,
      new Uint8Array(registro.teste)
    );

    if (decoder.decode(resultado) !== 'DS Fashion') {
      throw new Error('Senha inválida');
    }

    senhaAplicativoAtual = senha;
    metadadosSenha = registro;

    await carregarDados();

    await entrarNoAplicativo();

  } catch (erro) {
    console.error(erro);
    chaveCriptografia = null;
    senhaAplicativoAtual = '';

    mostrarMensagem('Senha incorreta ou dados indisponíveis.');
  }
}

async function entrarNoAplicativo() {
  $('telaAcesso').classList.add('oculto');
  $('aplicativo').classList.remove('oculto');

  $('senha').value = '';
  $('confirmacao').value = '';
  mostrarMensagem('');

  criarPainelBackup();
  atualizarTudo();

  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
      sincronizarComNuvem();
    }
  }
}

function bloquearAplicativo() {
  if (!confirm('Deseja bloquear o aplicativo?')) return;

  chaveCriptografia = null;
  senhaAplicativoAtual = '';
  clienteDetalhadoId = null;

  $('aplicativo').classList.add('oculto');
  $('telaAcesso').classList.remove('oculto');

  $('senha').value = '';
  $('confirmacao').value = '';

  mostrarMensagem('');
}

/* =========================================
   BACKUP
========================================= */

function criarPainelBackup() {
  if ($('painelBackup')) return;

  const painel = document.createElement('div');

  painel.id = 'painelBackup';

  painel.style.cssText = `
    margin:12px;
    padding:14px;
    border-radius:12px;
    background:#f1edf5;
    color:#24152f;
  `;

  painel.innerHTML = `
    <strong>Segurança dos seus dados</strong>
    <p id="statusBackup" style="font-size:13px;margin:8px 0;">
      Salvamento automático ativado.
    </p>
    <button type="button" id="botaoBackupIcloud"
      style="padding:10px 14px;border:0;border-radius:8px;
      background:#24152f;color:white;">
      Exportar backup para iCloud / Arquivos
    </button>
  `;

  const nav = $('aplicativo').querySelector('nav');

  if (nav) {
    nav.parentNode.insertBefore(painel, nav);
  } else {
    $('aplicativo').prepend(painel);
  }

  $('botaoBackupIcloud').addEventListener('click', exportarBackup);

  atualizarStatusBackup();
}

function atualizarStatusBackup() {
  const status = $('statusBackup');
  if (!status) return;

  const backup = localStorage.getItem(CHAVE_BACKUP);

  if (!backup) {
    status.textContent = 'Aguardando primeiro salvamento.';
    return;
  }

  try {
    const item = JSON.parse(backup);

    status.textContent =
      'Backup automático atualizado em ' +
      new Date(item.data).toLocaleString('pt-BR');

  } catch {
    status.textContent = 'Backup disponível no aparelho.';
  }
}

async function exportarBackup() {
  try {
    await salvamentoEmAndamento;

    const backupSalvo = localStorage.getItem(CHAVE_BACKUP);

    if (!backupSalvo) {
      alert('Ainda não existe um backup para exportar.');
      return;
    }

    const arquivo = new File(
      [
        JSON.stringify({
          aplicativo: 'Controle DS Fashion',
          formato: 'Backup criptografado',
          backup: JSON.parse(backupSalvo)
        }, null, 2)
      ],
      'backup-ds-fashion.json',
      { type: 'application/json' }
    );

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [arquivo] })
    ) {
      await navigator.share({
        files: [arquivo],
        title: 'Backup Controle DS Fashion'
      });

      return;
    }

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'backup-ds-fashion.json';

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    alert('Backup exportado. Escolha onde deseja guardar o arquivo.');

  } catch (erro) {
    if (erro.name === 'AbortError') return;

    console.error(erro);

    alert('Não foi possível exportar o backup.');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && chaveCriptografia) {
    salvarDados().catch(console.error);
  }
});

window.addEventListener('pagehide', () => {
  if (chaveCriptografia) {
    salvarDados().catch(console.error);
  }
});

/* =========================================
   NAVEGAÇÃO
========================================= */

function abrirSecao(id, botao) {
  document.querySelectorAll('.secao').forEach(secao => {
    secao.classList.remove('ativa');
  });

  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('ativo');
  });

  $(id).classList.add('ativa');

  if (botao) botao.classList.add('ativo');
}

function atualizarTudo() {
  atualizarClientes();
  atualizarProdutos();
  atualizarVendas();
  atualizarPainel();
  atualizarSeletores();
  atualizarMargens();

  if (clienteDetalhadoId) {
    atualizarDetalheCliente();
  }
}

/* =========================================
   CLIENTES
========================================= */

function limparCliente() {
  $('formCliente').reset();
  $('clienteId').value = '';
  $('botaoCliente').textContent = 'Cadastrar cliente';
}

function atualizarClientes() {
  const pesquisa = $('pesquisaCliente').value.toLowerCase();
  const lista = $('listaClientes');

  const filtrados = dados.clientes.filter(c =>
    (c.nome || '').toLowerCase().includes(pesquisa) ||
    (c.telefone || '').toLowerCase().includes(pesquisa)
  );

  lista.innerHTML = '';

  if (!filtrados.length) {
    lista.innerHTML =
      '<tr><td colspan="3" class="vazio">Nenhum cliente cadastrado.</td></tr>';
    return;
  }

  filtrados.forEach(c => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <strong>${escapar(c.nome)}</strong>
        <button type="button"
          style="margin-top:6px;padding:7px 10px;font-size:12px"
          onclick="abrirDetalheCliente('${escapar(c.id)}')">
          Dívidas
        </button>
      </td>
      <td>${escapar(c.telefone || '-')}</td>
      <td>
        <div class="acoes">
          <button type="button" onclick="editarCliente('${escapar(c.id)}')">Editar</button>
          <button type="button" class="perigo"
            onclick="excluirCliente('${escapar(c.id)}')">Excluir</button>
        </div>
      </td>`;

    lista.appendChild(tr);
  });
}

$('formCliente').addEventListener('submit', async event => {
  event.preventDefault();

  const id = $('clienteId').value;
  const anterior = dados.clientes.find(c => c.id === id);

  const cliente = {
    ...(anterior || {}),
    id: id || gerarId(),
    nome: $('clienteNome').value.trim(),
    telefone: $('clienteTelefone').value.trim(),
    observacao: $('clienteObservacao').value.trim()
  };

  if (!cliente.nome) return;

  if (id) {
    const indice = dados.clientes.findIndex(c => c.id === id);
    if (indice >= 0) dados.clientes[indice] = cliente;
  } else {
    dados.clientes.push(cliente);
  }

  await salvarDados();

  limparCliente();
  atualizarTudo();

  alert('Cliente salvo com sucesso!');
});

function editarCliente(id) {
  const c = dados.clientes.find(item => item.id === id);
  if (!c) return;

  $('clienteId').value = c.id;
  $('clienteNome').value = c.nome || '';
  $('clienteTelefone').value = c.telefone || '';
  $('clienteObservacao').value = c.observacao || '';

  $('botaoCliente').textContent = 'Salvar alterações';

  abrirSecao('clientes', document.querySelectorAll('nav button')[1]);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirCliente(id) {
  const possuiVendas = dados.vendas.some(v => v.clienteId === id);
  const possuiPagamentos = dados.pagamentos.some(p => p.clienteId === id);

  let aviso = 'Deseja realmente excluir este cliente?';

  if (possuiVendas || possuiPagamentos) {
    aviso =
      'Este cliente possui histórico de vendas ou pagamentos. ' +
      'O cadastro será excluído, mas as movimentações serão mantidas. Deseja continuar?';
  }

  if (!confirm(aviso)) return;

  dados.clientes = dados.clientes.filter(c => c.id !== id);

  if (clienteDetalhadoId === id) fecharDetalheCliente();

  await salvarDados();
  atualizarTudo();
}

$('pesquisaCliente').addEventListener('input', atualizarClientes);

/* =========================================
   DÍVIDAS E PAGAMENTOS
========================================= */

function vendaPendente(v) {
  return v.status === 'pendente' || v.pagamento === 'Fiado';
}

function calcularAlocacoes(clienteId) {
  const vendasPendentes = dados.vendas
    .filter(v => v.clienteId === clienteId && vendaPendente(v))
    .slice()
    .sort((a, b) =>
      (a.data || '').localeCompare(b.data || '') ||
      (a.id || '').localeCompare(b.id || '')
    );

  const saldos = new Map();

  vendasPendentes.forEach(v => {
    saldos.set(v.id, centavos(v.valor));
  });

  const pagamentos = dados.pagamentos
    .filter(p => p.clienteId === clienteId)
    .slice()
    .sort((a, b) =>
      (a.data || '').localeCompare(b.data || '') ||
      (a.id || '').localeCompare(b.id || '')
    );

  const alocacoes = [];

  pagamentos.forEach(p => {
    let restante = centavos(p.valor);
    const valorPagamento = centavos(p.valor);

    const taxaTotal = centavos(
      p.taxaValor !== undefined
        ? p.taxaValor
        : numero(p.valor) * numero(p.taxaPercentual) / 100
    );

    for (const venda of vendasPendentes) {
      if (restante <= 0) break;

      const saldoAtual = saldos.get(venda.id) || 0;

      if (saldoAtual <= 0) continue;

      const aplicado = Math.min(restante, saldoAtual);

      const taxaParte = valorPagamento > 0
        ? Math.round(taxaTotal * aplicado / valorPagamento)
        : 0;

      alocacoes.push({
        pagamentoId: p.id,
        vendaId: venda.id,
        loja: venda.loja,
        valor: aplicado / 100,
        taxa: taxaParte / 100,
        liquido: (aplicado - taxaParte) / 100
      });

      saldos.set(venda.id, saldoAtual - aplicado);
      restante -= aplicado;
    }
  });

  return {
    saldos,
    alocacoes,
    vendasPendentes,
    pagamentos
  };
}

function obterResumoCliente(clienteId) {
  const calculo = calcularAlocacoes(clienteId);

  const totalDivida = calculo.vendasPendentes.reduce(
    (s, v) => s + numero(v.valor),
    0
  );

  const totalPago = calculo.alocacoes.reduce(
    (s, a) => s + a.valor,
    0
  );

  return {
    totalDivida,
    totalPago,
    saldoDevedor: Math.max(0, totalDivida - totalPago),
    ...calculo
  };
}

function abrirDetalheCliente(id) {
  const cliente = dados.clientes.find(c => c.id === id);
  if (!cliente) return;

  clienteDetalhadoId = id;

  $('detalheCliente').classList.remove('oculto');

  $('tituloDetalheCliente').textContent =
    'Financeiro de ' + cliente.nome;

  limparPagamento();
  atualizarDetalheCliente();

  $('detalheCliente').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function fecharDetalheCliente() {
  clienteDetalhadoId = null;

  $('detalheCliente').classList.add('oculto');

  limparPagamento();
}

function atualizarDetalheCliente() {
  const cliente = dados.clientes.find(c => c.id === clienteDetalhadoId);

  if (!cliente) {
    fecharDetalheCliente();
    return;
  }

  const resumo = obterResumoCliente(cliente.id);

  $('tituloDetalheCliente').textContent =
    'Financeiro de ' + cliente.nome;

  $('clienteTotalDivida').textContent = dinheiro(resumo.totalDivida);
  $('clienteTotalPago').textContent = dinheiro(resumo.totalPago);
  $('clienteSaldoDevedor').textContent = dinheiro(resumo.saldoDevedor);

  let painelCompras = $('painelComprasCliente');

  if (!painelCompras) {
    painelCompras = document.createElement('div');
    painelCompras.id = 'painelComprasCliente';

    painelCompras.style.cssText =
      'margin:16px 0;padding:14px;border:1px solid #ddd;border-radius:10px;';

    $('formPagamento').parentNode.insertBefore(
      painelCompras,
      $('formPagamento')
    );
  }

  const vendas = resumo.vendasPendentes;

  if (!vendas.length) {
    painelCompras.innerHTML = `
      <h3>Compras em aberto</h3>
      <p class="vazio">Este cliente não possui compras pendentes.</p>`;
  } else {
    const linhas = vendas.map(v => {
      const original = numero(v.valor);
      const saldo = (resumo.saldos.get(v.id) || 0) / 100;
      const pago = Math.max(0, original - saldo);

      return `
        <tr>
          <td>${escapar(formatarData(v.data))}</td>
          <td>${escapar(nomeLoja(v.loja))}</td>
          <td>${escapar(v.descricao || 'Venda sem descrição')}</td>
          <td>${dinheiro(original)}</td>
          <td>${dinheiro(pago)}</td>
          <td><strong>${dinheiro(saldo)}</strong></td>
        </tr>`;
    }).join('');

    painelCompras.innerHTML = `
      <h3>Compras que originaram a dívida</h3>
      <div class="listas">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Loja</th>
              <th>Produto / descrição</th>
              <th>Valor original</th>
              <th>Já pago</th>
              <th>Falta pagar</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }

  const lista = $('listaPagamentos');
  lista.innerHTML = '';

  const pagamentos = dados.pagamentos
    .filter(p => p.clienteId === cliente.id)
    .slice()
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  if (!pagamentos.length) {
    lista.innerHTML =
      '<tr><td colspan="6" class="vazio">Nenhum pagamento registrado.</td></tr>';
  } else {
    pagamentos.forEach(p => {
      const taxa = numero(
        p.taxaValor !== undefined
          ? p.taxaValor
          : numero(p.valor) * numero(p.taxaPercentual) / 100
      );

      const liquido = numero(p.valor) - taxa;

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapar(formatarData(p.data))}</td>
        <td>${dinheiro(p.valor)}</td>
        <td>${escapar(p.metodo || '-')}</td>
        <td>${dinheiro(taxa)}</td>
        <td>${dinheiro(liquido)}</td>
        <td>
          <div class="acoes">
            <button type="button" onclick="editarPagamento('${escapar(p.id)}')">Editar</button>
            <button type="button" class="perigo"
              onclick="excluirPagamento('${escapar(p.id)}')">Excluir</button>
          </div>
        </td>`;

      lista.appendChild(tr);
    });
  }
}

function limparPagamento() {
  if (!$('formPagamento')) return;

  $('formPagamento').reset();

  $('pagamentoId').value = '';
  $('pagamentoData').value = dataHoje();
  $('pagamentoTaxa').value = 0;

  $('botaoPagamento').textContent = 'Registrar pagamento';

  atualizarCamposTaxaPagamento();
}

function atualizarCamposTaxaPagamento() {
  const metodo = $('pagamentoMetodo').value;

  const usaCartao = [
    'Débito',
    'Crédito à vista',
    'Crédito parcelado'
  ].includes(metodo);

  $('camposTaxaPagamento').classList.toggle('oculto', !usaCartao);

  if (!usaCartao) $('pagamentoTaxa').value = 0;

  atualizarCalculoPagamento();
}

function atualizarCalculoPagamento() {
  const valor = numero($('pagamentoValor').value);
  const taxa = numero($('pagamentoTaxa').value);

  const taxaValor = valor * taxa / 100;

  $('pagamentoTaxaValor').textContent = dinheiro(taxaValor);
  $('pagamentoLiquido').textContent = dinheiro(valor - taxaValor);
}

$('pagamentoMetodo').addEventListener('change', atualizarCamposTaxaPagamento);
$('pagamentoValor').addEventListener('input', atualizarCalculoPagamento);
$('pagamentoTaxa').addEventListener('input', atualizarCalculoPagamento);

$('formPagamento').addEventListener('submit', async event => {
  event.preventDefault();

  const clienteId = clienteDetalhadoId;

  if (!clienteId) {
    alert('Selecione um cliente primeiro.');
    return;
  }

  const id = $('pagamentoId').value;
  const anterior = dados.pagamentos.find(p => p.id === id);

  const valor = numero($('pagamentoValor').value);
  const metodo = $('pagamentoMetodo').value;
  const taxaPercentual = numero($('pagamentoTaxa').value);

  if (valor <= 0) {
    alert('Informe um pagamento maior que zero.');
    return;
  }

  if (taxaPercentual < 0 || taxaPercentual > 100) {
    alert('Confira a taxa da maquininha.');
    return;
  }

  const resumo = obterResumoCliente(clienteId);

  const limiteDisponivel =
    resumo.saldoDevedor + (anterior ? numero(anterior.valor) : 0);

  if (valor > limiteDisponivel + 0.001) {
    alert(
      'O pagamento não pode ser maior que a dívida disponível. ' +
      'Saldo disponível: ' + dinheiro(limiteDisponivel)
    );

    return;
  }

  const usaCartao = [
    'Débito',
    'Crédito à vista',
    'Crédito parcelado'
  ].includes(metodo);

  const taxaReal = usaCartao ? taxaPercentual : 0;
  const taxaValor = valor * taxaReal / 100;

  const pagamento = {
    ...(anterior || {}),
    id: id || gerarId(),
    clienteId,
    data: $('pagamentoData').value,
    valor,
    metodo,
    taxaPercentual: taxaReal,
    taxaValor,
    liquido: valor - taxaValor,
    observacao: $('pagamentoObservacao').value.trim()
  };

  if (!pagamento.data) {
    alert('Informe a data do pagamento.');
    return;
  }

  if (id) {
    const indice = dados.pagamentos.findIndex(p => p.id === id);
    if (indice >= 0) dados.pagamentos[indice] = pagamento;
  } else {
    dados.pagamentos.push(pagamento);
  }

  await salvarDados();

  limparPagamento();
  atualizarTudo();

  alert('Pagamento registrado com sucesso!');
});

function editarPagamento(id) {
  const p = dados.pagamentos.find(item => item.id === id);

  if (!p || p.clienteId !== clienteDetalhadoId) return;

  $('pagamentoId').value = p.id;
  $('pagamentoData').value = p.data || '';
  $('pagamentoValor').value = p.valor;
  $('pagamentoMetodo').value = p.metodo || 'Dinheiro';
  $('pagamentoTaxa').value = p.taxaPercentual || 0;
  $('pagamentoObservacao').value = p.observacao || '';

  $('botaoPagamento').textContent = 'Salvar alterações';

  atualizarCamposTaxaPagamento();

  $('formPagamento').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function excluirPagamento(id) {
  const pagamento = dados.pagamentos.find(p => p.id === id);

  if (!pagamento || pagamento.clienteId !== clienteDetalhadoId) return;

  if (!confirm(
    'Deseja excluir este pagamento? A dívida será recalculada automaticamente.'
  )) return;

  dados.pagamentos = dados.pagamentos.filter(p => p.id !== id);

  await salvarDados();

  limparPagamento();
  atualizarTudo();
}

/* =========================================
   PRODUTOS
========================================= */

function limparProduto() {
  $('formProduto').reset();
  $('produtoId').value = '';
  $('botaoProduto').textContent = 'Cadastrar produto';
  atualizarMargens();
}

function atualizarMargens() {
  const custo = $('produtoCusto') ? numero($('produtoCusto').value) : 0;
  const venda = $('produtoVenda') ? numero($('produtoVenda').value) : 0;

  if ($('margemProduto')) {
    $('margemProduto').textContent =
      percentual(custo, venda).toFixed(2).replace('.', ',') + '%';
  }

  const custoVenda = numero($('vendaCusto').value);
  const valorVenda = numero($('vendaValor').value);
  const taxa = numero($('vendaTaxa').value);

  const bruto = valorVenda - custoVenda;
  const taxaValor = valorVenda * taxa / 100;
  const liquido = valorVenda - taxaValor;
  const lucroReal = liquido - custoVenda;

  $('vendaLucroBruto').textContent = dinheiro(bruto);

  $('vendaMargem').textContent =
    percentual(custoVenda, valorVenda).toFixed(2).replace('.', ',') + '%';

  $('vendaTaxaValor').textContent = dinheiro(taxaValor);
  $('vendaLiquido').textContent = dinheiro(liquido);
  $('vendaLucroReal').textContent = dinheiro(lucroReal);
}

$('vendaCusto').addEventListener('input', atualizarMargens);
$('vendaValor').addEventListener('input', atualizarMargens);
$('vendaTaxa').addEventListener('input', atualizarMargens);

function atualizarProdutos() {
  const lista = $('listaProdutos');

  lista.innerHTML = '';

  if (!dados.produtos.length) {
    lista.innerHTML =
      '<tr><td colspan="3" class="vazio">Nenhum produto cadastrado.</td></tr>';

    return;
  }

  dados.produtos.forEach(p => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapar(nomeLoja(p.loja))}</td>
      <td>${escapar(p.nome)}</td>
      <td>
        <div class="acoes">
          <button type="button" onclick="editarProduto('${escapar(p.id)}')">Editar</button>
          <button type="button" class="perigo"
            onclick="excluirProduto('${escapar(p.id)}')">Excluir</button>
        </div>
      </td>`;

    lista.appendChild(tr);
  });
}

$('formProduto').addEventListener('submit', async event => {
  event.preventDefault();

  const id = $('produtoId').value;
  const anterior = dados.produtos.find(p => p.id === id);

  const produto = {
    ...(anterior || {}),
    id: id || gerarId(),
    loja: $('produtoLoja').value,
    nome: $('produtoNome').value.trim()
  };

  if (!produto.nome) return;

  if (id) {
    const indice = dados.produtos.findIndex(p => p.id === id);
    if (indice >= 0) dados.produtos[indice] = produto;
  } else {
    dados.produtos.push(produto);
  }

  await salvarDados();

  limparProduto();
  atualizarTudo();

  alert('Produto salvo com sucesso!');
});

function editarProduto(id) {
  const p = dados.produtos.find(item => item.id === id);
  if (!p) return;

  $('produtoId').value = p.id;
  $('produtoLoja').value = p.loja;
  $('produtoNome').value = p.nome;

  $('botaoProduto').textContent = 'Salvar alterações';

  atualizarMargens();

  abrirSecao('produtos', document.querySelectorAll('nav button')[2]);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirProduto(id) {
  if (!confirm('Deseja excluir este produto? As vendas serão mantidas.')) return;

  dados.produtos = dados.produtos.filter(p => p.id !== id);

  await salvarDados();
  atualizarTudo();
}

/* =========================================
   VENDAS
========================================= */

function alternarCadastroRapido(id) {
  const elemento = $(id);
  if (elemento) elemento.classList.toggle('oculto');
}

async function salvarClienteRapido() {
  const nome = $('novoClienteNome').value.trim();
  const telefone = $('novoClienteTelefone').value.trim();
  const observacao = $('novoClienteObservacao').value.trim();

  if (!nome) {
    alert('Informe o nome do cliente.');
    $('novoClienteNome').focus();
    return;
  }

  const cliente = {
    id: gerarId(),
    nome,
    telefone,
    observacao
  };

  try {
    dados.clientes.push(cliente);

    await salvarDados();

    atualizarTudo();

    $('vendaCliente').value = cliente.id;

    $('novoClienteNome').value = '';
    $('novoClienteTelefone').value = '';
    $('novoClienteObservacao').value = '';

    $('cadastroRapidoCliente').classList.add('oculto');

    alert('Cliente cadastrado e selecionado para esta venda!');

  } catch (erro) {
    console.error(erro);

    dados.clientes = dados.clientes.filter(c => c.id !== cliente.id);

    alert('Não foi possível salvar o cliente.');
  }
}

function limparVenda() {
  $('formVenda').reset();

  $('vendaId').value = '';
  $('vendaData').value = dataHoje();
  $('vendaTaxa').value = 0;
  $('vendaStatus').value = 'recebido';
  $('vendaParcelas').value = '1';

  $('botaoVenda').textContent = 'Registrar venda';

  atualizarSeletores();
  atualizarMargens();
}

function atualizarSeletores() {
  const clienteAtual = $('vendaCliente').value;

  $('vendaCliente').innerHTML =
    '<option value="">Venda sem cliente cadastrado</option>';

  dados.clientes.forEach(c => {
    const option = document.createElement('option');

    option.value = c.id;
    option.textContent = c.nome;

    $('vendaCliente').appendChild(option);
  });

  $('vendaCliente').value = clienteAtual;
}

$('vendaLoja').addEventListener('change', atualizarSeletores);

$('vendaPagamento').addEventListener('change', () => {
  if ($('vendaPagamento').value === 'Fiado') {
    $('vendaStatus').value = 'pendente';
  }
});

$('vendaStatus').addEventListener('change', () => {
  if ($('vendaPagamento').value === 'Fiado') {
    $('vendaStatus').value = 'pendente';
  }
});

$('formVenda').addEventListener('submit', async event => {
  event.preventDefault();

  const id = $('vendaId').value;
  const custo = numero($('vendaCusto').value);
  const valor = numero($('vendaValor').value);
  const taxaPercentual = numero($('vendaTaxa').value);
  const pagamentoMetodo = $('vendaPagamento').value;

  if (valor <= 0) {
    alert('Informe um valor de venda maior que zero.');
    return;
  }

  if (custo < 0 || taxaPercentual < 0 || taxaPercentual > 100) {
    alert('Confira os valores de custo e taxa.');
    return;
  }

  if (pagamentoMetodo === 'Fiado' && !$('vendaCliente').value) {
    alert('Para registrar uma venda fiada, selecione um cliente.');
    return;
  }

  if (
    valor < custo &&
    !confirm('O preço de venda está abaixo do custo. Deseja continuar?')
  ) return;

  const taxaValor = valor * taxaPercentual / 100;

  const venda = {
    id: id || gerarId(),
    loja: $('vendaLoja').value,
    data: $('vendaData').value,
    clienteId: $('vendaCliente').value,
    descricao: $('vendaDescricao').value.trim() || 'Venda sem descrição',
    custo,
    valor,
    pagamento: pagamentoMetodo,
    taxaPercentual,
    taxaValor,
    parcelas: Number($('vendaParcelas').value || 1),
    status: pagamentoMetodo === 'Fiado'
      ? 'pendente'
      : $('vendaStatus').value,
    observacao: $('vendaObservacao').value.trim()
  };

  if (id) {
    const indice = dados.vendas.findIndex(v => v.id === id);

    if (indice >= 0) {
      dados.vendas[indice] = {
        ...dados.vendas[indice],
        ...venda
      };
    }
  } else {
    dados.vendas.push(venda);
  }

  await salvarDados();

  limparVenda();
  atualizarTudo();

  alert('Venda registrada com sucesso!');
});

function atualizarVendas() {
  const lista = $('listaVendas');
  const filtro = $('filtroHistorico').value;

  lista.innerHTML = '';

  const vendas = dados.vendas
    .filter(v => filtro === 'todas' || v.loja === filtro)
    .slice()
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  if (!vendas.length) {
    lista.innerHTML =
      '<tr><td colspan="8" class="vazio">Nenhuma venda encontrada.</td></tr>';

    return;
  }

  vendas.forEach(v => {
    const taxa = vendaPendente(v) ? 0 : numero(v.taxaValor);
    const lucro = numero(v.valor) - numero(v.custo) - taxa;

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapar(formatarData(v.data))}</td>
      <td>${escapar(nomeLoja(v.loja))}</td>
      <td>${escapar(v.descricao)}</td>
      <td>${dinheiro(v.valor)}</td>
      <td>${dinheiro(numero(v.taxaValor))}</td>
      <td>${dinheiro(lucro)}</td>
      <td>${vendaPendente(v) ? 'A receber' : 'Recebido'}</td>
      <td>
        <div class="acoes">
          <button type="button" onclick="editarVenda('${escapar(v.id)}')">Editar</button>
          <button type="button" class="perigo"
            onclick="excluirVenda('${escapar(v.id)}')">Excluir</button>
        </div>
      </td>`;

    lista.appendChild(tr);
  });
}

$('filtroHistorico').addEventListener('change', atualizarVendas);

function editarVenda(id) {
  const v = dados.vendas.find(item => item.id === id);
  if (!v) return;

  $('vendaId').value = v.id;
  $('vendaLoja').value = v.loja;

  atualizarSeletores();

  $('vendaData').value = v.data || '';
  $('vendaCliente').value = v.clienteId || '';
  $('vendaDescricao').value = v.descricao || '';
  $('vendaCusto').value = v.custo;
  $('vendaValor').value = v.valor;
  $('vendaPagamento').value = v.pagamento || 'Dinheiro';
  $('vendaTaxa').value = v.taxaPercentual || 0;
  $('vendaParcelas').value = String(v.parcelas || 1);
  $('vendaStatus').value = v.status || 'recebido';
  $('vendaObservacao').value = v.observacao || '';

  $('botaoVenda').textContent = 'Salvar alterações';

  if (v.pagamento === 'Fiado') {
    $('vendaStatus').value = 'pendente';
  }

  atualizarMargens();

  abrirSecao('vendas', document.querySelectorAll('nav button')[3]);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirVenda(id) {
  if (!confirm(
    'Deseja excluir esta venda? Os pagamentos registrados serão mantidos.'
  )) return;

  dados.vendas = dados.vendas.filter(v => v.id !== id);

  await salvarDados();
  atualizarTudo();
}

/* =========================================
   PAINÉIS FINANCEIROS
========================================= */

function criarResumoLoja(loja) {
  const vendas = dados.vendas.filter(v => v.loja === loja);

  const faturamento = vendas.reduce((s, v) => s + numero(v.valor), 0);
  const custos = vendas.reduce((s, v) => s + numero(v.custo), 0);

  let taxas = 0;
  let recebido = 0;
  let aReceber = 0;

  vendas.forEach(v => {
    if (!vendaPendente(v)) {
      const taxa = numero(v.taxaValor);

      taxas += taxa;
      recebido += numero(v.valor) - taxa;
    } else {
      aReceber += numero(v.valor);
    }
  });

  const clientesComMovimento = new Set([
    ...vendas.filter(v => v.clienteId).map(v => v.clienteId),
    ...dados.pagamentos.map(p => p.clienteId)
  ]);

  clientesComMovimento.forEach(clienteId => {
    const calculo = calcularAlocacoes(clienteId);

    calculo.alocacoes.forEach(a => {
      if (a.loja !== loja) return;

      aReceber -= a.valor;
      recebido += a.liquido;
      taxas += a.taxa;
    });
  });

  aReceber = Math.max(0, aReceber);

  const lucro = faturamento - custos - taxas;

  const clientes = new Set(
    vendas.filter(v => v.clienteId).map(v => v.clienteId)
  );

  return {
    faturamento,
    custos,
    taxas,
    lucro,
    recebido,
    aReceber,
    quantidadeVendas: vendas.length,
    quantidadeClientes: clientes.size
  };
}

function preencherPainel(prefixo, resumo) {
  $(prefixo + 'Faturamento').textContent = dinheiro(resumo.faturamento);
  $(prefixo + 'Custos').textContent = dinheiro(resumo.custos);
  $(prefixo + 'Taxas').textContent = dinheiro(resumo.taxas);
  $(prefixo + 'Lucro').textContent = dinheiro(resumo.lucro);
  $(prefixo + 'Recebido').textContent = dinheiro(resumo.recebido);
  $(prefixo + 'AReceber').textContent = dinheiro(resumo.aReceber);
  $(prefixo + 'Vendas').textContent = resumo.quantidadeVendas;
  $(prefixo + 'Clientes').textContent = resumo.quantidadeClientes;
}

function atualizarPainel() {
  const roupas = criarResumoLoja('roupas');
  const joias = criarResumoLoja('joias');

  preencherPainel('roupas', roupas);
  preencherPainel('joias', joias);

  const total = {
    faturamento: roupas.faturamento + joias.faturamento,
    custos: roupas.custos + joias.custos,
    taxas: roupas.taxas + joias.taxas,
    lucro: roupas.lucro + joias.lucro,
    recebido: roupas.recebido + joias.recebido,
    aReceber: roupas.aReceber + joias.aReceber,
    quantidadeVendas: roupas.quantidadeVendas + joias.quantidadeVendas,
    quantidadeClientes: dados.clientes.length
  };

  $('totalFaturamento').textContent = dinheiro(total.faturamento);
  $('totalCustos').textContent = dinheiro(total.custos);
  $('totalTaxas').textContent = dinheiro(total.taxas);
  $('totalLucro').textContent = dinheiro(total.lucro);
  $('totalRecebido').textContent = dinheiro(total.recebido);
  $('totalAReceber').textContent = dinheiro(total.aReceber);
  $('quantidadeVendas').textContent = total.quantidadeVendas;
  $('quantidadeClientes').textContent = total.quantidadeClientes;
}

/* =========================================
   FUNÇÕES AUXILIARES
========================================= */

function nomeLoja(loja) {
  return loja === 'joias' ? 'Joias' : 'Roupas';
}

function formatarData(data) {
  if (!data) return '';

  const partes = data.split('-');

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : data;
}

function dataHoje() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caractere]);
}

/* =========================================
   INICIALIZAÇÃO
========================================= */

document.addEventListener('DOMContentLoaded', () => {
  iniciarSupabase();

  const existeSenha = !!localStorage.getItem(CHAVE_SENHA);

  $('campoConfirmacao').classList.toggle('oculto', existeSenha);

  $('tituloAcesso').textContent = existeSenha
    ? 'Acesso protegido'
    : 'Crie sua senha';

  $('descricaoAcesso').textContent = existeSenha
    ? 'Digite sua senha para entrar no aplicativo.'
    : 'Escolha uma senha pessoal com pelo menos 8 caracteres.';

  $('botaoAcesso').textContent = existeSenha
    ? 'Entrar'
    : 'Criar minha senha';

  $('botaoAcesso').addEventListener('click', () => {
    if (localStorage.getItem(CHAVE_SENHA)) {
      verificarSenha();
    } else {
      configurarSenha();
    }
  });

  $('botaoCriarContaNuvem').addEventListener(
    'click',
    criarContaNuvem
  );

  $('botaoEntrarNuvem').addEventListener(
    'click',
    entrarNuvem
  );

  $('botaoSairNuvem').addEventListener(
    'click',
    sairNuvem
  );

  $('senha').addEventListener('keydown', event => {
    if (event.key === 'Enter') $('botaoAcesso').click();
  });

  $('confirmacao').addEventListener('keydown', event => {
    if (event.key === 'Enter') $('botaoAcesso').click();
  });

  $('vendaData').value = dataHoje();
  $('pagamentoData').value = dataHoje();
});
