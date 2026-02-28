# Nreader

Projeto inicial do Nreader — um leitor estilo Kindle usando Electron + React + Vite, com suporte a `.txt`, `.md` e `.pdf`.

Instalação e execução (Windows):

```bash
npm install
npm run dev
```

Para gerar build renderer e abrir com Electron:

```bash
npm run build
npm start
```

Arquivos principais:

- [main.js](main.js#L1) — processo principal do Electron e leitura de `.txt/.md/.pdf`
- [preload.js](preload.js#L1) — API segura exposta ao renderer
- [index.html](index.html#L1) & [src](src) — app React (Vite)

Uso básico:

1. Clique em **Abrir livro (.txt/.md/.pdf)**.
2. Selecione um arquivo `.txt`, `.md` ou `.pdf`.
3. Navegue com **Anterior/Próxima** e ajuste tema/fonte.

Observação: para PDF, o app extrai texto para leitura contínua (sem preservar layout visual original da página).

Próximos passos sugeridos: integrar leitura de EPUB, armazenamento de posição por arquivo, e tema escuro avançado.
