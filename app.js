
const $ = id => document.getElementById(id);

const CHAVE_SENHA = 'ds-fashion-password';
const CHAVE_DADOS = 'ds-fashion-data';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let chaveCriptografia = null;
let dados = {
  clientes: [],
  produtos: [],
  vendas: []
};

let lojaAtual = 'geral';

const dinheiro = valor => Number(valor || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const numero = valor => Number(valor || 0);

const percentual = (custo, venda) => {
  venda = numero(venda);
  if (venda <= 0) return 0;
  return ((venda - numero(custo)) / venda) * 100;
};

const gerarId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

function mostrarMensagem(texto) {
  $('mensagem').textContent = texto;
}

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

async function salvarDados() {
  if (!chaveCriptografia) {
    throw new Error('Aplicativo bloqueado.');
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const criptografado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chaveCriptografia,
    encoder.encode(JSON.stringify(dados))
  );

  localStorage.setItem(CHAVE_DADOS, JSON.stringify({
    iv: Array.from(iv),
    dados: Array.from(new Uint8Array(criptografado))
  }));
}

async function carregarDados() {
  const registro = localStorage.getItem(CHAVE_DADOS);

  if (!registro) {
    dados = { clientes: [], produtos: [], vendas: [] };
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
    vendas: Array.isArray(carregado.vendas) ? carregado.vendas : []
  };
}

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
    const salt = crypto.getRandomValues(new Uint8Array(16));
    chaveCriptografia = await derivarChave(senha, salt);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const teste = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      chaveCriptografia,
      encoder.encode('DS Fashion')
    );

    localStorage.setItem(CHAVE_SENHA, JSON.stringify({
      salt: Array.from(salt),
      iv: Array.from(iv),
      teste: Array.from(new Uint8Array(teste))
    }));

    dados = { clientes: [], produtos: [], vendas: [] };
    await salvarDados();
    await entrarNoAplicativo();

  } catch (erro) {
    console.error(erro);
    chaveCriptografia = null;
    mostrarMensagem('Erro ao configurar a senha. Tente novamente.');
  }
}

async function verificarSenha() {
  const senha = $('senha').value;
  const registro = JSON.parse(localStorage.getItem(CHAVE_SENHA));

  if (!senha) {
    mostrarMensagem('Digite sua senha.');
    return;
  }

  try {
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

    await carregarDados();
    await entrarNoAplicativo();

  } catch (erro) {
    console.error(erro);
    chaveCriptografia = null;
    mostrarMensagem('Senha incorreta ou dados indisponíveis.');
  }
}

async function entrarNoAplicativo() {
  $('telaAcesso').classList.add('oculto');
  $('aplicativo').classList.remove('oculto');

  $('senha').value = '';
  $('confirmacao').value = '';
  mostrarMensagem('');

  atualizarTudo();
}

function bloquearAplicativo() {
  chaveCriptografia = null;
  $('aplicativo').classList.add('oculto');
  $('telaAcesso').classList.remove('oculto');
  $('senha').value = '';
  $('confirmacao').value = '';
  mostrarMensagem('');
}

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
}

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
    lista.innerHTML = '<tr><td colspan="3" class="vazio">Nenhum cliente cadastrado.</td></tr>';
    return;
  }

  filtrados.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapar(c.nome)}</td>
      <td>${escapar(c.telefone || '-')}</td>
      <td>
        <div class="acoes">
          <button type="button" onclick="editarCliente('${c.id}')">Editar</button>
          <button type="button" class="perigo" onclick="excluirCliente('${c.id}')">Excluir</button>
        </div>
      </td>`;
    lista.appendChild(tr);
  });
}

$('formCliente').addEventListener('submit', async event => {
  event.preventDefault();

  const id = $('clienteId').value;
  const cliente = {
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

  if (!confirm(
    possuiVendas
      ? 'Este cliente possui vendas vinculadas. Excluir o cadastro? O histórico das vendas será mantido.'
      : 'Deseja realmente excluir este cliente?'
  )) return;

  dados.clientes = dados.clientes.filter(c => c.id !== id);
  await salvarDados();
  atualizarTudo();
}

$('pesquisaCliente').addEventListener('input', atualizarClientes);

function limparProduto() {
  $('formProduto').reset();
  $('produtoId').value = '';
  $('botaoProduto').textContent = 'Cadastrar produto';
  atualizarMargens();
}

function atualizarMargens() {
  const custo = numero($('produtoCusto').value);
  const venda = numero($('produtoVenda').value);

  $('margemProduto').textContent =
    percentual(custo, venda).toFixed(2).replace('.', ',') + '%';

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

$('produtoCusto').addEventListener('input', atualizarMargens);
$('produtoVenda').addEventListener('input', atualizarMargens);
$('vendaCusto').addEventListener('input', atualizarMargens);
$('vendaValor').addEventListener('input', atualizarMargens);
$('vendaTaxa').addEventListener('input', atualizarMargens);

function atualizarProdutos() {
  const lista = $('listaProdutos');
  lista.innerHTML = '';

  if (!dados.produtos.length) {
    lista.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum produto cadastrado.</td></tr>';
    return;
  }

  dados.produtos.forEach(p => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${nomeLoja(p.loja)}</td>
      <td>${escapar(p.nome)}</td>
      <td>${dinheiro(p.custo)}</td>
      <td>${dinheiro(p.venda)}</td>
      <td>${percentual(p.custo, p.venda).toFixed(2)}%</td>
      <td>
        <div class="acoes">
          <button type="button" onclick="editarProduto('${p.id}')">Editar</button>
          <button type="button" class="perigo" onclick="excluirProduto('${p.id}')">Excluir</button>
        </div>
      </td>`;

    lista.appendChild(tr);
  });
}

$('formProduto').addEventListener('submit', async event => {
  event.preventDefault();

  const id = $('produtoId').value;

  const produto = {
    id: id || gerarId(),
    loja: $('produtoLoja').value,
    nome: $('produtoNome').value.trim(),
    custo: numero($('produtoCusto').value),
    venda: numero($('produtoVenda').value)
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
  $('produtoCusto').value = p.custo;
  $('produtoVenda').value = p.venda;
  $('botaoProduto').textContent = 'Salvar alterações';

  atualizarMargens();
  abrirSecao('produtos', document.querySelectorAll('nav button')[2]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirProduto(id) {
  if (!confirm('Deseja realmente excluir este produto? As vendas já registradas serão mantidas.')) return;

  dados.produtos = dados.produtos.filter(p => p.id !== id);
  await salvarDados();
  atualizarTudo();
}

function limparVenda() {
  $('formVenda').reset();
  $('vendaId').value = '';
  $('vendaData').value = new Date().toLocaleDateString('en-CA');
  $('vendaTaxa').value = 0;
  $('vendaStatus').value = 'recebido';
  $('vendaParcelas').value = '1';
  $('botaoVenda').textContent = 'Registrar venda';
  atualizarSeletores();
  atualizarMargens();
}

function atualizarSeletores() {
  const clienteAtual = $('vendaCliente').value;
  const produtoAtual = $('vendaProduto').value;

  $('vendaCliente').innerHTML =
    '<option value="">Venda sem cliente cadastrado</option>';

  dados.clientes.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.nome;
    $('vendaCliente').appendChild(option);
  });

  $('vendaCliente').value = clienteAtual;

  $('vendaProduto').innerHTML =
    '<option value="">Digitar produto manualmente</option>';

  dados.produtos
    .filter(p => p.loja === $('vendaLoja').value)
    .forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.nome;
      $('vendaProduto').appendChild(option);
    });

  $('vendaProduto').value = produtoAtual;
}

$('vendaLoja').addEventListener('change', atualizarSeletores);

$('vendaProduto').addEventListener('change', () => {
  const p = dados.produtos.find(item => item.id === $('vendaProduto').value);
  if (!p) return;

  $('vendaDescricao').value = p.nome;
  $('vendaCusto').value = p.custo;
  $('vendaValor').value = p.venda;

  atualizarMargens();
});

$('formVenda').addEventListener('submit', async event => {
  event.preventDefault();

  const id = $('vendaId').value;
  const custo = numero($('vendaCusto').value);
  const valor = numero($('vendaValor').value);
  const taxaPercentual = numero($('vendaTaxa').value);

  if (valor <= 0) {
    alert('Informe um valor de venda maior que zero.');
    return;
  }

  if (custo < 0 || taxaPercentual < 0 || taxaPercentual > 100) {
    alert('Confira os valores de custo e taxa.');
    return;
  }

  if (valor < custo && !confirm('O preço de venda está abaixo do custo. Deseja continuar?')) {
    return;
  }

  const taxaValor = valor * taxaPercentual / 100;

  const venda = {
    id: id || gerarId(),
    loja: $('vendaLoja').value,
    data: $('vendaData').value,
    clienteId: $('vendaCliente').value,
    produtoId: $('vendaProduto').value,
    descricao: $('vendaDescricao').value.trim() || 'Venda sem descrição',
    custo,
    valor,
    pagamento: $('vendaPagamento').value,
    taxaPercentual,
    taxaValor,
    parcelas: Number($('vendaParcelas').value || 1),
    status: $('vendaStatus').value,
    observacao: $('vendaObservacao').value.trim()
  };

  if (id) {
    const indice = dados.vendas.findIndex(v => v.id === id);
    if (indice >= 0) dados.vendas[indice] = venda;
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
    lista.innerHTML = '<tr><td colspan="8" class="vazio">Nenhuma venda encontrada.</td></tr>';
    return;
  }

  vendas.forEach(v => {
    const lucro = numero(v.valor) - numero(v.custo) - numero(v.taxaValor);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapar(formatarData(v.data))}</td>
      <td>${nomeLoja(v.loja)}</td>
      <td>${escapar(v.descricao)}</td>
      <td>${dinheiro(v.valor)}</td>
      <td>${dinheiro(v.taxaValor)}</td>
      <td>${dinheiro(lucro)}</td>
      <td>${v.status === 'recebido' ? 'Recebido' : 'A receber'}</td>
      <td>
        <div class="acoes">
          <button type="button" onclick="editarVenda('${v.id}')">Editar</button>
          <button type="button" class="perigo" onclick="excluirVenda('${v.id}')">Excluir</button>
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
  $('vendaProduto').value = v.produtoId || '';
  $('vendaDescricao').value = v.descricao || '';
  $('vendaCusto').value = v.custo;
  $('vendaValor').value = v.valor;
  $('vendaPagamento').value = v.pagamento || 'Dinheiro';
  $('vendaTaxa').value = v.taxaPercentual || 0;
  $('vendaParcelas').value = String(v.parcelas || 1);
  $('vendaStatus').value = v.status || 'recebido';
  $('vendaObservacao').value = v.observacao || '';
  $('botaoVenda').textContent = 'Salvar alterações';

  atualizarMargens();
  abrirSecao('vendas', document.querySelectorAll('nav button')[3]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirVenda(id) {
  if (!confirm('Deseja realmente excluir esta venda?')) return;

  dados.vendas = dados.vendas.filter(v => v.id !== id);
  await salvarDados();
  atualizarTudo();
}

function atualizarPainel() {
  const vendas = dados.vendas;

  const faturamento = vendas.reduce((s, v) => s + numero(v.valor), 0);
  const custos = vendas.reduce((s, v) => s + numero(v.custo), 0);
  const taxas = vendas.reduce((s, v) => s + numero(v.taxaValor), 0);
  const lucro = faturamento - custos - taxas;

  const recebidas = vendas
    .filter(v => v.status === 'recebido')
    .reduce((s, v) => s + numero(v.valor) - numero(v.taxaValor), 0);

  const pendentes = vendas
    .filter(v => v.status === 'pendente')
    .reduce((s, v) => s + numero(v.valor), 0);

  $('totalFaturamento').textContent = dinheiro(faturamento);
  $('totalCustos').textContent = dinheiro(custos);
  $('totalTaxas').textContent = dinheiro(taxas);
  $('totalLucro').textContent = dinheiro(lucro);
  $('totalRecebido').textContent = dinheiro(recebidas);
  $('totalAReceber').textContent = dinheiro(pendentes);
  $('quantidadeVendas').textContent = vendas.length;
  $('quantidadeClientes').textContent = dados.clientes.length;

  const lucroRoupas = vendas
    .filter(v => v.loja === 'roupas')
    .reduce((s, v) => s + numero(v.valor) - numero(v.custo) - numero(v.taxaValor), 0);

  const lucroJoias = vendas
    .filter(v => v.loja === 'joias')
    .reduce((s, v) => s + numero(v.valor) - numero(v.custo) - numero(v.taxaValor), 0);

  $('lucroRoupas').textContent = dinheiro(lucroRoupas);
  $('lucroJoias').textContent = dinheiro(lucroJoias);
}

function nomeLoja(loja) {
  return loja === 'joias' ? 'Joias' : 'Roupas';
}

function formatarData(data) {
  if (!data) return '';
  const partes = data.split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data;
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

document.addEventListener('DOMContentLoaded', () => {
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

  $('senha').addEventListener('keydown', event => {
    if (event.key === 'Enter') $('botaoAcesso').click();
  });

  $('confirmacao').addEventListener('keydown', event => {
    if (event.key === 'Enter') $('botaoAcesso').click();
  });

  $('vendaData').value = new Date().toLocaleDateString('en-CA');
});
