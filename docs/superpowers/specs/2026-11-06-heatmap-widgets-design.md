# Heatmap Widgets: design

Data: 2026-11-06

## Objetivo

Um app para Windows 11 que coloca heatmaps de calendário na área de trabalho.
O usuário cria um heatmap, define o tema (ex.: Treino, Estudo) e marca a
intensidade de cada dia com cliques direto no widget.

### Critérios de sucesso

- Criar um novo tema leva poucos segundos.
- Marcar o dia exige um clique direto na área de trabalho.
- Depois de reiniciar o PC, os widgets voltam sozinhos, na mesma posição e com
  os mesmos dados.

### Fora do escopo da primeira versão

- Grade livre (linhas e colunas definidas pelo usuário).
- Valores numéricos por dia (ex.: minutos, km).
- Notas por dia.
- Conta de usuário, nuvem ou sincronização.
- Sistemas que não sejam Windows.

## Decisões

| Tema | Decisão |
|---|---|
| Tipo de heatmap | Calendário: cada quadrado é um dia |
| Período exibido | 6 meses a partir do mês de criação; depois anda um mês por vez, com 4 meses antes do atual e 1 depois |
| Marcação | Clique esquerdo sobe um nível, em ciclo: 0→1→2→3→4→0 |
| Limpar um dia | Clique direito leva o dia ao nível 0 |
| Comportamento na área de trabalho | Fixo no fundo, atrás das outras janelas |
| Quantidade | Vários widgets ao mesmo tempo, um por tema |
| Tecnologia | Electron |
| Armazenamento | Arquivo JSON local em `%APPDATA%` |

## Arquitetura

Um único app Electron que roda em segundo plano, com um ícone na bandeja do
sistema.

- **Processo principal:** é o único que lê e grava dados e controla as janelas.
- **Janela de widget:** uma por heatmap. Sem moldura, com fundo transparente e
  fora da barra de tarefas.
- **Janela de gerenciamento:** abre pela bandeja. Cria, edita e exclui heatmaps.

### Módulos

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `src/shared/calendar.js` | Lógica pura: monta a grade de semanas e calcula o próximo nível | Nada |
| `src/main/store.js` | Lê, valida e grava os dados | Sistema de arquivos |
| `src/main/desktop-pin.js` | Isola as chamadas à API do Windows que mantêm a janela no fundo | `koffi`, `user32.dll` |
| `src/main/widgets.js` | Abre, fecha e posiciona as janelas de widget | `store`, `desktop-pin` |
| `src/main/tray.js` | Ícone e menu da bandeja | `widgets` |
| `src/renderer/widget/` | Interface do widget | `calendar`, IPC |
| `src/renderer/manager/` | Interface de gerenciamento | IPC |

As janelas usam `contextIsolation` ativado e `nodeIntegration` desativado. O
acesso ao processo principal passa por um `preload` com uma API mínima.

## Modelo de dados

Arquivo: `%APPDATA%/heatmap-widgets/data.json`

```json
{
  "version": 1,
  "heatmaps": [
    {
      "id": "abc123",
      "name": "Treino",
      "color": "green",
      "position": { "x": 100, "y": 80 },
      "days": { "2026-11-06": 3 }
    }
  ]
}
```

- As chaves de `days` usam `AAAA-MM-DD` no fuso local do PC.
- Os valores de `days` são inteiros de 1 a 4. Um dia com nível 0 não é gravado.
- `color` é uma das 6 paletas fixas: `green`, `blue`, `purple`, `orange`, `red`,
  `teal`.
- `name` é obrigatório, com 1 a 40 caracteres depois de remover espaços nas
  pontas. Nomes repetidos são permitidos.
- A gravação usa um arquivo temporário seguido de troca de nome, para que uma
  queda de energia não corrompa os dados.

## Widget

### Visual

- Nome do tema no topo.
- Grade de 6 meses (até 28 semanas × 7 dias), com 380×160 px, ou 5×2 posições de ícone.
- Rótulos dos meses acima da grade.
- Legenda "Menos → Mais" abaixo da grade.
- O dia de hoje tem destaque visual.
- Cada nível de 1 a 4 é um tom mais forte da paleta escolhida. O nível 0 usa um
  tom neutro.

### Interações

| Ação | Resultado |
|---|---|
| Clique esquerdo em um dia | Sobe um nível, em ciclo |
| Clique direito em um dia | Limpa o dia |
| Passar o mouse em um dia | Mostra a data e o nível |
| Clique em um dia futuro | Nada acontece |
| Arrastar pelo título | Move o widget, encaixa na posição livre mais próxima da grade dos ícones e salva ao soltar |

Dias passados podem ser editados. À meia-noite, a grade se atualiza sozinha para
incluir o novo dia.

## Gerenciamento e bandeja

O menu da bandeja tem:

- **Gerenciar heatmaps:** abre a janela de gerenciamento.
- **Iniciar com o Windows:** liga e desliga a inicialização automática. Vem
  ligada por padrão.
- **Sair:** encerra o app.

A janela de gerenciamento lista os heatmaps e permite criar, renomear, trocar a
cor e excluir. Excluir pede confirmação, porque apaga o histórico daquele tema.

Se não houver nenhum heatmap, a janela de gerenciamento abre ao iniciar o app.

## Fluxo de um clique

1. O widget envia `heatmap:cycle-day` com o `id` e a data.
2. O processo principal calcula o novo nível, atualiza os dados e grava.
3. O processo principal devolve o novo nível.
4. O widget pinta o quadrado com o valor devolvido.

A tela só muda depois da gravação, então sempre mostra o que está salvo. O
clique direito segue o mesmo fluxo com `heatmap:clear-day`.

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| `data.json` corrompido ou inválido | Renomeia para `data.corrupt-<timestamp>.json`, inicia vazio e mostra um aviso |
| Falha ao gravar | Mantém o valor antigo na tela e mostra um aviso |
| Posição salva fora de qualquer monitor | Move o widget para o monitor principal |
| Falha ao fixar no fundo | O widget funciona como janela normal e o app mostra um aviso |

## Risco técnico: fixar no fundo

Manter a janela no fundo depende da API do Windows, e o atalho `Win+D` pode
esconder o widget. Este é o maior risco do projeto, então a implementação começa
com um teste rápido em Electron que verifica:

1. A janela fica atrás das outras, mesmo depois de receber um clique.
2. A janela continua visível depois de `Win+D`.
3. A janela continua recebendo cliques.

Duas técnicas serão avaliadas, nesta ordem:

1. Manter a janela na base da pilha com `SetWindowPos(HWND_BOTTOM)`, reaplicando
   sempre que ela ganhar foco.
2. Tornar a janela filha da camada da área de trabalho (`WorkerW`).

O resultado do teste define a implementação de `desktop-pin.js`. Se nenhuma
técnica atender aos três pontos, o projeto para e o usuário decide como seguir.

## Testes

- **Automatizados (`node:test`):**
  - `calendar.js`: anos bissextos, virada de ano, início da grade, ciclo de
    níveis, dias futuros.
  - `store.js`: criação do arquivo, leitura, gravação atômica, arquivo
    corrompido, dados inválidos.
- **Manuais:** clicar, arrastar, usar `Win+D`, desconectar um monitor (quando
  houver um segundo) e reiniciar o PC.

## Entrega

Um instalador `.exe` gerado com `electron-builder`. O instalador não terá
assinatura digital, então o Windows SmartScreen pode mostrar um aviso na
primeira execução.

## Resultado do teste de fixar no fundo

Testado em 2026-11-06, no Windows 11 26200, com Electron 45, usando `Win+D` e
cliques enviados ao sistema, medindo a janela sob o ponto e a cor do pixel.

| Técnica | Visível após `Win+D` | Recebe clique | Fica atrás de outras janelas |
|---|---|---|---|
| A: `SetWindowPos(HWND_BOTTOM)` | Não | Não | Não |
| B: filha da `WorkerW` | Sim | Não, fica atrás dos ícones | Não testado |
| C: filha da `SHELLDLL_DefView` | Sim | Sim | Sim |
| D: subir quando a área de trabalho tem o foco | Sim | Sim | Não |

**Escolhida: técnica C.** A janela vira filha da camada dos ícones.

- Funciona com `transparent: true` e não exige opções extras de janela.
- O widget fica por cima dos ícones que estiverem no mesmo lugar.
- A posição de uma janela filha é relativa à janela pai, então `pinToDesktop`
  converte as coordenadas depois de `SetParent`.
- Reiniciar o `explorer.exe` destrói a janela pai, e com ela o widget. O app
  precisa reabrir os widgets quando isso acontecer.
