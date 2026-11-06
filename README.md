# Heatmap Widgets

Heatmaps de calendário fixos na área de trabalho do Windows 11. Crie um tema, como
Treino ou Estudo, e marque a intensidade de cada dia com um clique direto no widget.

## Instalação

Rode `dist/Heatmap Widgets Setup 0.1.0.exe`.

O instalador não tem assinatura digital, então o Windows SmartScreen pode mostrar um
aviso na primeira execução. Para seguir, clique em **Mais informações** e depois em
**Executar assim mesmo**.

## Como usar

| Ação | Resultado |
|---|---|
| Clique esquerdo em um dia | Sobe a intensidade, em ciclo de 0 a 4 |
| Clique direito em um dia | Limpa o dia |
| Passar o mouse em um dia | Mostra a data e o nível no rodapé |
| Arrastar pelo título | Move o widget, que encaixa na grade dos ícones ao soltar |

O ícone na bandeja do sistema tem o menu do app:

- **Gerenciar heatmaps:** cria, renomeia, troca a cor e exclui temas.
- **Iniciar com o Windows:** vem ligado por padrão.
- **Sair:** encerra o app e fecha os widgets.

Os widgets ficam atrás das outras janelas e por cima dos ícones da área de trabalho.
Para vê-los, use `Win+D`. Eles não empurram ícones: um widget solto sobre um ícone o
cobre.

Cada widget mostra 6 meses, a partir do mês em que foi criado. Quando o quinto mês
termina, o primeiro sai da tela a cada virada de mês. Um heatmap criado em novembro
mostra de novembro a abril e, em abril, passa para dezembro a maio. Os dias que saem da
tela continuam salvos.

## Dados

Tudo fica em `%APPDATA%\heatmap-widgets\data.json`, só no seu PC. Se o arquivo estiver
corrompido, o app guarda uma cópia como `data.corrupt-<número>.json`, na mesma pasta, e
inicia vazio.

## Desenvolvimento

```bash
npm install
npm start           # roda o app
npm test            # testes unitários
npm run test:e2e    # testes de ponta a ponta
npm run dist        # gera o instalador em dist/
```

Os testes de ponta a ponta abrem widgets de verdade na área de trabalho por alguns
segundos. Eles usam uma pasta temporária e não tocam nos seus dados.
