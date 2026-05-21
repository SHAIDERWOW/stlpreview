# 🧊 Visualizador 3D v3.2

![Demonstração do Visualizador](link_para_um_gif_ou_print_aqui.gif)

Um visualizador 3D prático, rápido e interativo que roda diretamente no seu navegador. Ideal para analisar modelos tridimensionais, projetos mecânicos e peças para impressão 3D sem a necessidade de baixar ou instalar nenhum software pesado.

🌍 **Acesse o site:** [https://shaiderwow.github.io/stlpreview/](https://shaiderwow.github.io/stlpreview/)

---

## ✨ Funcionalidades

### 📂 Formatos Suportados
Compatível com arquivos `.STL`, `.3MF`, `.OBJ`, `.STEP` / `.STP`, `.glTF` e `.glb`.

### ✂️ Corte Transversal Avançado (Hachura Sólida vs. Oco)
Inspecione o interior das peças cortando o modelo em qualquer eixo (X, Y ou Z). Você pode alternar dinamicamente entre:
- **Corte Hachurado:** Gera uma parede maciça com hachuras de desenho técnico onde a ferramenta passa, indicando material sólido.
- **Visão Oca:** Remove a tampa, revelando o interior vazio real da malha tridimensional.

### 🖱️ Drag & Drop
Arraste qualquer arquivo compatível diretamente para a área de visualização para carregá-lo instantaneamente.

### 🔄 Rotação Livre
Rotação completamente livre em todos os eixos — sem trava de ângulo polar. Use o botão esquerdo do mouse (ou um dedo no touch) para girar o modelo em qualquer direção.

### 📁 Lista de Modelos com Grupos Colapsáveis
Modelos organizados em pastas que podem ser abertas e fechadas com um clique. A preferência de expansão é salva automaticamente no navegador.

### 💥 Explosão de Montagem
Para modelos contendo múltiplas peças, o controle deslizante "Explodir Montagem" separa visualmente os componentes, facilitando a análise individual sem perder o contexto.

### 📏 Ferramenta de Medição
Clique (ou toque) em dois pontos do modelo para medir a distância exata, com deltas nos eixos X, Y e Z. Funciona perfeitamente com mouse e em dispositivos touch. 

### 🎨 Personalização Visual
- Troque a **cor do modelo** em tempo real.
- Alterne entre **Modo Claro** e **Modo Escuro** (sua preferência é salva automaticamente).
- Alterne os modos de renderização: **Sólido**, **Wireframe** e **Superfície** (normais de cor).

### 📸 Captura de Tela Full HD
Exporte a visualização atual em alta resolução (1920×1080) com fundo **transparente**, **branco** ou **preto**.

### ⏱️ Estimativa de Tempo de Impressão (Beta)
Painel com simulação de tempo de impressão 3D com base nos parâmetros:
- Resolução (altura da camada)
- Preenchimento (Infill %)
- Espessura das paredes
- Velocidade de impressão (mm/s)
> ⚠️ *Nota: Esta é uma estimativa matemática aproximada. Utilize um fatiador (slicer) como Cura ou PrusaSlicer para resultados exatos.*

---

## 🖱️ Navegação

| Ação | Mouse | Touch |
|---|---|---|
| **Rotacionar** | Botão esquerdo | 1 dedo |
| **Pan (Mover)** | Botão direito | 2 dedos (arrastar) |
| **Zoom** | Scroll / Botão do meio | Pinça (2 dedos) |
| **Resetar vista** | Tecla `R` ou botão ⟳ | Botão ⟳ |

---

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
|---|---|
| <kbd>R</kbd> | Resetar câmera e centralizar o modelo na tela |
| <kbd>G</kbd> | Mostrar / Ocultar grade de referência no chão |
| <kbd>M</kbd> | Ativar / Cancelar a ferramenta de medição |
| <kbd>S</kbd> | Abrir o menu de captura de tela (Screenshot) |
| <kbd>Esc</kbd> | Cancelar medição em andamento |

---

## 🚀 Como Rodar Localmente (Desenvolvimento)

Este projeto utiliza **ES Modules** (módulos nativos do JavaScript). Por motivos de segurança (CORS), navegadores bloqueiam a importação de módulos se você abrir o arquivo `index.html` diretamente com um duplo-clique.

Para rodar localmente:
1. Clone este repositório.
2. Inicie um servidor web local na pasta do projeto. 
   - Se usar o **VS Code**, instale a extensão **Live Server** e clique em "Go Live".
   - Se tiver o **Python** instalado, abra o terminal na pasta e digite: `python -m http.server 8000`
3. Acesse `http://localhost:8000` no seu navegador.

---

## 🛠️ Tecnologias Utilizadas

- **[Three.js](https://threejs.org/)** — Renderização 3D nativa via WebGL.
- **[occt-import-js](https://github.com/kovacsv/occt-import-js)** — Motor WebAssembly para carregar arquivos pesados de engenharia (.STEP).
- **100% Client-Side** — Sem backend ou envio de arquivos para a nuvem. Seus modelos permanecem locais e seguros.
