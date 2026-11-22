
const $ = id => document.getElementById(id);

const CHAVE_SENHA = 'ds-fashion-password';
const CHAVE_DADOS = 'ds-fashion-data';

let lojaAtual = 'geral';
let chaveCriptografia = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

function mostrarMensagem(texto) {
  $('mensagem').textContent = texto;
}

async function configurarSenha() {
  const senha = $('senha').value;
  const confirmacao = $('confirmacao').value;

  if (senha.length < 8) {
    mostrarMensagem('Escolha uma senha com pelo menos 8 caracteres.');
    return;
  }

  if (senha !== confirmacao) {
    mostrarMensagem('As senhas não são iguais.');
    return;
  }

  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    chaveCriptografia = await derivarChave(senha, salt);

    const teste = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
      chaveCriptografia,
      encoder.encode('DS Fashion')
    );

    const registro = {
      salt: Array.from(salt),
      teste: Array.from(new Uint8Array(teste)),
      iv: Array.from(new Uint8Array(12))
    };

    // O teste de senha será armazenado abaixo com seu IV correspondente.
    registro.iv = Array.from(
      new Uint8Array(
        await (async () => {
          const iv = crypto.getRandomValues(new Uint8Array(12));
          registro.teste = Array.from(
            new Uint8Array(
              await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                chaveCriptografia,
                encoder.encode('DS Fashion')
              )
            )
          );
          return iv;
        })()
      )
    );

    localStorage.setItem(CHAVE_SENHA, JSON.stringify(registro));

    const dados = {
      clientes: [],
      produtos: [],
      vendas: [],
      loja: 'geral'
    };

    await salvarDados(dados);
    entrarNoAplicativo();

  } catch (erro) {
    console.error(erro);
    mostrarMensagem('Não foi possível configurar a senha neste navegador.');
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
    const salt = new Uint8Array(registro.salt);
    chaveCriptografia = await derivarChave(senha, salt);

    const iv = new Uint8Array(registro.iv);
    const teste = new Uint8Array(registro.teste);

    const resultado = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      chaveCriptografia,
      teste
    );

    if (decoder.decode(resultado) !== 'DS Fashion') {
      throw new Error('Senha inválida');
    }

    entrarNoAplicativo();

  } catch (erro) {
    chaveCriptografia = null;
    mostrarMensagem('Senha incorreta.');
  }
}

async function salvarDados(dados) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const criptografado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chaveCriptografia,
    encoder.encode(JSON.stringify(dados))
  );

  localStorage.setItem(
    CHAVE_DADOS,
    JSON.stringify({
      iv: Array.from(iv),
      dados: Array.from(new Uint8Array(criptografado))
    })
  );
}

async function carregarDados() {
  const registro = JSON.parse(localStorage.getItem(CHAVE_DADOS));

  if (!registro) {
    return {
      clientes: [],
      produtos: [],
      vendas: []
    };
  }

  const resultado = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(registro.iv)
    },
    chaveCriptografia,
    new Uint8Array(registro.dados)
  );

  return JSON.parse(decoder.decode(resultado));
}

function entrarNoAplicativo() {
  $('telaAcesso').classList.add('oculto');
  $('aplicativo').classList.remove('oculto');
  $('senha').value = '';
  $('confirmacao').value = '';
  mostrarMensagem('');
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

  if (botao) {
    botao.classList.add('ativo');
  }

  lojaAtual = id;
}

function selecionarLoja(loja) {
  lojaAtual = loja;

  const nomes = {
    roupas: 'Loja de Roupas',
    joias: 'Loja de Joias'
  };

  $('geral').querySelector('h2').textContent = nomes[loja];
  $('geral').querySelector('p').textContent =
    'Você está na área da ' + nomes[loja] + '.';

  abrirSecao('geral', document.querySelector('nav button'));
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
});
