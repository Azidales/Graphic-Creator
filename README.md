# Criador de Gráficos

Cole uma tabela do Excel (ou envie um `.xlsx`) e monte o gráfico em segundos, com as personalizações que no Excel levam vários cliques: trocar linhas por colunas, destacar uma barra, pôr rótulos só no maior e no menor valor, linha de meta, hachuras para impressão em preto e branco, exportar em Full HD.

Tudo roda no navegador. Os dados não saem do seu computador.

## Como usar

1. **Traga os dados**
   - Copie as células no Excel e aperte **Ctrl+V em qualquer lugar da página**; ou
   - arraste um arquivo `.xlsx`, `.xls`, `.ods` ou `.csv` para a página; ou
   - use o botão **Enviar .xlsx ou .csv** na aba *Dados*.
   Números no formato brasileiro (`1.234,56`, `R$ 10,00`, `12,5%`, `(1.500)`) são entendidos automaticamente.
2. **Escolha o tipo** na galeria. O ponto verde marca os tipos sugeridos para aquela tabela.
3. **Ajuste** pelas abas *Dados*, *Visual*, *Rótulos e eixos*.
4. **Exporte** em PNG, SVG ou JPG, ou copie a imagem direto para o PowerPoint/Word.

Atalhos: **Ctrl+Z** desfaz, **Ctrl+Y** (ou Ctrl+Shift+Z) refaz. O trabalho fica salvo no navegador.

## O que dá para fazer

**Tipos de gráfico (15):** colunas, barras horizontais, linhas, área, combinado (cada série vira coluna, linha ou área), pizza, rosca (com total no centro), dispersão, pirulito, halteres (antes × depois), cascata, radar, funil, mosaico (treemap) e mapa de calor.

**Dados**
- Séries nas colunas ou nas linhas (o "Alternar Linha/Coluna" do Excel), em um clique.
- Detecção automática de cabeçalho, coluna de categorias e separador decimal, com opção de corrigir na mão.
- Escolher quais colunas viram séries, clicando no cabeçalho da tabela (A, B, C…) ou na lista.
- Editar células direto na tabela.
- Agrupar categorias repetidas (soma, média, contagem, mínimo, máximo), como uma tabela dinâmica rápida.
- Ordenar (maior → menor, menor → maior, A → Z), mostrar só o Top N e juntar o resto em "Outros".
- Esconder categorias específicas.
- Arquivos com várias abas: escolha a aba.

**Visual**
- Estilos rápidos: Limpo, Apresentação, Destacar o maior, Impressão P&B, Fundo escuro.
- Cores por paleta (a padrão é segura para daltonismo), uma cor só, destaque (tudo cinza menos o que importa), positivo/negativo, gradiente pelo valor, ou sem cor.
- Cor de cada série e de cada categoria.
- Hachuras (padrões) para impressão e para daltonismo.
- Tema claro/escuro, fundo branco, transparente ou de qualquer cor.
- Título, subtítulo, rodapé (fonte dos dados), fonte e tamanho do texto.
- Vertical ou horizontal; lado a lado, empilhado ou empilhado 100%; um painel pequeno por série.
- Espessura e cantos das barras, linhas suaves ou em degrau, marcadores, opacidade da área, furo da rosca.
- Linha de tendência, linha da média e linha de meta.

**Rótulos e eixos**
- Mostrar valor, porcentagem, categoria ou série; em todos os pontos, só no último, no primeiro e último, ou só no maior e no menor.
- Formatos: número, compacto (1,2 mil · 3,4 mi), porcentagem, moeda (R$, US$, €), casas decimais, prefixo e sufixo.
- Títulos dos eixos, linhas de grade, rótulos inclinados, mínimo/máximo, escala logarítmica.

**Exportar**
- Tamanhos prontos: slide 16:9, slide 4:3, quadrado, stories 9:16, A4 paisagem ou personalizado.
- Resolução 1× a 4× (16:9 em 2× = 1920 × 1080).
- PNG (com ou sem fundo), SVG vetorial, JPG, copiar imagem e baixar a tabela já tratada em CSV.
- **Meus estilos:** salve o visual de um gráfico e aplique em outras tabelas; exporte/importe os estilos em `.json`.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org/) 22.12 ou mais novo.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes (leitura de dados, números em pt-BR, desenho de todos os tipos)
npm run build      # gera dist/ e também dist/criador-de-graficos.html
```

`dist/criador-de-graficos.html` é um arquivo único: dá para mandar por e-mail ou abrir com dois cliques, sem instalar nada.

## Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` testa e publica o app a cada push na `main`. Para ativar, em **Settings → Pages → Build and deployment**, escolha **GitHub Actions** como fonte.

## Como o código está organizado

| Pasta | O que tem |
|---|---|
| `src/data/` | Leitura da colagem e do `.xlsx`, números em pt-BR, inversão linhas/colunas, agrupamento, ordenação |
| `src/chart/` | Configuração do gráfico, paletas, formatos de número e a montagem da opção do ECharts para cada tipo |
| `src/ui/` | Componentes da interface (galeria, painéis, tabela, gráfico) |
| `src/state.ts` | Estado do app, desfazer/refazer, salvamento no navegador e estilos salvos |
| `src/export.ts` | Geração de PNG/SVG/JPG e download |

Feito com [React](https://react.dev/), [Apache ECharts](https://echarts.apache.org/) e [SheetJS](https://sheetjs.com/).
