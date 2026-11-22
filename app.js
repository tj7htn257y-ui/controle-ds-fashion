
let lojaAtual = 'geral';

function abrirSecao(id, botao) {
  document.querySelectorAll('.secao').forEach(secao => {
    secao.classList.remove('ativa');
  });

  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('ativo');
  });

  const secao = document.getElementById(id);

  if (secao) {
    secao.classList.add('ativa');
  }

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

  alert('Você selecionou: ' + nomes[loja]);

  document.querySelectorAll('.secao').forEach(secao => {
    secao.classList.remove('ativa');
  });

  const geral = document.getElementById('geral');

  if (geral) {
    geral.classList.add('ativa');
    geral.querySelector('h2').textContent = nomes[loja];
    geral.querySelector('p').textContent =
      'Área selecionada. Em breve, você poderá administrar esta loja separadamente.';
  }

  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('ativo');
  });

  document.querySelector('nav button').classList.add('ativo');
}

