
const $ = id => document.getElementById(id);

const CHAVE_SENHA = 'ds-fashion-password';
const CHAVE_DADOS = 'ds-fashion-data';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let chaveCriptografia = null;
let clienteDetalhadoId = null;

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

    dados = {
      clientes: [],
      produtos: [],
      vendas: [],
      pagamentos: []
    };

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
  clienteDetalhadoId = null;

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
          <button type="button" onclick="abrirDetalheCliente('${c.id}')">Dívidas</button>
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
      'O cadastro será excluído, mas as vendas e os registros financeiros serão mantidos. Deseja continuar?';
  }

  if (!confirm(aviso)) return;

  dados.clientes = dados.clientes.filter(c => c.id !== id);

  if (clienteDetalhadoId === id) {
    fecharDetalheCliente();
  }

  await salvarDados();
  atualizarTudo();
}

$('pesquisaCliente').addEventListener('input', atualizarClientes);

/* =========================================
   DÍVIDAS E PAGAMENTOS DOS CLIENTES
========================================= */

function calcularAlocacoes(clienteId) {
  const vendasPendentes = dados.vendas
    .filter(v =>
      v.clienteId === clienteId &&
      (v.status === 'pendente' || v.pagamento === 'Fiado')
    )
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

      let taxaParte = 0;

      if (valorPagamento > 0) {
        taxaParte = Math.round(taxaTotal * aplicado / valorPagamento);
      }

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

  return { saldos, alocacoes, vendasPendentes, pagamentos };
}

function obterResumoCliente(clienteId) {
  const calculo = calcularAlocacoes(clienteId);

  const totalDivida = calculo.vendasPendentes.reduce(
    (s, v) => s + numero(v.valor),
    0
  );

  const totalPago = calculo.pagamentos.reduce(
    (s, p) => s + numero(p.valor),
    0
  );

  const saldoDevedor = Math.max(0, totalDivida - totalPago);

  return {
    totalDivida,
    totalPago,
    saldoDevedor,
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

  const lista = $('listaPagamentos');
  lista.innerHTML = '';

  const pagamentos = dados.pagamentos
    .filter(p => p.clienteId === cliente.id)
    .slice()
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  if (!pagamentos.length) {
    lista.innerHTML =
      '<tr><td colspan="6" class="vazio">Nenhum pagamento registrado.</td></tr>';
    return;
  }

  pagamentos.forEach(p => {
    const taxa = numero(p.taxaValor);
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
          <button type="button" onclick="editarPagamento('${p.id}')">Editar</button>
          <button type="button" class="perigo" onclick="excluirPagamento('${p.id}')">Excluir</button>
        </div>
      </td>`;

    lista.appendChild(tr);
  });
}

function limparPagamento() {
  if (!$('formPagamento')) return;

  $('formPagamento').reset();
  $('pagamentoId').value = '';
  $('pagamentoData').value = new Date().toLocaleDateString('en-CA');
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

  if (!usaCartao) {
    $('pagamentoTaxa').value = 0;
  }

  atualizarCalculoPagamento();
}

function atualizarCalculoPagamento() {
  const valor = numero($('pagamentoValor').value);
  const taxa = numero($('pagamentoTaxa').value);

  const taxaValor = valor * taxa / 100;
  const liquido = valor - taxaValor;

  $('pagamentoTaxaValor').textContent = dinheiro(taxaValor);
  $('pagamentoLiquido').textContent = dinheiro(liquido);
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
    alert('Informe um valor de pagamento maior que zero.');
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

  alert('Pagamento registrado com sucesso! A dívida foi atualizada.');
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
    'Deseja excluir este pagamento? A dívida do cliente será recalculada automaticamente.'
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
    lista.innerHTML =
      '<tr><td colspan="6" class="vazio">Nenhum produto cadastrado.</td></tr>';
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

/* =========================================
   VENDAS
========================================= */

/* CADASTRO RÁPIDO DE CLIENTES NA TELA DE VENDAS */

function alternarCadastroRapido(id) {
  const elemento = $(id);
  if (!elemento) return;

  elemento.classList.toggle('oculto');
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
    alert('Não foi possível salvar o cliente. Tente novamente.');
  }
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
    alert('Para registrar uma venda fiada, selecione um cliente cadastrado.');
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
    lista.innerHTML =
      '<tr><td colspan="8" class="vazio">Nenhuma venda encontrada.</td></tr>';
    return;
  }

  vendas.forEach(v => {
    const taxa = v.status === 'recebido' ? numero(v.taxaValor) : 0;
    const lucro = numero(v.valor) - numero(v.custo) - taxa;

    const pendente = v.status === 'pendente' || v.pagamento === 'Fiado';

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapar(formatarData(v.data))}</td>
      <td>${nomeLoja(v.loja)}</td>
      <td>${escapar(v.descricao)}</td>
      <td>${dinheiro(v.valor)}</td>
      <td>${dinheiro(numero(v.taxaValor))}</td>
      <td>${dinheiro(lucro)}</td>
      <td>${pendente ? 'A receber' : 'Recebido'}</td>
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

  if (v.pagamento === 'Fiado') {
    $('vendaStatus').value = 'pendente';
  }

  atualizarMargens();
  abrirSecao('vendas', document.querySelectorAll('nav button')[3]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirVenda(id) {
  if (!confirm('Deseja realmente excluir esta venda? Se houver pagamentos do cliente, o saldo será recalculado.')) return;

  dados.vendas = dados.vendas.filter(v => v.id !== id);
  await salvarDados();
  atualizarTudo();
}

/* =========================================
   PAINÉIS FINANCEIROS
========================================= */

function criarResumoLoja(loja) {
  const vendas = dados.vendas.filter(v => v.loja === loja);

  const faturamento = vendas.reduce(
    (s, v) => s + numero(v.valor), 0
  );

  const custos = vendas.reduce(
    (s, v) => s + numero(v.custo), 0
  );

  let taxas = 0;
  let recebido = 0;
  let aReceber = 0;

  vendas.forEach(v => {
    const pendente =
      v.status === 'pendente' || v.pagamento === 'Fiado';

    if (!pendente) {
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
  $('pagamentoData').value = new Date().toLocaleDateString('en-CA');
});
