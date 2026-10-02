// Dados fictícios para experimentar o app. Todos os números são inventados.

export interface Sample {
  id: string;
  name: string;
  description: string;
  /** Tipo de gráfico sugerido ao carregar. */
  chart: string;
  tsv: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'vendas',
    name: 'Vendas por trimestre',
    description: 'Quatro trimestres × três linhas de produto',
    chart: 'column',
    tsv: [
      'Trimestre\tCafés especiais\tChás\tAcessórios',
      '1º tri\t182.400,50\t96.300,00\t41.250,75',
      '2º tri\t205.900,00\t88.120,40\t52.400,00',
      '3º tri\t231.300,25\t79.800,00\t60.950,10',
      '4º tri\t268.750,00\t102.450,90\t78.300,00',
    ].join('\n'),
  },
  {
    id: 'canais',
    name: 'Canais de venda',
    description: 'Uma série: participação de cada canal',
    chart: 'donut',
    tsv: ['Canal\tPedidos', 'Loja física\t4.820', 'Site\t3.915', 'Aplicativo\t2.640', 'Marketplace\t1.380', 'Telefone\t410'].join(
      '\n',
    ),
  },
  {
    id: 'temperatura',
    name: 'Temperatura média',
    description: 'Doze meses × duas cidades',
    chart: 'line',
    tsv: [
      'Mês\tCidade A\tCidade B',
      'jan\t26,1\t22,4',
      'fev\t26,4\t22,6',
      'mar\t25,8\t21,9',
      'abr\t24,2\t19,8',
      'mai\t22,1\t17,1',
      'jun\t20,9\t15,6',
      'jul\t20,4\t15,2',
      'ago\t21,3\t16,4',
      'set\t22,0\t17,3',
      'out\t23,4\t18,9',
      'nov\t24,6\t20,1',
      'dez\t25,6\t21,6',
    ].join('\n'),
  },
  {
    id: 'resultado',
    name: 'Resultado do ano',
    description: 'Da receita ao lucro, para gráfico de cascata',
    chart: 'waterfall',
    tsv: [
      'Etapa\tValor (R$ mil)',
      'Receita bruta\t1.250',
      'Impostos\t-187',
      'Custo dos produtos\t-498',
      'Despesas comerciais\t-176',
      'Despesas administrativas\t-121',
      'Receitas financeiras\t34',
    ].join('\n'),
  },
  {
    id: 'satisfacao',
    name: 'Satisfação 2024 × 2025',
    description: 'Comparação de dois anos por área',
    chart: 'dumbbell',
    tsv: [
      'Área\t2024\t2025',
      'Atendimento\t72%\t81%',
      'Entrega\t64%\t70%',
      'Preço\t58%\t55%',
      'Qualidade\t83%\t86%',
      'Site\t61%\t74%',
      'Troca e devolução\t49%\t63%',
    ].join('\n'),
  },
];
