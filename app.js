
function atualizarDetalheCliente() {
  const cliente = dados.clientes.find(
    c => c.id === clienteDetalhadoId
  );

  if (!cliente) {
    fecharDetalheCliente();
    return;
  }

  const resumo = obterResumoCliente(cliente.id);

  $('tituloDetalheCliente').textContent =
    'Financeiro de ' + cliente.nome;

  $('clienteTotalDivida').textContent =
    dinheiro(resumo.totalDivida);

  $('clienteTotalPago').textContent =
    dinheiro(resumo.totalPago);

  $('clienteSaldoDevedor').textContent =
    dinheiro(resumo.saldoDevedor);

  /* =====================================
     COMPRAS E DÍVIDAS DO CLIENTE
  ===================================== */

  let painelCompras = $('painelComprasCliente');

  if (!painelCompras) {
    painelCompras = document.createElement('div');
    painelCompras.id = 'painelComprasCliente';

    const formularioPagamento = $('formPagamento');

    formularioPagamento.parentNode.insertBefore(
      painelCompras,
      formularioPagamento
    );
  }

  painelCompras.innerHTML = `
    <h3>Compras e dívidas do cliente</h3>
    <div class="listas">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Loja</th>
            <th>Produto</th>
            <th>Valor original</th>
            <th>Já pago</th>
            <th>Saldo restante</th>
          </tr>
        </thead>
        <tbody id="listaDividasCliente"></tbody>
      </table>
    </div>
  `;

  const listaDividas = $('listaDividasCliente');
  listaDividas.innerHTML = '';

  const vendasPendentes = resumo.vendasPendentes
    .slice()
    .sort((a, b) =>
      (b.data || '').localeCompare(a.data || '')
    );

  if (!vendasPendentes.length) {
    listaDividas.innerHTML = `
      <tr>
        <td colspan="6" class="vazio">
          Este cliente não possui compras pendentes.
        </td>
      </tr>
    `;
  } else {
    vendasPendentes.forEach(v => {
      const valorOriginal = numero(v.valor);

      const saldoCentavos =
        resumo.saldos.get(v.id) || 0;

      const saldoRestante = saldoCentavos / 100;

      const valorPago = Math.max(
        0,
        valorOriginal - saldoRestante
      );

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapar(formatarData(v.data))}</td>
        <td>${escapar(nomeLoja(v.loja))}</td>
        <td>${escapar(v.descricao || 'Venda sem descrição')}</td>
        <td>${dinheiro(valorOriginal)}</td>
        <td>${dinheiro(valorPago)}</td>
        <td><strong>${dinheiro(saldoRestante)}</strong></td>
      `;

      listaDividas.appendChild(tr);
    });
  }

  /* =====================================
     HISTÓRICO DE PAGAMENTOS
  ===================================== */

  const lista = $('listaPagamentos');
  lista.innerHTML = '';

  const pagamentos = dados.pagamentos
    .filter(p => p.clienteId === cliente.id)
    .slice()
    .sort((a, b) =>
      (b.data || '').localeCompare(a.data || '')
    );

  if (!pagamentos.length) {
    lista.innerHTML = `
      <tr>
        <td colspan="6" class="vazio">
          Nenhum pagamento registrado.
        </td>
      </tr>
    `;
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
            <button
              type="button"
              onclick="editarPagamento('${p.id}')">
              Editar
            </button>
            <button
              type="button"
              class="perigo"
              onclick="excluirPagamento('${p.id}')">
              Excluir
            </button>
          </div>
        </td>
      `;

      lista.appendChild(tr);
    });
  }
}
