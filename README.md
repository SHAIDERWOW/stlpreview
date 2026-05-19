readme_content = """# 🧊 Visualizador 3D v3.0

Um visualizador 3D versátil e interativo diretamente no navegador, focado na exibição de peças para impressão 3D e modelagem. Suporta diversos formatos de arquivo e inclui ferramentas úteis como estimador de tempo de impressão, ferramenta de medição e capturas de tela.

## ✨ Funcionalidades

- **Suporte a Múltiplos Formatos:** Visualize arquivos `.STL`, `.3MF`, `.OBJ`, `.glTF` e `.glb`.
- **Drag & Drop:** Arraste e solte arquivos diretamente na tela para carregar seus modelos instantaneamente.
- **Modos de Visualização:** Alterne dinamicamente entre os modos **Sólido**, **Wireframe** e **Raio-X**.
- **Estimador de Tempo de Impressão:** Calcule uma estimativa básica do tempo de impressão ajustando:
  - Resolução / Altura da camada
  - Preenchimento (Infill %)
  - Velocidade de impressão (mm/s)
- **Ferramenta de Medição:** Obtenha distâncias clicando em dois pontos específicos do modelo carregado.
- **Captura de Tela (Screenshot):** Salve capturas em alta resolução (Full HD) do modelo em exibição, com suporte a fundos Transparente, Preto ou Branco.
- **Tema Customizável:** Suporte nativo para Modo Escuro e Modo Claro (preferência salva localmente).
- **Customização de Cor:** Altere a cor do modelo renderizado em tempo real.

## 🚀 Tecnologias Utilizadas

- **HTML5 & CSS3** (Uso de variáveis CSS para temas e design responsivo)
- **JavaScript (ES6 Modules)**
- **[Three.js](https://threejs.org/)** (v0.165.0) – Motor de renderização WebGL. Utilizando add-ons como `OrbitControls`, `STLLoader`, `GLTFLoader`, entre outros.

## 🛠️ Como Usar (Executando Localmente)

Devido ao uso de Módulos ES6 (`<script type="importmap">` e `<script type="module">`), a página não pode ser aberta apenas com um duplo clique no arquivo `index.html` por questões de segurança dos navegadores (CORS). **É necessário um servidor web local.**

### Opção 1: VS Code (Recomendado)
1. Abra a pasta do projeto no **Visual Studio Code**.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito no arquivo `index.html` e selecione **"Open with Live Server"**.

### Opção 2: Python
Se você possui Python instalado, abra o terminal na raiz do projeto e execute:
```bash
# Python 3
python -m http.server
